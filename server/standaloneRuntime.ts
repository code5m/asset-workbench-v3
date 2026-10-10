import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { loadConfig, APP_ROOT } from './config.ts';
import { assetService } from './assetService.ts';
import { createHandler } from './assetPlugin.ts';

const bindHost = '127.0.0.1';
const token = process.env.AWB_RUNTIME_TOKEN;
const releaseId = process.env.AWB_RELEASE_ID;
const uiDir = process.env.AWB_RELEASE_UI_DIR;
const port = Number(process.env.AWB_RUNTIME_PORT);
if (!token || !releaseId || !uiDir || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Standalone runtime requires a release, local port and private health token');
}
const root = fs.realpathSync(uiDir);
const config = loadConfig();
if (!config.lockedToInstance || !config.instanceId) {
  throw new Error('Standalone runtime requires a valid, locked business Instance');
}
const api = createHandler();
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
function respond(res: http.ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
const server = http.createServer(async (req, res) => {
  const host = req.headers.host || '';
  if (host !== bindHost + ':' + port) {
    respond(res, 403, { error: 'Invalid local Host header' });
    return;
  }
  const origin = req.headers.origin;
  if (origin && origin !== 'http://' + host) {
    respond(res, 403, { error: 'Cross-origin actions are not allowed' });
    return;
  }
  const requested = req.url || '/';
  let url: URL;
  try { url = new URL(requested, 'http://' + host); }
  catch { respond(res, 400, { error: 'Invalid request URL' }); return; }

  if (url.pathname === '/_runtime/health') {
    if (req.headers['x-awb-runtime-token'] !== token) {
      respond(res, 403, { error: 'Health access denied' }); return;
    }
    respond(res, 200, {
      status: 'ready', projectRoot: config.projectRoot, instanceId: config.instanceId,
      releaseId, pid: process.pid,
    });
    return;
  }

  // Central-only lifecycle and workspace retargeting cannot be invoked inside a bound Instance.
  if (url.pathname.startsWith('/api/creator/') || url.pathname === '/api/workspace/root') {
    respond(res, 403, { error: 'This action is available only in central Framework management' });
    return;
  }
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const original = req.url;
    req.url = (original || '').slice(4) || '/';
    try {
      await api(req as never, res, () => respond(res, 404, { error: 'Unknown API endpoint' }));
    } catch {
      if (!res.headersSent) respond(res, 500, { error: 'Local API failed' });
      else res.end();
    } finally { req.url = original; }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    respond(res, 405, { error: 'Read-only static server' }); return;
  }

  let normalized: string;
  try { normalized = decodeURIComponent(url.pathname); }
  catch { respond(res, 400, { error: 'Invalid path encoding' }); return; }
  if (normalized.includes('\0') || normalized.split('/').includes('..') || normalized.includes('\\')) {
    respond(res, 400, { error: 'Invalid static file path' }); return;
  }
  const candidate = path.resolve(root, '.' + normalized);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    respond(res, 403, { error: 'Path escaped static root' }); return;
  }
  let target = candidate;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    if (normalized.startsWith('/assets/')) {
      respond(res, 404, { error: 'Asset not found' }); return;
    }
    target = path.join(root, 'index.html');
  }
  try {
    const actual = fs.realpathSync(target);
    if (!actual.startsWith(root + path.sep)) throw new Error('Symlink escaped static root');
    const stat = fs.statSync(actual);
    res.writeHead(200, {
      'content-type': contentTypes[path.extname(actual)] || 'application/octet-stream',
      'content-length': stat.size,
      'x-content-type-options': 'nosniff',
      'cache-control': actual.includes(path.sep + 'assets' + path.sep)
        ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(actual).on('error', () => res.destroy()).pipe(res);
  } catch {
    if (!res.headersSent) respond(res, 404, { error: 'Static file not found' });
  }
});
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
await assetService.scan();
assetService.startWatcher();
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, bindHost, resolve);
});
