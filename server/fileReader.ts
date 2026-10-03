import fs from 'node:fs';
import { resolveWithinRoot, assertWithinRoot } from './pathGuard.ts';
import type { AssetContent } from '../src/domain/asset';

/**
 * File content reader with a single, centralized text-preview policy.
 *
 * - A hard size ceiling prevents pushing huge files to the browser.
 * - Known binary extensions are rejected up front.
 * - A NUL-byte scan rejects files that merely lack a known extension.
 * Files are read read-only and only after a path-safety check.
 */

export const TEXT_PREVIEW_LIMIT = 1024 * 1024; // 1 MB

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
  try {
    stat = fs.statSync(abs);
  } catch {
    throw new Error(`file not found: ${relativePath}`);
  }
  if (stat.isDirectory()) {
    throw new Error(`not a file: ${relativePath}`);
  }

  const id = relativePath;
  if (stat.size > TEXT_PREVIEW_LIMIT) {
    return { id, path: relativePath, previewable: false, truncated: false, size: stat.size, reason: 'file too large to preview' };
  }
  if (BINARY_EXT.has(extOf(relativePath))) {
    return { id, path: relativePath, previewable: false, truncated: false, size: stat.size, reason: 'binary file' };
  }

  const buf = fs.readFileSync(abs);
  if (buf.includes(0)) {
    return { id, path: relativePath, previewable: false, truncated: false, size: stat.size, reason: 'binary content' };
  }

  let content = buf.toString('utf8');
  let truncated = false;
  if (content.length > TEXT_PREVIEW_LIMIT) {
    content = content.slice(0, TEXT_PREVIEW_LIMIT);
    truncated = true;
  }
  return { id, path: relativePath, previewable: true, truncated, size: stat.size, content };
}
