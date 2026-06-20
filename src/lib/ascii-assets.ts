import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));
const asciiDir = '/media/ascii-bike';

export type AsciiAssetUrls = {
  manifestUrl: string;
  framesUrl: string;
  posterUrl: string;
};

function publicPathFor(assetUrl: string) {
  const pathname = assetUrl.split('?')[0].replace(/^\/+/, '');
  return join(publicDir, pathname);
}

export function versionPublicAsset(assetUrl: string) {
  const filePath = publicPathFor(assetUrl);
  const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 12);
  return `${assetUrl}?v=${hash}`;
}

export function readPublicTextAsset(assetUrl: string) {
  const filePath = publicPathFor(assetUrl);
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf8');
}

export function getAsciiAssetUrls(): AsciiAssetUrls {
  return {
    manifestUrl: versionPublicAsset(`${asciiDir}/manifest.json`),
    framesUrl: versionPublicAsset(`${asciiDir}/frames.bin`),
    posterUrl: versionPublicAsset(`${asciiDir}/poster.txt`)
  };
}
