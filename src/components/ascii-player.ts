export type AsciiPlayerOptions = {
  container: HTMLElement;
  manifestUrl: string;
  framesUrl: string;
  posterUrl: string;
  loop?: boolean;
  autoplay?: boolean;
};

type Manifest = {
  version: number;
  fps: number;
  cols: number;
  rows: number;
  frameCount: number;
  charset: string;
  tintColor: string;
  encoding: string;
  glyphAspect?: number;
  phosphorStrength?: number;
  videoAspect?: number;
};

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return { r: 255, g: 191, b: 0 };
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function decodeKeyframe(payload: Uint8Array, offset: number, frameSize: number) {
  const frame = new Uint8Array(frameSize);
  let i = 0;
  let cursor = offset;

  while (i < frameSize && cursor < payload.length) {
    const tag = payload[cursor++];
    const len = tag & 0x7f;
    const isLiteral = (tag & 0x80) !== 0;

    if (isLiteral) {
      frame.set(payload.subarray(cursor, cursor + len), i);
      cursor += len;
      i += len;
      continue;
    }

    const value = payload[cursor++];
    frame.fill(value, i, i + len);
    i += len;
  }

  if (i !== frameSize) {
    throw new Error('Keyframe decode failed due to incomplete payload');
  }

  return { frame, nextOffset: cursor };
}

function decodeDelta(payload: Uint8Array, offset: number, previous: Uint8Array) {
  const frame = previous.slice();
  let i = 0;
  let cursor = offset;

  while (i < frame.length && cursor < payload.length) {
    const tag = payload[cursor++];
    const len = tag & 0x7f;
    const changed = (tag & 0x80) !== 0;

    if (changed) {
      frame.set(payload.subarray(cursor, cursor + len), i);
      cursor += len;
    }

    i += len;
  }

  if (i !== frame.length) {
    throw new Error('Delta decode failed due to incomplete payload');
  }

  return { frame, nextOffset: cursor };
}

function decodeFrames(payload: Uint8Array, manifest: Manifest) {
  const frames: Uint8Array[] = [];
  const frameSize = manifest.cols * manifest.rows;
  let cursor = 0;
  let previous: Uint8Array | null = null;

  while (cursor < payload.length && frames.length < manifest.frameCount) {
    const frameType = payload[cursor++];
    if (frameType === 0 || !previous) {
      const decoded = decodeKeyframe(payload, cursor, frameSize);
      frames.push(decoded.frame);
      previous = decoded.frame;
      cursor = decoded.nextOffset;
      continue;
    }

    if (frameType !== 1) {
      throw new Error(`Unknown frame type: ${frameType}`);
    }

    const decoded = decodeDelta(payload, cursor, previous);
    frames.push(decoded.frame);
    previous = decoded.frame;
    cursor = decoded.nextOffset;
  }

  if (frames.length !== manifest.frameCount) {
    throw new Error(`Expected ${manifest.frameCount} frames, decoded ${frames.length}`);
  }

  return frames;
}

async function loadPoster(posterUrl: string) {
  const response = await fetch(posterUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${posterUrl}: ${response.status}`);
  }
  return response.text();
}

export function initAsciiPlayer(options: AsciiPlayerOptions) {
  const {
    container,
    manifestUrl,
    framesUrl,
    posterUrl,
    loop = true,
    autoplay = true
  } = options;

  const canvas = container.querySelector('canvas');
  const posterNode = container.querySelector('pre');
  if (!(canvas instanceof HTMLCanvasElement) || !(posterNode instanceof HTMLPreElement)) {
    throw new Error('ASCII player container requires <canvas> and <pre>');
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Unable to get canvas context for ASCII player');
  }

  type RenderState = {
    width: number;
    height: number;
    dpr: number;
    offsetX: number;
    offsetY: number;
    lineHeight: number;
    scaleX: number;
    fillStyle: string;
    font: string;
    shadowColor: string;
    rowBuffer: string[];
  };

  let manifest: Manifest | null = null;
  let frames: Uint8Array[] = [];
  let renderState: RenderState | null = null;
  let running = false;
  let isVisible = true;
  let inViewport = true;
  let rafId = 0;
  let frameIndex = 0;
  let lastRenderedFrame = -1;
  let frameStepMs = 1000 / 15;
  let lastTick = 0;

  const observer = new IntersectionObserver((entries) => {
    inViewport = entries[0]?.isIntersecting ?? true;
    if (!inViewport) {
      running = false;
      return;
    }
    if (autoplay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      running = true;
    }
  }, { threshold: 0.1 });

  observer.observe(container);

  function updateRenderState() {
    if (!manifest) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 1 || height < 1) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = Math.floor(width * dpr);
    const canvasHeight = Math.floor(height * dpr);

    if (canvas!.width !== canvasWidth || canvas!.height !== canvasHeight) {
      canvas!.width = canvasWidth;
      canvas!.height = canvasHeight;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
    }

    const targetAspect = manifest.videoAspect ?? ((manifest.cols * (manifest.glyphAspect ?? 0.62)) / manifest.rows);
    const containerAspect = width / height;
    let coverWidth = width;
    let coverHeight = height;
    if (containerAspect > targetAspect) {
      coverHeight = width / targetAspect;
    } else {
      coverWidth = height * targetAspect;
    }

    const offsetX = (width - coverWidth) / 2;
    const offsetY = (height - coverHeight) / 2;
    const lineHeight = coverHeight / manifest.rows;
    const fontSize = Math.max(4, lineHeight);

    const rgb = hexToRgb(manifest.tintColor || '#ffbf00');
    const brightnessBoost = 1.2;
    const phosphorStrength = Math.min(
      1,
      Math.max(0.4, (manifest.phosphorStrength ?? 0.82) * brightnessBoost)
    );

    const font = `${fontSize}px "Courier New", Courier, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx!.font = font;
    ctx!.textBaseline = 'top';
    const measuredGlyph = Math.max(0.0001, ctx!.measureText('M').width);
    const cellWidth = coverWidth / manifest.cols;
    const scaleX = cellWidth / measuredGlyph;

    renderState = {
      width,
      height,
      dpr,
      offsetX,
      offsetY,
      lineHeight,
      scaleX,
      fillStyle: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${phosphorStrength})`,
      font,
      shadowColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
      rowBuffer: new Array(manifest.cols)
    };
  }

  const resizeObserver = new ResizeObserver(() => {
    updateRenderState();
    drawFrame(true);
  });

  resizeObserver.observe(container);

  function showPoster(text: string) {
    posterNode!.textContent = text;
    posterNode!.hidden = false;
    canvas!.hidden = true;
  }

  function showCanvas() {
    posterNode!.hidden = true;
    canvas!.hidden = false;
  }

  function drawFrame(force = false) {
    if (!manifest || !renderState || frames.length === 0) return;
    if (!force && frameIndex === lastRenderedFrame) return;

    const {
      width,
      height,
      dpr,
      offsetX,
      offsetY,
      lineHeight,
      scaleX,
      fillStyle,
      font,
      shadowColor,
      rowBuffer
    } = renderState;

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = '#000000';
    ctx!.fillRect(0, 0, width, height);

    ctx!.fillStyle = fillStyle;
    ctx!.font = font;
    ctx!.textBaseline = 'top';
    ctx!.shadowColor = shadowColor;
    ctx!.shadowBlur = 4;
    ctx!.imageSmoothingEnabled = false;

    const frame = frames[frameIndex];
    const chars = manifest.charset;
    const { cols, rows } = manifest;

    ctx!.save();
    ctx!.translate(offsetX, offsetY);
    ctx!.scale(scaleX, 1);
    for (let y = 0; y < rows; y += 1) {
      const rowStart = y * cols;
      for (let x = 0; x < cols; x += 1) {
        rowBuffer[x] = chars[frame[rowStart + x]] ?? ' ';
      }
      ctx!.fillText(rowBuffer.join(''), 0, y * lineHeight);
    }
    ctx!.restore();

    lastRenderedFrame = frameIndex;
  }

  function tick(now: number) {
    if (!manifest || frames.length === 0) {
      rafId = window.requestAnimationFrame(tick);
      return;
    }

    if (running && isVisible && inViewport) {
      if (!lastTick) lastTick = now;
      const elapsed = now - lastTick;
      if (elapsed >= frameStepMs) {
        const steps = Math.max(1, Math.floor(elapsed / frameStepMs));
        frameIndex += steps;
        if (loop) {
          frameIndex %= frames.length;
        } else if (frameIndex >= frames.length) {
          frameIndex = frames.length - 1;
          running = false;
        }
        lastTick = now;
        drawFrame();
      }
    }

    rafId = window.requestAnimationFrame(tick);
  }

  const visibilityHandler = () => {
    isVisible = document.visibilityState === 'visible';
    if (!isVisible) {
      lastTick = 0;
    }
  };

  document.addEventListener('visibilitychange', visibilityHandler);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isDestroyed = false;

  Promise.all([
    fetch(manifestUrl).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${manifestUrl}: ${res.status}`);
      return (await res.json()) as Manifest;
    }),
    fetchBytes(framesUrl),
    loadPoster(posterUrl)
  ]).then(([meta, payload, posterText]) => {
    manifest = meta;
    frameStepMs = 1000 / Math.max(1, meta.fps || 15);

    if (reducedMotion.matches) {
      showPoster(posterText);
      return;
    }

    frames = decodeFrames(payload, meta);
    showCanvas();
    updateRenderState();
    running = autoplay;
    drawFrame(true);
  }).catch(async (error) => {
    console.warn('ASCII player fallback to poster:', error);
    const posterText = await loadPoster(posterUrl).catch(() => 'ASCII preview unavailable');
    showPoster(posterText);
  });

  rafId = window.requestAnimationFrame(tick);

  const pageHideHandler = (event: PageTransitionEvent) => {
    if (event.persisted) {
      running = false;
      lastTick = 0;
      return;
    }
    cleanup();
  };

  const pageShowHandler = (event: PageTransitionEvent) => {
    if (isDestroyed || !event.persisted) return;
    if (reducedMotion.matches) return;
    if (autoplay && inViewport) {
      running = true;
      lastTick = 0;
    }
  };

  const cleanup = () => {
    if (isDestroyed) return;
    isDestroyed = true;
    window.cancelAnimationFrame(rafId);
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', visibilityHandler);
    window.removeEventListener('pagehide', pageHideHandler);
    window.removeEventListener('pageshow', pageShowHandler);
    window.removeEventListener('beforeunload', cleanup);
  };

  window.addEventListener('pagehide', pageHideHandler);
  window.addEventListener('pageshow', pageShowHandler);
  window.addEventListener('beforeunload', cleanup);
  return cleanup;
}
