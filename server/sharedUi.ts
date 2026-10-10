import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { randomBytes, createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { ViteDevServer } from 'vite';
import { APP_ROOT } from './config.ts';
import { currentFrameworkRelease, releasePath } from './frameworkRelease.ts';

/**
 * UI is a SINGLE central resource, not a file bundled into an Instance's
 * pinned backend. In dev: instances proxy the live Vite UI (including HMR).
 * In a built installation: instances serve the central dist/ directory.
 * Only if dist is absent, use the CURRENT central release UI, never the
 * Instance's old/pinned release. Missing sources fail closed (503).
 *
 * All /api requests stay on the Instance origin, preserving project identity.
 */
export const SHARED_UI_DELIVERY = 'central-shared-ui-v1';
export const SHARED_UI_DIR = path.join(APP_ROOT, '.asset-workbench-data', 'shared-ui');
export const DEV_SOURCE_FILE = path.join(SHARED_UI_DIR, 'dev-source.json');

type DevSource = { port: number; token: string; pid: number };
type StaticUi = { root: string; kind: 'central-build' | 'central-release' };
export type UiSource = { kind: 'central-dev'; dev: DevSource } | StaticUi | { kind: 'unavailable' };
const expectedHost = '127.0.0.1';
let checked: { at: number; dev: DevSource | null; marker: string } | null = null;

function sourceFile(): DevSource | null {
  try {
    const v = JSON.parse(fs.readFileSync(DEV_SOURCE_FILE, 'utf8')) as Partial<DevSource>;
    if (!Number.isInteger(v.port) || (v.port ?? 0) < 1 || (v.port ?? 0) > 65535
      || !Number.isInteger(v.pid) || !/^[a-f0-9]{64}$/.test(v.token || '')) return null;
    return v as DevSource;
  } catch { return null; }
}
function writeDevSource(source: DevSource): void {
  fs.mkdirSync(SHARED_UI_DIR, { recursive: true, mode: 0o700 });
  const temp = DEV_SOURCE_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(source) + '\n', { mode: 0o600 });
  fs.renameSync(temp, DEV_SOURCE_FILE);
}
function removeDevSource(token: string): void {
  try {
    if (sourceFile()?.token === token) fs.unlinkSync(DEV_SOURCE_FILE);
  } catch { /* another dev process may have replaced the pointer */ }
}

/** Called only by the central Vite dev server, not preview or an Instance. */
export function registerCentralDevUi(server: ViteDevServer): void {
  if (process.env.AWB_INSTANCE_PROJECT_ROOT) return;
  const token = randomBytes(32).toString('hex');
  server.middlewares.use('/_awb/shared-ui-health', (req, res) => {
    const host = req.headers.host;
    if (req.headers['x-awb-shared-ui-token'] !== token
      || host !== '127.0.0.1:' + (server.httpServer?.address() as net.AddressInfo | null)?.port) {
      res.writeHead(403, { 'cache-control': 'no-store' });
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-awb-shared-ui-health': 'v1',
    });
    res.end('AWB_SHARED_UI_V1');
  });
  const listener = () => {
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') return;
    writeDevSource({ port: address.port, pid: process.pid, token });
    checked = null;
  };
  server.httpServer?.on('listening', listener);
  if (server.httpServer?.listening) listener();
  server.httpServer?.on('close', () => { removeDevSource(token); checked = null; });
}

async function healthyDev(): Promise<DevSource | null> {
  const source = sourceFile();
  const marker = source ? `${source.pid}:${source.port}:${source.token}` : '';
  if (checked && checked.marker === marker && Date.now() - checked.at < 500) return checked.dev;
  if (!source) { checked = { at: Date.now(), dev: null, marker }; return null; }
  try {
    const response = await fetch(`http://127.0.0.1:${source.port}/_awb/shared-ui-health`, {
      headers: { 'x-awb-shared-ui-token': source.token },
      signal: AbortSignal.timeout(500),
    });
    const valid = response.ok && response.headers.get('x-awb-shared-ui-health') === 'v1';
    checked = { at: Date.now(), dev: valid ? source : null, marker };
    return valid ? source : null;
  } catch {
    checked = { at: Date.now(), dev: null, marker };
    return null;
  }
}

function staticUi(): StaticUi | null {
  const built = path.join(APP_ROOT, 'dist');
  if (fs.existsSync(path.join(built, 'index.html'))) {
    return { kind: 'central-build', root: fs.realpathSync(built) };
  }
  const current = currentFrameworkRelease();
  if (current) {
    const dir = path.join(releasePath(current.releaseId), 'ui');
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return { kind: 'central-release', root: fs.realpathSync(dir) };
    }
  }
  return null;
}
export async function resolveUiSource(): Promise<UiSource> {
  const dev = await healthyDev();
  if (dev) return { kind: 'central-dev', dev };
  return staticUi() ?? { kind: 'unavailable' };
}

export function sharedUiHeaders(kind: UiSource['kind']): Record<string, string> {
  return { 'x-awb-ui-source': kind, 'x-content-type-options': 'nosniff' };
}

export async function proxyCentralDevUi(
  req: IncomingMessage, res: ServerResponse, dev: DevSource,
): Promise<void> {
  return new Promise((resolve) => {
    const headers = { ...req.headers, host: `${expectedHost}:${dev.port}` };
    delete headers.origin;
    const upstream = http.request({
      hostname: expectedHost, port: dev.port, method: req.method, path: req.url,
      headers,
    }, (answer) => {
      const forwarded = { ...answer.headers, ...sharedUiHeaders('central-dev'), 'cache-control': 'no-store' };
      res.writeHead(answer.statusCode ?? 502, forwarded);
      answer.pipe(res);
      answer.once('end', resolve);
      answer.once('error', () => { res.destroy(); resolve(); });
    });
    upstream.once('error', () => {
      if (!res.headersSent) {
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        res.end('Shared central UI temporarily unavailable; retry after central UI starts.');
      } else res.destroy();
      resolve();
    });
    upstream.end();
  });
}

export async function proxyCentralDevUpgrade(
  req: IncomingMessage, socket: Duplex, head: Buffer,
): Promise<void> {
  if (req.url?.startsWith('/api') || req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }
  const dev = await healthyDev();
  if (!dev) { socket.destroy(); return; }
  const headers = { ...req.headers, host: `${expectedHost}:${dev.port}` };
  const upstream = http.request({
    hostname: expectedHost, port: dev.port, path: req.url,
    method: 'GET', headers,
  });
  upstream.once('upgrade', (reply, remote, remoteHead) => {
    const rawHeaders = reply.rawHeaders;
    let response = `HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n`;
    for (let i = 0; i < rawHeaders.length; i += 2) {
      response += `${rawHeaders[i]}: ${rawHeaders[i + 1]}\r\n`;
    }
    socket.write(response + '\r\n');
    if (remoteHead.length) socket.write(remoteHead);
    if (head.length) remote.write(head);
    remote.pipe(socket).pipe(remote);
    remote.on('error', () => socket.destroy());
    socket.on('error', () => remote.destroy());
  });
  upstream.once('response', () => socket.destroy());
  upstream.once('error', () => socket.destroy());
  upstream.end();
}

/** Stable identifier for parity diagnostics without leaking the project path. */
export function sharedUiRevision(ui: UiSource): string {
  if (ui.kind === 'unavailable') return 'unavailable';
  if (ui.kind === 'central-dev') return `vite:${ui.dev.pid}:${ui.dev.port}`;
  const index = fs.readFileSync(path.join(ui.root, 'index.html'));
  return 'sha256:' + createHash('sha256').update(index).digest('hex').slice(0, 20);
}
