import type { Plugin, Connect, ViteDevServer, PreviewServer } from 'vite';
import { assetService } from './assetService.ts';
import { getProjectRoot, loadConfig } from './config.ts';
import { registerCentralDevUi } from './sharedUi.ts';
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
import { publishFrameworkRelease, currentFrameworkRelease } from './frameworkRelease.ts';
import { instanceRuntimeStatus, startInstanceRuntime, stopInstanceRuntime, adoptInstanceRelease, rollbackInstanceRelease, listInstanceRuntimes, registerInstanceRuntime, reconcileLegacyInstanceUi, resumeRequestedInstances } from './instanceRuntimeManager.ts';
import { isLocalApiRequest, MAX_API_BODY_BYTES } from './localApiSecurity.ts';
import { setupProjectProviders } from './providerSetup.ts';
import { attachEnterpriseWorkspaceReadOnly, detachEnterpriseWorkspaceReadOnly, enableEnterpriseWorkspaceManaged, auditEnterpriseWorkspaceManaged, rollbackEnterpriseWorkspaceManaged, enterpriseApiRoot, listAttachedEnterpriseWorkspaces } from './enterpriseAttachment.ts';
import { enterpriseEntryForRoot } from './enterpriseStorage.ts';
import { enterpriseProviderStatuses, setupEnterpriseUserProviderHooks } from './enterpriseProviderSetup.ts';
import { listEnterpriseProviderSessions, readEnterpriseCaptureEvents } from './enterpriseProviderCapture.ts';
import { importEnterpriseCodexHistory } from './enterpriseProviderHistory.ts';
import { createEnterpriseKnowledgeNote, listEnterpriseKnowledgeNotes } from './enterpriseKnowledge.ts';
import { buildEnterpriseJavaSymbolGraph } from './enterpriseSemanticJava.ts';
import { buildEnterpriseDynamicSqlLineage } from './enterpriseSqlLineage.ts';
import { proposeEnterpriseAiRefactor, validateEnterpriseAiRefactor } from './enterpriseAiRefactor.ts';
import { semanticToolchainStatus } from './enterpriseToolchain.ts';
import { importEnterpriseRaw, verifyEnterpriseRaw } from './enterpriseImport.ts';
import { mirrorEnterpriseSnapshot } from './enterpriseMirror.ts';
import { buildEnterpriseMavenGraph } from './enterpriseGraph.ts';
import { analyzeEnterpriseQuality } from './enterpriseQuality.ts';
import { planFrameworkRollout, applyFrameworkRollout } from './frameworkRollout.ts';
import { buildEnterpriseSourceGraph } from './enterpriseSourceGraph.ts';
import { runEnterpriseOptimizationExperiment } from './enterpriseOptimization.ts';
import { createEvolutionCase, listEvolutionCases, advanceEvolutionCase, nominateFrameworkCandidate } from './enterpriseEvolution.ts';
import { discoverEnterpriseWorkspace, freezeEnterpriseWorkspace, listEnterpriseSnapshots, verifyEnterpriseSnapshot, compareEnterpriseSnapshots } from './enterpriseWorkspace.ts';
import { createKnowledge, verifyKnowledge } from '../packages/starter/src/index.ts';
import {
  applyInstanceUpgrade,
  createInstance,
  readInstanceManifest,
  frameworkIdentity,
  instanceStatus,
  planInstanceUpgrade,
  rollbackInstance,
  runInstanceLifecycleSelfTest,
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

export function createHandler() {
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
      if (req.method === 'GET' && pathPart === '/enterprise/projects/list') {
        sendJson(res, 200, { workspaces: listAttachedEnterpriseWorkspaces() }); return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/projects/managed/audit') {
        try {
          const id = new URLSearchParams(query || '').get('workspaceId') || '';
          sendJson(res, 200, auditEnterpriseWorkspaceManaged(id));
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/projects/managed/rollback') {
        const body = await readBody(req);
        try {
          sendJson(res, 200, rollbackEnterpriseWorkspaceManaged(
            typeof body.workspaceId === 'string' ? body.workspaceId : '',
            typeof body.confirm === 'string' ? body.confirm : ''));
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/projects/managed/enable') {
        const body = await readBody(req);
        try {
          if (typeof body.workspaceId !== 'string') throw new Error('workspaceId required');
          sendJson(res, 200, enableEnterpriseWorkspaceManaged(body.workspaceId));
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/provider/history/import') {
        const body = await readBody(req);
        try {
          if (body.provider !== 'codex' || typeof body.path !== 'string'
            || typeof body.workspaceId !== 'string') throw new Error('仅支持有官方 cwd 证据的 Codex JSONL 导入');
          const root = enterpriseApiRoot(body.workspaceId, getProjectRoot());
          if (enterpriseEntryForRoot(root)?.sourcePolicy !== 'managed') throw new Error('需要先启用受管模式');
          const result = importEnterpriseCodexHistory(body.path, body.workspaceId);
          sendJson(res, 200, result);
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/knowledge/notes') {
        try {
          const id = new URLSearchParams(query || '').get('workspaceId');
          const root = enterpriseApiRoot(id, getProjectRoot());
          if (enterpriseEntryForRoot(root)?.sourcePolicy !== 'managed') {
            sendJson(res, 200, { notes: [], status: 'read-only' });
          } else sendJson(res, 200, { notes: listEnterpriseKnowledgeNotes(root), status: 'managed' });
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/knowledge/notes') {
        const body = await readBody(req);
        try {
          const root = enterpriseApiRoot(body.workspaceId, getProjectRoot());
          const note = createEnterpriseKnowledgeNote(root, {
            title: typeof body.title === 'string' ? body.title : '',
            content: typeof body.content === 'string' ? body.content : '',
            repository: typeof body.repository === 'string' ? body.repository : null,
            module: typeof body.module === 'string' ? body.module : null,
          });
          sendJson(res, 201, note);
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/provider/status') {
        try {
          const params = new URLSearchParams(query || '');
          const root = enterpriseApiRoot(params.get('workspaceId'), getProjectRoot());
          if (enterpriseEntryForRoot(root)?.sourcePolicy !== 'managed') {
            sendJson(res, 200, { mode: 'read-only', providers: [], sessions: [], detail: '请先授权开启企业受管模式' });
          } else {
            sendJson(res, 200, { mode: 'managed', providers: enterpriseProviderStatuses(root),
              sessions: listEnterpriseProviderSessions(root, 100) });
          }
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/provider/session/events') {
        try {
          const params = new URLSearchParams(query || '');
          const root = enterpriseApiRoot(params.get('workspaceId'), getProjectRoot());
          if (enterpriseEntryForRoot(root)?.sourcePolicy !== 'managed') throw new Error('Only managed enterprise workspaces can view Provider captures');
          const id = params.get('id') || '';
          sendJson(res, 200, { events: readEnterpriseCaptureEvents(root, id) });
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/provider/hooks/setup') {
        const body = await readBody(req);
        try {
          if (typeof body.workspaceId !== 'string') throw new Error('workspaceId required');
          const root = enterpriseApiRoot(body.workspaceId, getProjectRoot());
          if (enterpriseEntryForRoot(root)?.sourcePolicy !== 'managed') throw new Error('企业工作区必须先开启受管模式');
          const confirm = typeof body.confirm === 'string' ? body.confirm : '';
          sendJson(res, 200, { results: setupEnterpriseUserProviderHooks(confirm) });
        } catch (error) { sendJson(res, 400, { error: (error as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/projects/detach') {
        const body = await readBody(req);
        try {
          sendJson(res, 200, detachEnterpriseWorkspaceReadOnly(
            typeof body.workspaceId === 'string' ? body.workspaceId : ''));
        } catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/projects/attach') {
        const body = await readBody(req);
        try {
          const result = attachEnterpriseWorkspaceReadOnly(
            typeof body.projectRoot === 'string' ? body.projectRoot : '',
            typeof body.label === 'string' ? body.label : undefined,
          );
          sendJson(res, 201, result);
        } catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
        return;
      }
      // Enterprise read-only multi-repository evidence. Never fetch, checkout, or
      // mutate source repos; snapshots reside in central managed storage.
      if (req.method === 'GET' && pathPart === '/enterprise/semantic/toolchain') {
        sendJson(res, 200, await semanticToolchainStatus());
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/semantic/java') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string') throw new Error('snapshotId required');
        sendJson(res, 200, await buildEnterpriseJavaSymbolGraph(
          enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.snapshotId,
          typeof body.maxFiles === 'number' ? body.maxFiles : undefined)); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/semantic/sql') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string') throw new Error('snapshotId required');
        sendJson(res, 200, await buildEnterpriseDynamicSqlLineage(
          enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.snapshotId,
          typeof body.maxFiles === 'number' ? body.maxFiles : undefined)); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/refactor/propose') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string' || typeof body.repository !== 'string'
          || typeof body.path !== 'string') throw new Error('snapshotId, repository and path required');
        try {
          sendJson(res, 200, await proposeEnterpriseAiRefactor(
            enterpriseApiRoot(body.workspaceId, getProjectRoot()), {
              snapshotId: body.snapshotId, repository: body.repository, path: body.path,
              model: typeof body.model === 'string' ? body.model : undefined,
            }));
        } catch (e) { sendJson(res, 422, { status: 'blocked', error: (e as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/refactor/validate') {
        const body = await readBody(req);
        if (typeof body.proposalId !== 'string') throw new Error('proposalId required');
        try {
          sendJson(res, 200, await validateEnterpriseAiRefactor(
            enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.proposalId));
        } catch (e) { sendJson(res, 422, { status: 'blocked', error: (e as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/mirrors/sync') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string') throw new Error('snapshotId required');
        sendJson(res, 200, { results: mirrorEnterpriseSnapshot(enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.snapshotId) }); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/raw/import') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string') throw new Error('snapshotId required');
        sendJson(res, 201, importEnterpriseRaw(enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.snapshotId, {
          maxBytes: typeof body.maxBytes === 'number' && Number.isFinite(body.maxBytes) ? body.maxBytes : undefined,
          maxFiles: typeof body.maxFiles === 'number' && Number.isFinite(body.maxFiles) ? body.maxFiles : undefined,
        }));
        return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/raw/verify') {
        const id = new URLSearchParams(query || '').get('id') ?? '';
        sendJson(res, 200, verifyEnterpriseRaw(enterpriseApiRoot(new URLSearchParams(query || '').get('workspaceId'), getProjectRoot()), id)); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/sourcegraph/build') {
        const body=await readBody(req);
        if(typeof body.snapshotId!=='string')throw new Error('snapshotId required');
        sendJson(res,200,buildEnterpriseSourceGraph(enterpriseApiRoot(body.workspaceId, getProjectRoot()),body.snapshotId));return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/optimization/experiment') {
        const body=await readBody(req);
        if(typeof body.snapshotId!=='string')throw new Error('snapshotId required');
        sendJson(res,200,runEnterpriseOptimizationExperiment(enterpriseApiRoot(body.workspaceId, getProjectRoot()),body.snapshotId));return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/quality/analyze') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string') throw new Error('snapshotId required');
        sendJson(res, 200, analyzeEnterpriseQuality(enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.snapshotId)); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/graph/build') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string') throw new Error('snapshotId required');
        sendJson(res, 201, buildEnterpriseMavenGraph(enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.snapshotId)); return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/evolution') {
        sendJson(res, 200, { cases: listEvolutionCases(enterpriseApiRoot(new URLSearchParams(query || '').get('workspaceId'), getProjectRoot())) }); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/evolution/create') {
        const body = await readBody(req);
        if (typeof body.snapshotId !== 'string' || typeof body.title !== 'string'
            || typeof body.problem !== 'string' || !Array.isArray(body.evidence)) {
          throw new Error('Invalid evidence-based evolution case');
        }
        sendJson(res, 201, createEvolutionCase(enterpriseApiRoot(body.workspaceId, getProjectRoot()), {
          snapshotId: body.snapshotId, title: body.title, problem: body.problem,
          evidence: body.evidence as Array<{ repository: string; path: string; commit: string }>,
        })); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/evolution/advance') {
        const body = await readBody(req);
        if (typeof body.id !== 'string' || typeof body.stage !== 'string' || typeof body.note !== 'string')
          throw new Error('Invalid evolution transition');
        sendJson(res, 200, advanceEvolutionCase(enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.id,
          body.stage as Parameters<typeof advanceEvolutionCase>[2], body.note)); return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/evolution/nominate') {
        const body = await readBody(req);
        if (typeof body.id !== 'string') throw new Error('Invalid candidate');
        sendJson(res, 200, nominateFrameworkCandidate(enterpriseApiRoot(body.workspaceId, getProjectRoot()), body.id)); return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/discovery') {
        sendJson(res, 200, discoverEnterpriseWorkspace(enterpriseApiRoot(new URLSearchParams(query || '').get('workspaceId'), getProjectRoot())));
        return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/snapshots') {
        sendJson(res, 200, { snapshots: listEnterpriseSnapshots(enterpriseApiRoot(new URLSearchParams(query || '').get('workspaceId'), getProjectRoot())) });
        return;
      }
      if (req.method === 'POST' && pathPart === '/enterprise/snapshots/freeze') {
        const body = await readBody(req);
        const source = body.source === 'origin-tracking' ? 'origin-tracking' : body.source === 'head' ? 'head' : null;
        if (!source) { sendJson(res, 400, { error: 'source must be head or origin-tracking' }); return; }
        sendJson(res, 201, freezeEnterpriseWorkspace(enterpriseApiRoot(body.workspaceId, getProjectRoot()), source));
        return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/snapshots/verify') {
        const id = new URLSearchParams(query || '').get('id') ?? '';
        sendJson(res, 200, verifyEnterpriseSnapshot(enterpriseApiRoot(new URLSearchParams(query || '').get('workspaceId'), getProjectRoot()), id));
        return;
      }
      if (req.method === 'GET' && pathPart === '/enterprise/snapshots/compare') {
        const params = new URLSearchParams(query || '');
        sendJson(res, 200, compareEnterpriseSnapshots(enterpriseApiRoot(new URLSearchParams(query || '').get('workspaceId'), getProjectRoot()), params.get('before') ?? '', params.get('after') ?? ''));
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
        sendJson(res, 200, { ...loadConfig(), configurable: !process.env.AWB_INSTANCE_PROJECT_ROOT });
        return;
      }
      if (req.method === 'GET' && pathPart === '/creator/release/current') {
        try { sendJson(res, 200, { release: currentFrameworkRelease() }); }
        catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
        return;
      }
      if (req.method === 'POST' && pathPart === '/creator/release/publish') {
        try { sendJson(res, 200, { release: await publishFrameworkRelease() }); }
        catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
        return;
      }
      if (pathPart === '/creator/runtime/rollout/plan' && req.method === 'GET') {
        if(process.env.AWB_INSTANCE_PROJECT_ROOT){sendJson(res,403,{code:'CENTRAL_ONLY',error:'只能在中央 Framework 管理界面执行'});return;}
        sendJson(res,200,await planFrameworkRollout());return;
      }
      if (pathPart === '/creator/runtime/rollout/apply' && req.method === 'POST') {
        if(process.env.AWB_INSTANCE_PROJECT_ROOT){sendJson(res,403,{code:'CENTRAL_ONLY',error:'只能在中央 Framework 管理界面执行'});return;}
        const body=await readBody(req);
        sendJson(res,200,await applyFrameworkRollout(typeof body.confirm==='string'?body.confirm:''));return;
      }
      if (pathPart === '/creator/runtime/list' && req.method === 'GET') {
        try { sendJson(res, 200, await listInstanceRuntimes()); }
        catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
        return;
      }
      if (pathPart.startsWith('/creator/runtime/') && req.method === 'POST') {
        try {
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot : '';
          const action = pathPart.slice('/creator/runtime/'.length);
          const result = action === 'adopt' ? await adoptInstanceRelease(projectRoot, typeof body.releaseId === 'string' ? body.releaseId : '')
            : action === 'rollback-release' ? await rollbackInstanceRelease(projectRoot)
            : action === 'status' ? await instanceRuntimeStatus(projectRoot)
            : action === 'start' ? await startInstanceRuntime(projectRoot)
            : action === 'stop' ? await stopInstanceRuntime(projectRoot)
            : null;
          if (!result) { sendJson(res, 404, { error: 'Unknown runtime action' }); return; }
          sendJson(res, 200, result);
        } catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
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
          registerInstanceRuntime(result.manifest.projectRoot);
          const providerSetup = setupProjectProviders(result.manifest.projectRoot);
          sendJson(res, 201, { ...result, providerSetup });
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && pathPart === '/creator/instance/providers/setup') {
        try {
          if (process.env.AWB_INSTANCE_PROJECT_ROOT) { sendJson(res, 403, { error: 'Central Framework only' }); return; }
          const body = await readBody(req);
          const projectRoot = typeof body.projectRoot === 'string' ? body.projectRoot.trim() : '';
          if (!projectRoot) { sendJson(res, 400, { error: 'projectRoot is required' }); return; }
          const manifest = readInstanceManifest(projectRoot);
          if (!manifest) { sendJson(res, 404, { error: 'Instance Manifest not found' }); return; }
          sendJson(res, 200, { providers: setupProjectProviders(projectRoot) });
        } catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
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

      if (req.method === 'POST' && pathPart === '/creator/instance/self-test') {
        try {
          const cfg = loadConfig();
          const result = runInstanceLifecycleSelfTest({
            framework: frameworkIdentity(cfg.frameworkVersion, cfg.frameworkRevision),
            frameworkRoot: cfg.appRoot,
          });
          sendJson(res, result.ok ? 200 : 422, result);
        } catch (e) {
          sendJson(res, 500, { error: (e as Error).message });
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
        if (process.env.AWB_INSTANCE_PROJECT_ROOT) throw new Error('Project switching is disabled for an independent Instance');
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
  // In the central dev server only: once after startup, move old frozen-UI
  // backend processes onto the shared-UI bridge. Subsequent UI changes do
  // NOT require backend upgrades or release adoption.
  if (!process.env.AWB_INSTANCE_PROJECT_ROOT) {
    void reconcileLegacyInstanceUi().catch((error) => {
      console.error('[shared-ui] Legacy Instance migration failed:', error);
    }).finally(() => {
      void resumeRequestedInstances().catch((error) => console.error('[instance-recovery]', error));
    });
    // PID files are not authoritative: periodic health checks only resume
    // projects the user previously chose to keep running.
    const recoveryTimer = setInterval(() => {
      void resumeRequestedInstances().catch((error) => console.error('[instance-recovery]', error));
    }, 60_000);
    recoveryTimer.unref();
  }
  server.middlewares.use('/api', createHandler());
}

export function assetEnginePlugin(): Plugin {
  return {
    name: 'asset-engine',
    configureServer(server) {
      registerCentralDevUi(server);
      bootstrap(server);
    },
    configurePreviewServer(server) {
      bootstrap(server);
    },
  };
}
