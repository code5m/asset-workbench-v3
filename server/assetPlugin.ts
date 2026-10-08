import type { Plugin, Connect, ViteDevServer, PreviewServer } from 'vite';
import { assetService } from './assetService.ts';
import { getProjectRoot, loadConfig } from './config.ts';
import type { ServerEvent } from '../src/domain/asset';
import {
  createConversation,
  createDesign,
  createDecision,
  createTranscript,
  promoteConversationToDesign,
  promoteDesignToDecision,
  getManagedAssetByPath,
  ConflictError,
  InvalidInputError,
  NotFoundError,
  WriteError,
} from './managedAssetService.ts';
import { WritePolicyError } from './managedPathPolicy.ts';
import { PathEscapeError } from './pathGuard.ts';
import {
  appendCaptureEvents,
  CaptureConflictError,
  CaptureError,
  CaptureNotFoundError,
  createCaptureSession,
  endCaptureSession,
  getCaptureSession,
} from './captureService.ts';
import { detectProviders } from './providerAdapterService.ts';
import { deleteCredentials, deleteCustomDefinition, getProviderDetail, listProviderDefinitions, listProviderStatuses, redetectProviderStatuses, runProviderVerification, saveCredentials, saveCustomDefinition, setProviderEnabled, verifyProviderAuth } from './providerPlatformService.ts';
import { isLocalApiRequest, MAX_API_BODY_BYTES } from './localApiSecurity.ts';
import { createKnowledge, verifyKnowledge } from '../packages/starter/src/index.ts';
import {
  applyInstanceUpgrade,
  createInstance,
  frameworkIdentity,
  instanceStatus,
  planInstanceUpgrade,
  rollbackInstance,
  verifyInstance,
} from '../packages/creator-core/src/index.ts';

/**
 * Vite plugin that mounts the Local Asset API under /api.
 *
 * The React frontend talks to these endpoints; it never touches the filesystem
 * directly. The same plugin is mounted in dev (configureServer) and preview
 * (configurePreviewServer) so the build can also be verified against real data.
 */

function readBodyRaw(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer | string) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_API_BODY_BYTES) {
        reject(new InvalidInputError('request body too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: any, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** Map a thrown error to the correct HTTP status for managed-asset operations. */
function errorStatus(e: unknown): number {
  if (e instanceof InvalidInputError) return 400;
  if (e instanceof PathEscapeError || e instanceof WritePolicyError) return 400;
  if (e instanceof NotFoundError) return 404;
  if (e instanceof ConflictError) return 409;
  if (e instanceof WriteError) return 500;
  return 500;
}

function captureErrorStatus(e: unknown): number {
  if (e instanceof CaptureNotFoundError) return 404;
  if (e instanceof CaptureConflictError) return 409;
  if (e instanceof CaptureError) return 400;
  return 500;
}

async function readBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  try {
    const raw = await readBodyRaw(req);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new InvalidInputError('invalid JSON body');
  }
}

function createHandler() {
  return async function handler(
    req: Connect.IncomingMessage,
    res: any,
    next: () => void,
  ): Promise<void> {
    const url = req.url ?? '';
    const [pathPart, query] = url.split('?');
    try {
      if (!isLocalApiRequest(req)) {
        sendJson(res, 403, { error: 'Local Asset API accepts loopback connections only.' });
        return;
      }
      if (req.method === 'GET' && pathPart === '/workspace') {
        await assetService.ensureScanned();
        sendJson(res, 200, assetService.getWorkspace());
        return;
      }
      if (req.method === 'GET' && pathPart === '/workspace/tree') {
        await assetService.ensureScanned();
        const parent = new URLSearchParams(query).get('path') ?? '';
        sendJson(res, 200, assetService.getTree(decodeURIComponent(parent)));
        return;
      }
      if (req.method === 'GET' && pathPart === '/assets/content') {
        await assetService.ensureScanned();
        const id = new URLSearchParams(query).get('id') ?? '';
        sendJson(res, 200, assetService.getContent(decodeURIComponent(id)));
        return;
      }
      if (req.method === 'GET' && pathPart === '/repositories') {
        await assetService.ensureScanned();
        sendJson(res, 200, assetService.getRepositories());
        return;
      }
      if (req.method === 'GET' && pathPart === '/workspace/skeleton') {
        await assetService.ensureScanned();
        sendJson(res, 200, assetService.getExpectedSkeleton());
        return;
      }
      if (req.method === 'GET' && pathPart === '/config') {
        sendJson(res, 200, { ...loadConfig(), configurable: true });
        return;
      }
      if (req.method === 'GET' && pathPart === '/providers') {
        sendJson(res, 200, listProviderStatuses());
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/knowledge/create') {
        try {
          const body = await readBody(req);
          const target = typeof body.target === 'string' ? body.target.trim() : '';
          const name = typeof body.name === 'string' ? body.name.trim() : undefined;
          if (!target) {
            sendJson(res, 400, { error: 'target is required' });
            return;
          }
          sendJson(res, 201, createKnowledge({ target, name }));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/knowledge/verify') {
        try {
          const body = await readBody(req);
          const target = typeof body.target === 'string' ? body.target.trim() : '';
          if (!target) {
            sendJson(res, 400, { error: 'target is required' });
            return;
          }
          const result = verifyKnowledge(target);
          sendJson(res, result.ok ? 200 : 422, result);
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/instance/create') {
        try {
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot.trim() : '';
          const name = typeof body.name === 'string' ? body.name.trim() : undefined;
          const initializeKnowledge = body.initializeKnowledge === true;
          if (!projectRoot) {
            sendJson(res, 400, { error: 'projectRoot is required' });
            return;
          }
          const cfg = loadConfig();
          const result = createInstance({
            projectRoot,
            name,
            initializeKnowledge,
            framework: frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision),
            frameworkRoot: cfg.appRoot,
          });
          sendJson(res, 201, result);
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/instance/status') {
        try {
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot.trim() : '';
          if (!projectRoot) {
            sendJson(res, 400, { error: 'projectRoot is required' });
            return;
          }
          const cfg = loadConfig();
          sendJson(res, 200, instanceStatus(projectRoot, frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision)));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/instance/verify') {
        try {
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot.trim() : '';
          if (!projectRoot) {
            sendJson(res, 400, { error: 'projectRoot is required' });
            return;
          }
          const cfg = loadConfig();
          const result = verifyInstance(projectRoot, frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision));
          sendJson(res, result.ok ? 200 : 422, result);
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/instance/upgrade/plan') {
        try {
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot.trim() : '';
          if (!projectRoot) {
            sendJson(res, 400, { error: 'projectRoot is required' });
            return;
          }
          const cfg = loadConfig();
          sendJson(res, 201, planInstanceUpgrade(projectRoot, frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision)));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/instance/upgrade/apply') {
        try {
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot.trim() : '';
          const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
          if (!projectRoot || !planId) {
            sendJson(res, 400, { error: 'projectRoot and planId are required' });
            return;
          }
          const result = applyInstanceUpgrade(projectRoot, planId);
          sendJson(res, 200, result);
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/instance/rollback') {
        try {
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot.trim() : '';
          const migrationId = typeof body.migrationId === 'string' ? body.migrationId.trim() : undefined;
          if (!projectRoot) {
            sendJson(res, 400, { error: 'projectRoot is required' });
            return;
          }
          sendJson(res, 200, rollbackInstance(projectRoot, migrationId));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      // Backward-compatible Knowledge Init route. New UI/CLI should use Creator endpoints.
      if (req.method === 'POST' && pathPart === '/starter/create') {
        try {
          const body = await readBody(req);
          const target = typeof body.target === 'string' ? body.target.trim() : '';
          const name = typeof body.name === 'string' ? body.name.trim() : undefined;
          if (!target) {
            sendJson(res, 400, { error: 'target is required' });
            return;
          }
          sendJson(res, 201, createKnowledge({ target, name }));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }
      if (req.method === 'POST' && pathPart === '/provider-manager/redetect') {
        sendJson(res, 200, redetectProviderStatuses());
        return;
      }
      if (req.method === 'GET' && pathPart === '/provider-manager/definitions') { sendJson(res, 200, { definitions: listProviderDefinitions() }); return; }
      const providerDetail = pathPart.match(/^\/provider-manager\/providers\/([^/]+)$/);
      if (req.method === 'GET' && providerDetail) { try { sendJson(res, 200, getProviderDetail(decodeURIComponent(providerDetail[1]))); } catch (e) { sendJson(res, 404, { error: (e as Error).message }); } return; }
      const providerAction = pathPart.match(/^\/provider-manager\/providers\/([^/]+)\/(credentials|delete-credentials|verify-auth|run-verification|enable|disable)$/);
      if (req.method === 'POST' && providerAction) {
        try { const [, id, action] = providerAction; const body = await readBody(req); if (action === 'credentials') sendJson(res, 200, saveCredentials(id, body)); else if (action === 'delete-credentials') sendJson(res, 200, deleteCredentials(id)); else if (action === 'verify-auth') sendJson(res, 200, verifyProviderAuth(id)); else if (action === 'run-verification') sendJson(res, 200, runProviderVerification(id)); else sendJson(res, 200, setProviderEnabled(id, action === 'enable')); } catch (e) { sendJson(res, 400, { error: (e as Error).message }); } return;
      }
      if (req.method === 'POST' && pathPart === '/provider-manager/custom') { try { sendJson(res, 201, saveCustomDefinition((await readBody(req)) as never)); } catch (e) { sendJson(res, 400, { error: (e as Error).message }); } return; }
      if (req.method === 'DELETE' && pathPart.startsWith('/provider-manager/custom/')) { try { deleteCustomDefinition(decodeURIComponent(pathPart.slice('/provider-manager/custom/'.length))); sendJson(res, 204, {}); } catch (e) { sendJson(res, 400, { error: (e as Error).message }); } return; }
      if (req.method === 'GET' && pathPart === '/workspace/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        const send = (event: ServerEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
        const unsub = assetService.subscribe(send);
        send({ type: 'connected', scannedAt: assetService.getWorkspace().lastScannedAt });
        req.on('close', () => unsub());
        return;
      }
      if (req.method === 'POST' && pathPart === '/workspace/scan') {
        const result = await assetService.scan();
        sendJson(res, 200, {
          scannedAt: result.parent.modifiedAt,
          nodeCount: result.nodeCount,
          fileCount: result.fileCount,
          directoryCount: result.directoryCount,
          statsScope: result.statsScope,
          cachedDirectoryCount: result.cachedDirectoryCount,
        });
        return;
      }
      if (req.method === 'POST' && pathPart === '/workspace/root') {
        const body = await readBody(req);
        const rootPath = typeof body.rootPath === 'string' ? body.rootPath : '';
        if (!rootPath) {
          sendJson(res, 400, { error: 'rootPath is required' });
          return;
        }
        assetService.changeRoot(rootPath);
        const result = await assetService.scan();
        sendJson(res, 200, {
          projectRoot: getProjectRoot(),
          scannedAt: result.parent.modifiedAt,
          nodeCount: result.nodeCount,
          fileCount: result.fileCount,
          directoryCount: result.directoryCount,
          statsScope: result.statsScope,
          cachedDirectoryCount: result.cachedDirectoryCount,
        });
        return;
      }

      // ---- Conversation Capture Kernel -------------------------------------
      // Provider adapters can only submit events here. They never receive a
      // filesystem path and therefore cannot write managed assets directly.
      if (req.method === 'POST' && pathPart === '/capture/v1/sessions') {
        try {
          const session = createCaptureSession((await readBody(req)) as never);
          sendJson(res, 201, { captureSessionId: session.captureSessionId, status: session.status, session });
        } catch (e) {
          sendJson(res, captureErrorStatus(e), { error: (e as Error).message });
        }
        return;
      }
      if (req.method === 'POST' && pathPart === '/capture/v1/events') {
        try {
          const body = await readBody(req);
          const captureSessionId = typeof body.captureSessionId === 'string' ? body.captureSessionId : '';
          const events = Array.isArray(body.events) ? body.events : [];
          const result = appendCaptureEvents(captureSessionId, events as never);
          sendJson(res, 200, result);
        } catch (e) {
          sendJson(res, captureErrorStatus(e), { error: (e as Error).message });
        }
        return;
      }
      const captureEnd = pathPart.match(/^\/capture\/v1\/sessions\/([^/]+)\/end$/);
      if (req.method === 'POST' && captureEnd) {
        try {
          const result = await endCaptureSession(decodeURIComponent(captureEnd[1]));
          sendJson(res, 201, result);
        } catch (e) {
          sendJson(res, captureErrorStatus(e), { error: (e as Error).message });
        }
        return;
      }
      const captureGet = pathPart.match(/^\/capture\/v1\/sessions\/([^/]+)$/);
      if (req.method === 'GET' && captureGet) {
        try {
          sendJson(res, 200, getCaptureSession(decodeURIComponent(captureGet[1])));
        } catch (e) {
          sendJson(res, captureErrorStatus(e), { error: (e as Error).message });
        }
        return;
      }

      // ---- Managed Knowledge Asset persistence -------------------------------
      async function handleManaged(fn: () => Promise<unknown>): Promise<void> {
        try {
          sendJson(res, 201, await fn());
        } catch (e) {
          sendJson(res, errorStatus(e), { error: (e as Error)?.message ?? String(e) });
        }
      }

      if (req.method === 'GET' && pathPart === '/managed/asset') {
        const rel = new URLSearchParams(query).get('path') ?? '';
        const meta = getManagedAssetByPath(decodeURIComponent(rel));
        if (!meta) {
          sendJson(res, 404, { error: 'not a managed asset' });
          return;
        }
        sendJson(res, 200, { metadata: meta, path: rel });
        return;
      }

      if (req.method === 'POST' && pathPart === '/managed/conversation') {
        await handleManaged(async () => createConversation((await readBody(req)) as never));
        return;
      }
      if (req.method === 'POST' && pathPart === '/managed/transcript') {
        await handleManaged(async () => createTranscript((await readBody(req)) as never));
        return;
      }
      if (req.method === 'POST' && pathPart === '/managed/design') {
        await handleManaged(async () => createDesign((await readBody(req)) as never));
        return;
      }
      if (req.method === 'POST' && pathPart === '/managed/decision') {
        await handleManaged(async () => createDecision((await readBody(req)) as never));
        return;
      }

      const promoteMatch = pathPart.match(/^\/managed\/(conversation|design)\/([^/]+)\/promote\/(design|decision)$/);
      if (req.method === 'POST' && promoteMatch) {
        const [, fromType, fromId, toType] = promoteMatch;
        await handleManaged(async () => {
          const body = (await readBody(req)) as Record<string, unknown>;
          if (fromType === 'conversation' && toType === 'design') {
            return promoteConversationToDesign(fromId, body as never);
          }
          if (fromType === 'design' && toType === 'decision') {
            return promoteDesignToDecision(fromId, body as never);
          }
          throw new InvalidInputError('unsupported promotion path');
        });
        return;
      }
      // ----------------------------------------------------------------------

      next();
    } catch (e) {
      sendJson(res, 400, { error: String((e as Error)?.message ?? e) });
    }
  };
}

function bootstrap(server: ViteDevServer | PreviewServer): void {
  loadConfig();
  assetService.scan().catch((e) => console.error('[asset-engine] initial scan failed:', e));
  assetService.startWatcher();
  server.middlewares.use('/api', createHandler());
}

export function assetEnginePlugin(): Plugin {
  return {
    name: 'asset-engine',
    configureServer(server) {
      bootstrap(server);
    },
    configurePreviewServer(server) {
      bootstrap(server);
    },
  };
}
