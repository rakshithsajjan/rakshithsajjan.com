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

type DecodeOptions = {
  onFirstFrame?: (frame: Uint8Array) => void;
  shouldStop?: () => boolean;
};

const fallbackPoster = 'ASCII preview unavailable';
const speedRampFirstLegMs = 1500;
const speedRampSecondLegMs = 2500;

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

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(resolve, { timeout: 50 });
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * Math.max(0, Math.min(1, progress));
}

function playbackSpeedFor(elapsedMs: number) {
  if (elapsedMs < speedRampFirstLegMs) {
    return lerp(0.2, 0.5, elapsedMs / speedRampFirstLegMs);
  }

  const secondLegElapsed = elapsedMs - speedRampFirstLegMs;
  if (secondLegElapsed < speedRampSecondLegMs) {
    return lerp(0.5, 1, secondLegElapsed / speedRampSecondLegMs);
  }

  return 1;
}

async function fetchManifest(url: string, signal?: AbortSignal): Promise<Manifest> {
  const response = await fetch(url, { credentials: 'same-origin', signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as Manifest;
}

async function fetchBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, { credentials: 'same-origin', signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function loadPoster(posterUrl: string, signal?: AbortSignal) {
  const response = await fetch(posterUrl, { credentials: 'same-origin', signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${posterUrl}: ${response.status}`);
  }
  return response.text();
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

async function decodeFrames(payload: Uint8Array, manifest: Manifest, options: DecodeOptions = {}) {
  if (manifest.encoding !== 'delta-rle-v1') {
    throw new Error(`Unsupported ASCII frame encoding: ${manifest.encoding}`);
  }

  const frames: Uint8Array[] = [];
  const frameSize = manifest.cols * manifest.rows;
  let cursor = 0;
  let previous: Uint8Array | null = null;
  let lastYield = nowMs();

  while (cursor < payload.length && frames.length < manifest.frameCount) {
    if (options.shouldStop?.()) {
      throw new Error('ASCII player destroyed before decode completed');
    }

    const frameType = payload[cursor++];
    if (frameType === 0 || !previous) {
      const decoded = decodeKeyframe(payload, cursor, frameSize);
      frames.push(decoded.frame);
      previous = decoded.frame;
      cursor = decoded.nextOffset;
    } else if (frameType === 1) {
      const decoded = decodeDelta(payload, cursor, previous);
      frames.push(decoded.frame);
      previous = decoded.frame;
      cursor = decoded.nextOffset;
    } else {
      throw new Error(`Unknown frame type: ${frameType}`);
    }

    if (frames.length === 1) {
      options.onFirstFrame?.(frames[0]);
    }

    if (frames.length % 4 === 0 || nowMs() - lastYield > 8) {
      await yieldToBrowser();
      lastYield = nowMs();
    }
  }

  if (frames.length !== manifest.frameCount) {
    throw new Error(`Expected ${manifest.frameCount} frames, decoded ${frames.length}`);
  }

  return frames;
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
    return () => {};
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return () => {};
  }

  posterNode.hidden = false;
  canvas.hidden = true;

  const reducedMotion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  if (
    reducedMotion.matches ||
    typeof window.fetch !== 'function' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    return () => {};
  }

  let manifest: Manifest | null = null;
  let frames: Uint8Array[] = [];
  let animationReady = false;
  let running = false;
  let isVisible = typeof document.visibilityState === 'undefined' || document.visibilityState === 'visible';
  let inViewport = true;
  let isDestroyed = false;
  let rafId = 0;
  let frameIndex = 0;
  let frameStepMs = 1000 / 15;
  let lastTick = 0;
  let rampElapsedMs = 0;
  let frameElapsedMs = 0;
  let lastRenderedFrame = -1;
  let layoutDirty = true;
  let canvasCssWidth = 0;
  let canvasCssHeight = 0;
  let canvasPixelWidth = 0;
  let canvasPixelHeight = 0;
  let canvasDpr = 0;

  const abortController = typeof AbortController === 'function'
    ? new AbortController()
    : null;

  function showPoster(text?: string) {
    if (text && text.length > 0) {
      posterNode.textContent = text;
    }
    posterNode.hidden = false;
    canvas.hidden = true;
    running = false;
    lastTick = 0;
    rampElapsedMs = 0;
    frameElapsedMs = 0;
  }

  function showCanvas() {
    posterNode.hidden = true;
    canvas.hidden = false;
  }

  function drawFrame(frame: Uint8Array | undefined, meta: Manifest) {
    if (!frame) return false;

    const width = Math.round(container.clientWidth);
    const height = Math.round(container.clientHeight);
    if (width < 1 || height < 1) return false;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    if (
      pixelWidth !== canvasPixelWidth ||
      pixelHeight !== canvasPixelHeight ||
      width !== canvasCssWidth ||
      height !== canvasCssHeight ||
      dpr !== canvasDpr
    ) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvasPixelWidth = pixelWidth;
      canvasPixelHeight = pixelHeight;
      canvasCssWidth = width;
      canvasCssHeight = height;
      canvasDpr = dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

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
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${phosphorStrength})`;
    ctx.font = `${fontSize}px "Courier New", Courier, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    const measuredGlyph = Math.max(0.0001, ctx.measureText('M').width);
    const cellWidth = coverWidth / meta.cols;
    const scaleX = cellWidth / measuredGlyph;
    ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
    ctx.shadowBlur = 4;

    const chars = meta.charset;
    const rowBuffer = new Array(meta.cols);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scaleX, 1);
    for (let y = 0; y < meta.rows; y += 1) {
      const rowStart = y * meta.cols;
      for (let x = 0; x < meta.cols; x += 1) {
        rowBuffer[x] = chars[frame[rowStart + x]] ?? ' ';
      }
      ctx.fillText(rowBuffer.join(''), 0, y * lineHeight);
    }
    ctx.restore();

    layoutDirty = false;
    return true;
  }

  function renderCurrentFrame(force = false) {
    if (!manifest || frames.length === 0) return false;

    const currentIndex = Math.min(frameIndex, frames.length - 1);
    if (!force && !layoutDirty && lastRenderedFrame === currentIndex) {
      return true;
    }

    const didDraw = drawFrame(frames[currentIndex], manifest);
    if (didDraw) {
      lastRenderedFrame = currentIndex;
      if (canvas.hidden) showCanvas();
    }
    return didDraw;
  }

  function stopLoop() {
    if (!rafId) return;
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function tick(now: number) {
    rafId = 0;

    if (!animationReady || !running || !isVisible || !inViewport || isDestroyed) {
      return;
    }

    if (!lastTick) {
      lastTick = now;
      renderCurrentFrame();
      startLoop();
      return;
    }

    const elapsed = now - lastTick;
    lastTick = now;
    const speed = playbackSpeedFor(rampElapsedMs);
    rampElapsedMs += elapsed;
    frameElapsedMs += elapsed * speed;

    if (frameElapsedMs >= frameStepMs) {
      const steps = Math.max(1, Math.floor(frameElapsedMs / frameStepMs));
      frameIndex += steps;
      if (loop) {
        frameIndex %= frames.length;
      } else if (frameIndex >= frames.length) {
        frameIndex = frames.length - 1;
          running = false;
        }
      frameElapsedMs -= steps * frameStepMs;
      renderCurrentFrame();
    }

    if (running) startLoop();
  }

  function startLoop() {
    if (rafId || isDestroyed) return;
    rafId = window.requestAnimationFrame(tick);
  }

  function resumeAnimation() {
    if (!animationReady || reducedMotion.matches || !autoplay || !isVisible || !inViewport) {
      return;
    }
    running = true;
    startLoop();
  }

  const visibilityHandler = () => {
    isVisible = typeof document.visibilityState === 'undefined' || document.visibilityState === 'visible';
    if (!isVisible) {
      running = false;
      lastTick = 0;
      stopLoop();
      return;
    }
    resumeAnimation();
  };

  const viewportHandler = (entries: IntersectionObserverEntry[]) => {
    inViewport = entries[0]?.isIntersecting ?? true;
    if (!inViewport) {
      running = false;
      lastTick = 0;
      stopLoop();
      return;
    }
    resumeAnimation();
  };

  const resizeHandler = () => {
    layoutDirty = true;
    renderCurrentFrame(true);
  };

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(viewportHandler, { threshold: 0.1 });
    observer.observe(container);
  }

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(resizeHandler);
    resizeObserver.observe(container);
  } else {
    window.addEventListener('resize', resizeHandler);
  }

  document.addEventListener('visibilitychange', visibilityHandler);

  const pageHideHandler = (event: PageTransitionEvent) => {
    if (event.persisted) {
      running = false;
      lastTick = 0;
      stopLoop();
      return;
    }
    cleanup();
  };

  const pageShowHandler = (event: PageTransitionEvent) => {
    if (isDestroyed || !event.persisted) return;
    layoutDirty = true;
    renderCurrentFrame(true);
    resumeAnimation();
  };

  const cleanup = () => {
    if (isDestroyed) return;
    isDestroyed = true;
    abortController?.abort();
    stopLoop();
    observer?.disconnect();
    resizeObserver?.disconnect();
    if (!resizeObserver) {
      window.removeEventListener('resize', resizeHandler);
    }
    document.removeEventListener('visibilitychange', visibilityHandler);
    window.removeEventListener('pagehide', pageHideHandler);
    window.removeEventListener('pageshow', pageShowHandler);
    window.removeEventListener('beforeunload', cleanup);
  };

  window.addEventListener('pagehide', pageHideHandler);
  window.addEventListener('pageshow', pageShowHandler);
  window.addEventListener('beforeunload', cleanup);

  Promise.all([
    fetchManifest(manifestUrl, abortController?.signal),
    fetchBytes(framesUrl, abortController?.signal)
  ]).then(async ([meta, payload]) => {
    if (isDestroyed) return;

    manifest = meta;
    frameStepMs = 1000 / Math.max(1, meta.fps || 15);

    const decodedFrames = await decodeFrames(payload, meta, {
      onFirstFrame: (frame) => {
        if (isDestroyed) return;
        frames = [frame];
        frameIndex = 0;
        renderCurrentFrame(true);
      },
      shouldStop: () => isDestroyed
    });

    if (isDestroyed) return;
    frames = decodedFrames;
    animationReady = true;
    frameIndex = 0;
    lastTick = 0;
    rampElapsedMs = 0;
    frameElapsedMs = 0;
    renderCurrentFrame(true);
    resumeAnimation();
  }).catch(async (error) => {
    if (isDestroyed) return;
    console.warn('ASCII player fallback to poster:', error);

    const existingPoster = posterNode.textContent ?? '';
    if (existingPoster.length > 0) {
      showPoster();
      return;
    }

    const posterText = await loadPoster(posterUrl, abortController?.signal).catch(() => fallbackPoster);
    showPoster(posterText);
  });

  return cleanup;
}
