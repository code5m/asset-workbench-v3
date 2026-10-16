import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { canonicalEnterpriseRoot, enableManagedEnterpriseStorage, auditManagedEnterpriseStorage, rollbackManagedEnterpriseStorage, enterpriseWorkspaceId,
  readEnterpriseRegistry, writeEnterpriseRegistry } from './enterpriseStorage.ts';
import { APP_ROOT } from './config.ts';
import { discoverEnterpriseWorkspace } from './enterpriseWorkspace.ts';
import { migrateEnterpriseLegacyKnowledge } from './enterpriseLegacyMigration.ts';

export interface AttachedEnterpriseWorkspace {
  workspaceId: string;
  projectRoot: string;
  label: string;
  registeredAt: string;
  sourcePolicy: 'read-only' | 'managed';
  managedAt?: string;
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
  return readEnterpriseRegistry();
}
function save(items: AttachedEnterpriseWorkspace[]) {
  writeEnterpriseRegistry(items);
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
  const workspaceId = enterpriseWorkspaceId(root);
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
export function enableEnterpriseWorkspaceManaged(id: string) {
  centralOnly();
  if (!/^enterprise-[0-9a-f]{24}$/.test(id)) throw new Error('Invalid workspace ID');
  const item = read().find(v => v.workspaceId === id);
  if (!item) throw new Error('请先只读登记此项目');
  const storage = enableManagedEnterpriseStorage(item.projectRoot);
  try {
    const legacy = migrateEnterpriseLegacyKnowledge(item.projectRoot);
    return { ...storage, legacy };
  } catch (error) {
    return { ...storage, warnings: [...storage.warnings,
      '旧知识资产尚未完成迁移：' + (error as Error).message] };
  }
}
export function auditEnterpriseWorkspaceManaged(id: string) {
  centralOnly();
  const item = read().find(v => v.workspaceId === id);
  if (!item) throw new Error('Unknown attached enterprise workspace');
  return auditManagedEnterpriseStorage(item.projectRoot);
}
export function rollbackEnterpriseWorkspaceManaged(id: string, confirmation: string) {
  centralOnly();
  const item = read().find(v => v.workspaceId === id);
  if (!item) throw new Error('Unknown attached enterprise workspace');
  return rollbackManagedEnterpriseStorage(item.projectRoot, confirmation);
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
  if (workspaceId === undefined || workspaceId === null || workspaceId === '') {
    throw new Error('中央 Framework 必须先只读接入企业项目并选择其工作区 ID；不允许隐式使用全局项目目录');
  }
  centralOnly();
  if (typeof workspaceId !== 'string' || !/^enterprise-[0-9a-f]{24}$/.test(workspaceId)) throw new Error('Invalid workspace ID');
  const item = read().find(x => x.workspaceId === workspaceId);
  if (!item || digest(item.projectRoot) !== workspaceId.slice('enterprise-'.length)) throw new Error('Unknown attached enterprise workspace');
  const canonical = validatedRoot(item.projectRoot);
  if (canonical !== item.projectRoot) throw new Error('Attached enterprise root identity changed; re-register the project');
  return canonical;
}
