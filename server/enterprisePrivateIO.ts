import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * File-level protection for a managed enterprise root. Directory checks alone
 * do not prevent pre-existing state.json/events.jsonl/transcript symlinks or
 * hard links from writing into the company's independent Git repositories.
 * No-follow operations are intentionally POSIX-oriented (Linux/macOS).
 */
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;

export function readEnterprisePrivateFile(filename: string, limitBytes = 64 * 1024 * 1024): Buffer {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > limitBytes) {
      throw new Error('Enterprise private file is linked, non-regular, or exceeds the safety limit');
    }
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function appendEnterprisePrivateFile(filename: string, body: Buffer | string, limitBytes = 64 * 1024 * 1024): void {
  const content = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  if (content.length > 512 * 1024) throw new Error('Provider event exceeds the safety limit');
  const fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_APPEND
    | fs.constants.O_CREAT | NOFOLLOW, 0o600);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size + content.length > limitBytes) {
      throw new Error('Enterprise event log is linked, non-regular, or exceeds the safety limit');
    }
    let pos = 0;
    while (pos < content.length) {
      const written = fs.writeSync(fd, content, pos, content.length - pos);
      if (written === 0) throw new Error('Provider event write made no progress');
      pos += written;
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Replace via private temporary file and atomic rename; this never follows
 * the destination symlink/hardlink and does not mutate its external target.
 */
export function writeEnterprisePrivateAtomic(filename: string, body: string): void {
  const temp = path.join(path.dirname(filename), '.awb-tmp-' + randomUUID());
  try {
    fs.writeFileSync(temp, body, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, filename);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
