import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { APP_ROOT, getDataDir } from './config.ts';

function binary(): string { return path.join(getDataDir(), 'secure-bin', 'awb-secret-store'); }
function source(): string { return path.join(APP_ROOT, 'scripts', 'awb-secret-store.c'); }
function ensureBinary(): string {
  const target = binary(); if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(source()).mtimeMs) return target;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const flags = execFileSync('pkg-config', ['--cflags', '--libs', 'libsecret-1'], { encoding: 'utf8' }).trim().split(/\s+/);
  execFileSync('gcc', [source(), '-O2', '-o', target, ...flags], { stdio: ['ignore', 'ignore', 'ignore'] });
  fs.chmodSync(target, 0o700); return target;
}
function run(action: 'set' | 'get' | 'delete' | 'has', provider: string, field: string, secret?: string): string | null {
  if (!/^[a-z0-9-]+$/i.test(provider) || !/^[A-Z0-9_]+$/.test(field)) throw new Error('invalid credential identifier');
  try { return execFileSync(ensureBinary(), [action, provider, field], { input: secret, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 8000 }); }
  catch (error) { const code = (error as { status?: number }).status; if ((action === 'get' || action === 'has') && code === 2) return null; throw new Error('OS secure credential store is unavailable'); }
}
export const credentialStore = {
  save(provider: string, field: string, secret: string): void { if (!secret) throw new Error('credential is required'); run('set', provider, field, secret); },
  get(provider: string, field: string): string | null { return run('get', provider, field); },
  delete(provider: string, field: string): void { run('delete', provider, field); },
  has(provider: string, field: string): boolean { return run('has', provider, field) !== null; },
  listConfiguredFields(provider: string, fields: string[]): string[] { return fields.filter((field) => this.has(provider, field)); },
};
