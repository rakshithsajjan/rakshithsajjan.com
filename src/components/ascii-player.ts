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

type RenderState = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  lineHeight: number;
  scaleX: number;
  fillStyle: string;
  shadowColor: string;
  font: string;
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

  let manifest: Manifest | null = null;
  let frames: Uint8Array[] = [];
  let renderState: RenderState | null = null;
  let running = false;
  let isVisible = true;
  let inViewport = true;
  let rafId = 0;
  let frameIndex = 0;
  let lastRenderedFrameIndex = -1;
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

  const resizeObserver = new ResizeObserver(() => {
    if (manifest) {
      renderState = updateRenderState(manifest);
      if (renderState) drawFrame(frames[frameIndex], manifest, renderState);
    }
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

  /**
   * Caches layout and style metrics once per resize to minimize work in the render loop.
   */
  function updateRenderState(meta: Manifest): RenderState | null {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 1 || height < 1) return null;

    const dpr = window.devicePixelRatio || 1;
    // Setting canvas dimensions resets the context state (font, fillStyle, etc.)
    canvas!.width = Math.floor(width * dpr);
    canvas!.height = Math.floor(height * dpr);
    canvas!.style.width = `${width}px`;
    canvas!.style.height = `${height}px`;

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targetAspect = meta.videoAspect ?? ((meta.cols * (meta.glyphAspect ?? 0.62)) / meta.rows);
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
    const lineHeight = coverHeight / meta.rows;
    const fontSize = Math.max(4, lineHeight);

    const rgb = hexToRgb(meta.tintColor || '#ffbf00');
    const brightnessBoost = 1.2;
    const phosphorStrength = Math.min(
      1,
      Math.max(0.4, (meta.phosphorStrength ?? 0.82) * brightnessBoost)
    );
    const fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${phosphorStrength})`;
    const font = `${fontSize}px "Courier New", Courier, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

    // Static context setup
    ctx!.font = font;
    ctx!.textBaseline = 'top';
    ctx!.imageSmoothingEnabled = false;
    ctx!.shadowBlur = 4;

    const measuredGlyph = Math.max(0.0001, ctx!.measureText('M').width);
    const cellWidth = coverWidth / meta.cols;
    const scaleX = cellWidth / measuredGlyph;
    const shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;

    return {
      width,
      height,
      offsetX,
      offsetY,
      lineHeight,
      scaleX,
      fillStyle,
      shadowColor,
      font
    };
  }

  function drawFrame(frame: Uint8Array, meta: Manifest, state: RenderState) {
    // Clear with opaque black
    ctx!.fillStyle = '#000000';
    ctx!.fillRect(0, 0, state.width, state.height);

    // Set frame-specific styles
    ctx!.fillStyle = state.fillStyle;
    ctx!.shadowColor = state.shadowColor;

    const chars = meta.charset;
    const rowBuffer = new Array(meta.cols);
    ctx!.save();
    ctx!.translate(state.offsetX, state.offsetY);
    ctx!.scale(state.scaleX, 1);
    for (let y = 0; y < meta.rows; y += 1) {
      const rowStart = y * meta.cols;
      for (let x = 0; x < meta.cols; x += 1) {
        rowBuffer[x] = chars[frame[rowStart + x]] ?? ' ';
      }
      ctx!.fillText(rowBuffer.join(''), 0, y * state.lineHeight);
    }
    ctx!.restore();
  }

  function tick(now: number) {
    if (!manifest || frames.length === 0 || !renderState) {
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
      }

      // Optimization: Only redraw if the video frame index has advanced
      if (frameIndex !== lastRenderedFrameIndex) {
        drawFrame(frames[frameIndex], manifest, renderState);
        lastRenderedFrameIndex = frameIndex;
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
    renderState = updateRenderState(meta);
    running = autoplay;
    if (renderState) {
      drawFrame(frames[0], meta, renderState);
      lastRenderedFrameIndex = 0;
    }
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
