#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';

const DEFAULT_PRESET = {
  character: {
    scale: 1,
    spacing: 0,
    set: 'standard',
    customChars: ' .:+*#@',
    outputWidth: 0
  },
  image: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    sharpness: 0,
    gamma: 1,
    colorMode: 'color'
  },
  color: {
    colorMode: 'original',
    custom: '#ffbf00',
    useOriginal: false,
    intensity: 1,
    backgroundColor: '#000000'
  },
  advanced: {
    invert: false,
    brightnessMapping: 1,
    edgeEnhance: 0,
    blur: 0,
    quantizeColors: 0,
    spatialWeight: 0,
    matchQuality: 'fast'
  },
  postProcessing: {
    bloom: { enabled: true, threshold: 0.7, softThreshold: 0.5, intensity: 0.6, radius: 6 },
    grain: { enabled: true, intensity: 30, size: 2, speed: 75 },
    chromatic: { enabled: true, offset: 3 },
    scanlines: { enabled: true, opacity: 0.15, spacing: 3 },
    vignette: { enabled: false, intensity: 0.5, radius: 0.5 },
    crtCurve: { enabled: true, amount: 0.15 },
    phosphor: { enabled: true, color: 'amber', customColor: '#ffbf00' }
  }
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function loadPreset(presetArg) {
  if (!presetArg) return DEFAULT_PRESET;
  const content = readFileSync(resolve(presetArg), 'utf8');
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed) && parsed[0]?.settings) return parsed[0].settings;
  if (parsed?.settings) return parsed.settings;
  return parsed;
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function hashNoise(x, y, frame, speed) {
  let n = (x * 73856093) ^ (y * 19349663) ^ (Math.floor(frame * speed) * 83492791);
  n = (n << 13) ^ n;
  const value = 1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0;
  return value;
}

function boxBlur(input, width, height, radius) {
  if (radius <= 0) return input;
  const tmp = new Float32Array(input.length);
  const out = new Float32Array(input.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        sum += input[y * width + xx];
        count += 1;
      }
      tmp[y * width + x] = sum / count;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        sum += tmp[yy * width + x];
        count += 1;
      }
      out[y * width + x] = sum / count;
    }
  }

  return out;
}

function applyEffects(luma, width, height, preset, frameIndex, tone) {
  const out = new Float32Array(luma.length);
  out.set(luma);

  const gamma = preset?.image?.gamma ?? 1;
  if (gamma !== 1) {
    const invGamma = 1 / Math.max(0.001, gamma);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = clamp01(out[i] ** invGamma);
    }
  }

  const brightnessMapping = preset?.advanced?.brightnessMapping ?? 1;
  if (brightnessMapping !== 1) {
    for (let i = 0; i < out.length; i += 1) {
      out[i] = clamp01(out[i] ** Math.max(0.1, brightnessMapping));
    }
  }

  const bloom = preset?.postProcessing?.bloom;
  if (bloom?.enabled) {
    const threshold = bloom.threshold ?? 0.7;
    const intensity = (bloom.intensity ?? 0.6) * (tone.bloomStrength ?? 1);
    const radius = Math.max(1, Math.round((bloom.radius ?? 6) / 3));
    const bright = new Float32Array(out.length);
    for (let i = 0; i < out.length; i += 1) {
      bright[i] = out[i] > threshold ? (out[i] - threshold) / Math.max(0.001, 1 - threshold) : 0;
    }
    const blurred = boxBlur(bright, width, height, radius);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = clamp01(out[i] + blurred[i] * intensity * 0.45);
    }
  }

  const chromatic = preset?.postProcessing?.chromatic;
  if (chromatic?.enabled) {
    const shift = Math.max(1, Math.round((chromatic.offset ?? 3) / 2));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const left = y * width + Math.max(0, x - shift);
        const right = y * width + Math.min(width - 1, x + shift);
        const edge = Math.abs(out[left] - out[right]);
        out[i] = clamp01(out[i] + edge * 0.03);
      }
    }
  }

  const scanlines = preset?.postProcessing?.scanlines;
  if (scanlines?.enabled) {
    const spacing = Math.max(1, scanlines.spacing ?? 3);
    const opacity = clamp01(scanlines.opacity ?? 0.15);
    for (let y = 0; y < height; y += 1) {
      if (y % spacing !== 0) continue;
      const mul = 1 - opacity;
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        out[i] *= mul;
      }
    }
  }

  const crtCurve = preset?.postProcessing?.crtCurve;
  if (crtCurve?.enabled) {
    const amount = clamp01(crtCurve.amount ?? 0.15);
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / maxDist;
        const falloff = 1 - amount * d * d;
        out[i] = clamp01(out[i] * Math.max(0.65, falloff));
      }
    }
  }

  const grain = preset?.postProcessing?.grain;
  if (grain?.enabled) {
    const intensity = (grain.intensity ?? 30) / 255;
    const size = Math.max(1, Math.round(grain.size ?? 2));
    const speed = Math.max(1, grain.speed ?? 75) / 100;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cellX = Math.floor(x / size);
        const cellY = Math.floor(y / size);
        const noise = hashNoise(cellX, cellY, frameIndex, speed);
        const i = y * width + x;
        out[i] = clamp01(out[i] + noise * intensity * 0.25);
      }
    }
  }

  const blackPoint = tone.blackPoint ?? 0.08;
  const whitePoint = tone.whitePoint ?? 0.92;
  const outputGamma = tone.outputGamma ?? 1.2;
  const range = Math.max(0.001, whitePoint - blackPoint);
  for (let i = 0; i < out.length; i += 1) {
    const normalized = clamp01((out[i] - blackPoint) / range);
    out[i] = clamp01(normalized ** outputGamma);
  }

  return out;
}

function encodeKeyframeRle(frame, output) {
  let i = 0;
  while (i < frame.length) {
    let repeatLen = 1;
    while (i + repeatLen < frame.length && frame[i + repeatLen] === frame[i] && repeatLen < 127) {
      repeatLen += 1;
    }

    if (repeatLen >= 3) {
      output.push(repeatLen);
      output.push(frame[i]);
      i += repeatLen;
      continue;
    }

    const start = i;
    i += 1;
    while (i < frame.length) {
      repeatLen = 1;
      while (i + repeatLen < frame.length && frame[i + repeatLen] === frame[i] && repeatLen < 127) {
        repeatLen += 1;
      }
      if (repeatLen >= 3 || i - start >= 127) break;
      i += 1;
    }

    const literalLen = i - start;
    output.push(0x80 | literalLen);
    for (let k = start; k < i; k += 1) {
      output.push(frame[k]);
    }
  }
}

function encodeDeltaFrame(current, previous, output) {
  let i = 0;
  while (i < current.length) {
    const changed = current[i] !== previous[i];
    let len = 1;
    while (i + len < current.length && (current[i + len] !== previous[i + len]) === changed && len < 127) {
      len += 1;
    }

    output.push((changed ? 0x80 : 0x00) | len);
    if (changed) {
      for (let k = 0; k < len; k += 1) {
        output.push(current[i + k]);
      }
    }

    i += len;
  }
}

function getVideoInfo(inputPath) {
  const data = execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json',
    inputPath
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(data);
  const stream = parsed.streams?.[0] ?? {};
  const duration = Number.parseFloat(parsed.format?.duration ?? stream.duration ?? '0');
  return {
    width: Number(stream.width ?? 0),
    height: Number(stream.height ?? 0),
    duration: Number.isFinite(duration) ? duration : 0
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input ? resolve(args.input) : '';
  if (!input) {
    console.error('Missing --input <video-path>');
    process.exit(1);
  }

  const preset = loadPreset(args.preset);
  const rawCharset = args.chars || preset?.character?.customChars || ' .:+*#@';
  const normalizedCharset = rawCharset.includes(' ') ? rawCharset : ` ${rawCharset}`;
  const charset = normalizedCharset.split('');
  const fps = Number(args.fps ?? 15);
  const cols = Number(args.cols ?? 180);
  const keyframeEvery = Number(args.keyframeEvery ?? 30);
  const outDir = resolve(args.out ?? 'public/media/ascii-bike');
  const tintColor = '#ffbf00';
  const glyphAspect = Number(args.glyphAspect ?? 0.62);
  const tone = {
    blackPoint: Number(args.blackPoint ?? 0.08),
    whitePoint: Number(args.whitePoint ?? 0.92),
    outputGamma: Number(args.outputGamma ?? 1.2),
    bloomStrength: Number(args.bloomStrength ?? 0.7),
    phosphorStrength: Number(args.phosphorStrength ?? 0.82)
  };

  mkdirSync(outDir, { recursive: true });

  const videoInfo = getVideoInfo(input);
  const videoAspect = videoInfo.width > 0 && videoInfo.height > 0
    ? videoInfo.width / videoInfo.height
    : 16 / 9;
  const rows = args.rows
    ? Number(args.rows)
    : Math.max(24, Math.round((cols * glyphAspect) / videoAspect));
  const frameSize = cols * rows;

  const raw = execFileSync('ffmpeg', [
    '-v', 'error',
    '-i', input,
    '-vf', `fps=${fps},scale=${cols}:${rows}:flags=lanczos,format=gray`,
    '-f', 'rawvideo',
    '-pix_fmt', 'gray',
    'pipe:1'
  ], { maxBuffer: 1024 * 1024 * 1024 });

  const availableFrames = Math.floor(raw.length / frameSize);
  if (!availableFrames) {
    console.error('No frames extracted.');
    process.exit(1);
  }

  const encoded = [];
  let previous = null;
  let poster = '';

  for (let frameIndex = 0; frameIndex < availableFrames; frameIndex += 1) {
    const offset = frameIndex * frameSize;
    const luma = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i += 1) {
      luma[i] = raw[offset + i] / 255;
    }

    const effected = applyEffects(luma, cols, rows, preset, frameIndex, tone);
    const frame = new Uint8Array(frameSize);

    for (let i = 0; i < frameSize; i += 1) {
      const value = clamp01(effected[i]);
      const index = Math.round(value * (charset.length - 1));
      frame[i] = preset?.advanced?.invert ? (charset.length - 1 - index) : index;
    }

    if (frameIndex === 0) {
      const lines = [];
      for (let y = 0; y < rows; y += 1) {
        let line = '';
        for (let x = 0; x < cols; x += 1) {
          line += charset[frame[y * cols + x]];
        }
        lines.push(line);
      }
      poster = lines.join('\n');
    }

    const isKeyframe = frameIndex % keyframeEvery === 0 || !previous;
    encoded.push(isKeyframe ? 0 : 1);
    if (isKeyframe) {
      encodeKeyframeRle(frame, encoded);
    } else {
      encodeDeltaFrame(frame, previous, encoded);
    }

    previous = frame;
  }

  const encodedBuffer = Buffer.from(encoded);
  const compressed = brotliCompressSync(encodedBuffer, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      [zlibConstants.BROTLI_PARAM_LGWIN]: 22
    }
  });

  const durationMs = Math.round((availableFrames / fps) * 1000);
  const manifest = {
    version: 1,
    fps,
    cols,
    rows,
    durationMs,
    frameCount: availableFrames,
    charset: charset.join(''),
    colorMode: 'amber-phosphor',
    tintColor,
    phosphorStrength: tone.phosphorStrength,
    backgroundColor: '#000000',
    glyphAspect,
    videoAspect,
    encoding: 'delta-rle-v1',
    keyframeEvery,
    effects: preset.postProcessing,
    tone,
    source: {
      width: videoInfo.width,
      height: videoInfo.height,
      duration: videoInfo.duration
    }
  };

  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(resolve(outDir, 'frames.bin.br'), compressed);
  writeFileSync(resolve(outDir, 'poster.txt'), poster + '\n', 'utf8');

  const stats = {
    input,
    outDir,
    frameCount: availableFrames,
    fps,
    cols,
    rows,
    rawBytes: encodedBuffer.length,
    compressedBytes: compressed.length
  };

  writeFileSync(resolve(outDir, 'stats.json'), JSON.stringify(stats, null, 2));
  console.log(`ASCII video built: ${availableFrames} frames, ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
}

main();
