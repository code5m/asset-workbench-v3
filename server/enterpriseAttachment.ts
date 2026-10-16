import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { APP_ROOT } from './config.ts';
import { discoverEnterpriseWorkspace } from './enterpriseWorkspace.ts';

export interface AttachedEnterpriseWorkspace {
  workspaceId: string;
  projectRoot: string;
  label: string;
  registeredAt: string;
  sourcePolicy: 'read-only';
}
const digest = (root: string) => createHash('sha256').update(root).digest('hex').slice(0, 24);
const registry = () => path.join(APP_ROOT, '.asset-workbench-data', 'enterprise-workspaces', 'attached.json');
const configuredInstance = () => Boolean(process.env.AWB_INSTANCE_PROJECT_ROOT);

function centralOnly() {
  if (configuredInstance()) throw new Error('只能在中央 Framework 中接入其他业务工作区');
}
function validatedRoot(input: string): string {
  if (!input || typeof input !== 'string') throw new Error('必须选择现有业务目录');
  const root = fs.realpathSync(path.resolve(input));
  const appRoot = fs.realpathSync(APP_ROOT);
  if (!fs.statSync(root).isDirectory() || root === appRoot || root.startsWith(appRoot + path.sep)) {
    throw new Error('只读接入必须使用 Framework 外部现有业务目录');
  }
  return root;
}
function read(): AttachedEnterpriseWorkspace[] {
  try {
    const raw = JSON.parse(fs.readFileSync(registry(), 'utf8')) as AttachedEnterpriseWorkspace[];
    if (!Array.isArray(raw)) return [];
    return raw.filter(v => typeof v.workspaceId === 'string' && /^enterprise-[0-9a-f]{24}$/.test(v.workspaceId)
      && typeof v.projectRoot === 'string' && v.sourcePolicy === 'read-only');
  } catch { return []; }
}
function save(items: AttachedEnterpriseWorkspace[]) {
  const file = registry();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(items, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
export function listAttachedEnterpriseWorkspaces(): AttachedEnterpriseWorkspace[] {
  centralOnly();
  return read();
}
export function attachEnterpriseWorkspaceReadOnly(input: string, label?: string): {
  workspace: AttachedEnterpriseWorkspace;
  repositoryCount: number;
  warnings: string[];
  sourceFilesModified: false;
} {
  centralOnly();
  const root = validatedRoot(input);
  const found = discoverEnterpriseWorkspace(root);
  if (found.repositories.length === 0) throw new Error('目录内没有可识别的 Git 仓库');
  const workspaceId = 'enterprise-' + digest(root);
  const previous = read();
  const existing = previous.find(v => v.workspaceId === workspaceId);
  const workspace = existing ?? {
    workspaceId, projectRoot: root, label: label?.trim().slice(0, 120) || path.basename(root),
    registeredAt: new Date().toISOString(), sourcePolicy: 'read-only' as const,
  };
  if (!existing) save([...previous, workspace]);
  // No Instance Manifest or Provider Hooks; registration is stored ONLY in Framework.
  return { workspace, repositoryCount: found.repositories.length, warnings: found.warnings, sourceFilesModified: false };
}
export function detachEnterpriseWorkspaceReadOnly(id: string): { detached: boolean; cachedAssetsPreserved: true } {
  centralOnly();
  if (!/^enterprise-[0-9a-f]{24}$/.test(id)) throw new Error('Invalid enterprise workspace ID');
  const current = read(), remaining = current.filter(w => w.workspaceId !== id);
  if (remaining.length !== current.length) save(remaining);
  // Intentionally never touch the business tree or delete its analysis/cache artifacts.
  return { detached: remaining.length !== current.length, cachedAssetsPreserved: true };
}
/**
 * An attached ID is server-resolved; never trust arbitrary paths in API bodies.
 * A business Instance may only operate on its own bound root.
 */
export function enterpriseApiRoot(workspaceId: unknown, activeRoot: string): string {
  if (configuredInstance()) {
    if (workspaceId !== undefined && workspaceId !== null && workspaceId !== '') throw new Error('业务实例不能访问其他工作区');
    return activeRoot;
  }
  if (workspaceId === undefined || workspaceId === null || workspaceId === '') return activeRoot;
  centralOnly();
  if (typeof workspaceId !== 'string' || !/^enterprise-[0-9a-f]{24}$/.test(workspaceId)) throw new Error('Invalid workspace ID');
  const item = read().find(x => x.workspaceId === workspaceId);
  if (!item || digest(item.projectRoot) !== workspaceId.slice('enterprise-'.length)) throw new Error('Unknown attached enterprise workspace');
  return validatedRoot(item.projectRoot);
}
