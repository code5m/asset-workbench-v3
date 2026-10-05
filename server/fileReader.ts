import fs from 'node:fs';
import { resolveWithinRoot, assertWithinRoot } from './pathGuard.ts';
import type { AssetContent } from '../src/domain/asset';

export const TEXT_PREVIEW_LIMIT = 256 * 1024; // read at most 256 KiB into memory

const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'mp3', 'mp4', 'avi',
  'mov', 'mkv', 'zip', 'gz', 'tgz', 'tar', 'xz', '7z', 'rar', 'pdf',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'class', 'exe', 'dll', 'so', 'o',
  'a', 'bin', 'dat', 'db', 'sqlite', 'sqlite3', 'wasm', 'jar',
]);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function readAssetContent(root: string, relativePath: string): AssetContent {
  const abs = resolveWithinRoot(root, relativePath);
  assertWithinRoot(root, abs);

  let stat: fs.Stats;
  try { stat = fs.statSync(abs); } catch { throw new Error(`file not found: ${relativePath}`); }
  if (stat.isDirectory()) throw new Error(`not a file: ${relativePath}`);

  const id = relativePath;
  if (BINARY_EXT.has(extOf(relativePath))) {
    return { id, path: relativePath, previewable: false, truncated: false, size: stat.size, reason: 'binary file' };
  }

  const bytesToRead = Math.min(stat.size, TEXT_PREVIEW_LIMIT);
  const buf = Buffer.allocUnsafe(bytesToRead);
  let fd: number | undefined;
  let bytesRead = 0;
  try {
    fd = fs.openSync(abs, 'r');
    bytesRead = bytesToRead > 0 ? fs.readSync(fd, buf, 0, bytesToRead, 0) : 0;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  const slice = buf.subarray(0, bytesRead);
  if (slice.includes(0)) {
    return { id, path: relativePath, previewable: false, truncated: false, size: stat.size, reason: 'binary content' };
  }

  return {
    id,
    path: relativePath,
    previewable: true,
    truncated: stat.size > bytesRead,
    size: stat.size,
    content: slice.toString('utf8'),
  };
}
