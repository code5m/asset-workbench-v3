import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { createKnowledge, verifyKnowledge, type KnowledgeVerificationResult } from '../../starter/src/index.ts';

export type CreatorCapabilityId = 'knowledge' | 'instance' | 'upgrade' | 'migration';

export const CREATOR_CAPABILITY_VERSIONS: Record<CreatorCapabilityId, string> = {
  knowledge: '1.0.0',
  instance: '1.0.0',
  upgrade: '1.0.0',
  migration: '1.0.0',
};

export const INSTANCE_MANIFEST_SCHEMA_VERSION = 1;

export interface FrameworkIdentity {
  version: string;
  revision: string;
  capabilities: Record<CreatorCapabilityId, string>;
}

export interface InstanceManifest {
  schemaVersion: 1;
  instanceId: string;
  projectRoot: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  generation: number;
  state: 'ready';
  framework: {
    version: string;
    revision: string;
  };
  capabilities: Record<CreatorCapabilityId, string>;
  knowledge: {
    status: 'verified' | 'not-initialized';
    verified: boolean;
  };
  lastMigrationId?: string;
}

export interface InstanceCreateOptions {
  projectRoot: string;
  name?: string;
  framework: FrameworkIdentity;
  frameworkRoot?: string;
  initializeKnowledge?: boolean;
}

export interface InstanceCreateResult {
  manifest: InstanceManifest;
  knowledgeVerification: KnowledgeVerificationResult;
  manifestPath: string;
}

export interface InstanceVerificationCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface InstanceVerificationResult {
  projectRoot: string;
  ok: boolean;
  upToDate: boolean;
  checks: InstanceVerificationCheck[];
  manifest: InstanceManifest | null;
}

export interface UpgradeAction {
  id: string;
  kind: 'framework-version' | 'framework-revision' | 'capability-version';
  capability?: CreatorCapabilityId;
  from: string;
  to: string;
}

export interface InstanceUpgradePlan {
  schemaVersion: 1;
  planId: string;
  instanceId: string;
  projectRoot: string;
  createdAt: string;
  sourceDigest: string;
  from: {
    framework: { version: string; revision: string };
    capabilities: Record<CreatorCapabilityId, string>;
  };
  to: {
    framework: { version: string; revision: string };
    capabilities: Record<CreatorCapabilityId, string>;
  };
  actions: UpgradeAction[];
  status: 'noop' | 'ready' | 'applied';
  appliedMigrationId?: string;
}

export interface MigrationRecord {
  schemaVersion: 1;
  migrationId: string;
  planId: string;
  instanceId: string;
  projectRoot: string;
  createdAt: string;
  appliedAt?: string;
  rolledBackAt?: string;
  status: 'prepared' | 'applied' | 'rolled-back';
  beforeDigest: string;
  afterDigest: string;
  backupPath: string;
  actions: UpgradeAction[];
  beforeManifest: InstanceManifest;
  afterManifest: InstanceManifest;
}

export interface InstanceUpgradeApplyResult {
  applied: boolean;
  manifest: InstanceManifest;
  plan: InstanceUpgradePlan;
  migration: MigrationRecord | null;
}

export interface InstanceSelfTestStep {
  id: string;
  ok: boolean;
  detail: string;
}

export interface InstanceSelfTestResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  framework: {
    version: string;
    revision: string;
  };
  steps: InstanceSelfTestStep[];
}

function resolveProjectRoot(input: string): string {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new Error(`project root does not exist: ${resolved}`);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`project root is not a directory: ${resolved}`);
  return fs.realpathSync(resolved);
}

function instanceDir(projectRoot: string): string {
  return path.join(projectRoot, '.asset-workbench-data', 'instance');
}

function manifestFile(projectRoot: string): string {
  return path.join(instanceDir(projectRoot), 'manifest.json');
}

function plansDir(projectRoot: string): string {
  return path.join(instanceDir(projectRoot), 'plans');
}

function migrationsDir(projectRoot: string): string {
  return path.join(instanceDir(projectRoot), 'migrations');
}

function backupsDir(projectRoot: string): string {
  return path.join(instanceDir(projectRoot), 'backups');
}

function safeId(value: string, label: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(value)) throw new Error(`invalid ${label}: ${value}`);
  return value;
}

function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function frameworkIdentity(version: string, revision: string): FrameworkIdentity {
  return {
    version,
    revision,
    capabilities: { ...CREATOR_CAPABILITY_VERSIONS },
  };
}

export function getInstanceManifestPath(projectRootInput: string): string {
  const projectRoot = resolveProjectRoot(projectRootInput);
  return manifestFile(projectRoot);
}

export function readInstanceManifest(projectRootInput: string): InstanceManifest | null {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const file = manifestFile(projectRoot);
  if (!fs.existsSync(file)) return null;
  return readJson<InstanceManifest>(file);
}

export function createInstance(options: InstanceCreateOptions): InstanceCreateResult {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  if (options.frameworkRoot && path.resolve(options.frameworkRoot) === projectRoot) {
    throw new Error('Workbench Instance must bind an external business project, not Framework Self');
  }
  const file = manifestFile(projectRoot);
  if (fs.existsSync(file)) throw new Error(`instance already exists: ${file}`);

  let knowledgeVerification = verifyKnowledge(projectRoot);
  if (options.initializeKnowledge && !knowledgeVerification.ok) {
    const visibleEntries = fs.readdirSync(projectRoot).filter((entry) => entry !== '.asset-workbench-data');
    if (visibleEntries.length > 0) {
      throw new Error('knowledge initialization requires an empty project root or an already-valid knowledge structure');
    }
    createKnowledge({ target: projectRoot, name: options.name });
    knowledgeVerification = verifyKnowledge(projectRoot);
  }

  const now = new Date().toISOString();
  const manifest: InstanceManifest = {
    schemaVersion: INSTANCE_MANIFEST_SCHEMA_VERSION,
    instanceId: randomUUID(),
    projectRoot,
    projectName: options.name?.trim() || path.basename(projectRoot),
    createdAt: now,
    updatedAt: now,
    generation: 1,
    state: 'ready',
    framework: {
      version: options.framework.version,
      revision: options.framework.revision,
    },
    capabilities: { ...options.framework.capabilities },
    knowledge: {
      status: knowledgeVerification.ok ? 'verified' : 'not-initialized',
      verified: knowledgeVerification.ok,
    },
  };

  atomicWriteJson(file, manifest);
  return { manifest, knowledgeVerification, manifestPath: file };
}

export function verifyInstance(projectRootInput: string, target?: FrameworkIdentity): InstanceVerificationResult {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const manifest = readInstanceManifest(projectRoot);
  const checks: InstanceVerificationCheck[] = [];

  if (!manifest) {
    return {
      projectRoot,
      ok: false,
      upToDate: false,
      checks: [{ id: 'manifest', ok: false, detail: 'instance manifest is missing' }],
      manifest: null,
    };
  }

  checks.push({
    id: 'schema',
    ok: manifest.schemaVersion === INSTANCE_MANIFEST_SCHEMA_VERSION,
    detail: `schemaVersion=${manifest.schemaVersion}`,
  });
  checks.push({
    id: 'project-root',
    ok: path.resolve(manifest.projectRoot) === projectRoot,
    detail: manifest.projectRoot,
  });
  checks.push({
    id: 'state',
    ok: manifest.state === 'ready',
    detail: manifest.state,
  });
  checks.push({
    id: 'framework-version',
    ok: Boolean(manifest.framework.version),
    detail: manifest.framework.version || 'missing',
  });
  checks.push({
    id: 'framework-revision',
    ok: Boolean(manifest.framework.revision),
    detail: manifest.framework.revision || 'missing',
  });
  for (const capability of Object.keys(CREATOR_CAPABILITY_VERSIONS) as CreatorCapabilityId[]) {
    checks.push({
      id: `capability:${capability}`,
      ok: Boolean(manifest.capabilities[capability]),
      detail: manifest.capabilities[capability] || 'missing',
    });
  }
  if (manifest.knowledge.verified) {
    const knowledge = verifyKnowledge(projectRoot);
    checks.push({
      id: 'knowledge',
      ok: knowledge.ok,
      detail: knowledge.ok ? 'verified knowledge structure is still present' : 'manifest says knowledge is verified but the structure drifted',
    });
  }

  const structuralOk = checks.every((check) => check.ok);
  const upToDate = target
    ? manifest.framework.version === target.version
      && manifest.framework.revision === target.revision
      && (Object.keys(target.capabilities) as CreatorCapabilityId[])
        .every((capability) => manifest.capabilities[capability] === target.capabilities[capability])
    : structuralOk;

  return {
    projectRoot,
    ok: structuralOk,
    upToDate,
    checks,
    manifest,
  };
}

export function planInstanceUpgrade(projectRootInput: string, target: FrameworkIdentity): InstanceUpgradePlan {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const manifest = readInstanceManifest(projectRoot);
  if (!manifest) throw new Error('instance manifest is missing');

  const actions: UpgradeAction[] = [];
  if (manifest.framework.version !== target.version) {
    actions.push({
      id: 'framework-version',
      kind: 'framework-version',
      from: manifest.framework.version,
      to: target.version,
    });
  }
  if (manifest.framework.revision !== target.revision) {
    actions.push({
      id: 'framework-revision',
      kind: 'framework-revision',
      from: manifest.framework.revision,
      to: target.revision,
    });
  }
  for (const capability of Object.keys(target.capabilities) as CreatorCapabilityId[]) {
    const current = manifest.capabilities[capability] ?? 'missing';
    const next = target.capabilities[capability];
    if (current !== next) {
      actions.push({
        id: `capability:${capability}`,
        kind: 'capability-version',
        capability,
        from: current,
        to: next,
      });
    }
  }

  const plan: InstanceUpgradePlan = {
    schemaVersion: 1,
    planId: randomUUID(),
    instanceId: manifest.instanceId,
    projectRoot,
    createdAt: new Date().toISOString(),
    sourceDigest: digest(manifest),
    from: {
      framework: { ...manifest.framework },
      capabilities: { ...manifest.capabilities },
    },
    to: {
      framework: { version: target.version, revision: target.revision },
      capabilities: { ...target.capabilities },
    },
    actions,
    status: actions.length === 0 ? 'noop' : 'ready',
  };
  atomicWriteJson(path.join(plansDir(projectRoot), `${plan.planId}.json`), plan);
  return plan;
}

export function readUpgradePlan(projectRootInput: string, planId: string): InstanceUpgradePlan {
  const projectRoot = resolveProjectRoot(projectRootInput);
  return readJson<InstanceUpgradePlan>(path.join(plansDir(projectRoot), `${safeId(planId, 'plan id')}.json`));
}

export function applyInstanceUpgrade(projectRootInput: string, planId: string): InstanceUpgradeApplyResult {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const planPath = path.join(plansDir(projectRoot), `${safeId(planId, 'plan id')}.json`);
  const plan = readJson<InstanceUpgradePlan>(planPath);
  const manifest = readInstanceManifest(projectRoot);
  if (!manifest) throw new Error('instance manifest is missing');
  if (manifest.instanceId !== plan.instanceId) throw new Error('upgrade plan belongs to a different instance');
  if (plan.status === 'applied') throw new Error('upgrade plan is already applied');
  if (digest(manifest) !== plan.sourceDigest) throw new Error('upgrade plan is stale because the instance manifest changed');

  if (plan.status === 'noop' || plan.actions.length === 0) {
    return { applied: false, manifest, plan, migration: null };
  }

  const migrationId = randomUUID();
  const now = new Date().toISOString();
  const nextManifest: InstanceManifest = {
    ...manifest,
    framework: { ...plan.to.framework },
    capabilities: { ...plan.to.capabilities },
    generation: manifest.generation + 1,
    updatedAt: now,
    lastMigrationId: migrationId,
  };
  const backupPath = path.join(backupsDir(projectRoot), migrationId, 'manifest.json');
  const migrationPath = path.join(migrationsDir(projectRoot), `${migrationId}.json`);
  const migration: MigrationRecord = {
    schemaVersion: 1,
    migrationId,
    planId: plan.planId,
    instanceId: manifest.instanceId,
    projectRoot,
    createdAt: now,
    status: 'prepared',
    beforeDigest: digest(manifest),
    afterDigest: digest(nextManifest),
    backupPath,
    actions: [...plan.actions],
    beforeManifest: manifest,
    afterManifest: nextManifest,
  };

  atomicWriteJson(backupPath, manifest);
  atomicWriteJson(migrationPath, migration);
  atomicWriteJson(manifestFile(projectRoot), nextManifest);

  const appliedMigration: MigrationRecord = {
    ...migration,
    status: 'applied',
    appliedAt: new Date().toISOString(),
  };
  atomicWriteJson(migrationPath, appliedMigration);

  const appliedPlan: InstanceUpgradePlan = {
    ...plan,
    status: 'applied',
    appliedMigrationId: migrationId,
  };
  atomicWriteJson(planPath, appliedPlan);

  return {
    applied: true,
    manifest: nextManifest,
    plan: appliedPlan,
    migration: appliedMigration,
  };
}

export function readMigration(projectRootInput: string, migrationId: string): MigrationRecord {
  const projectRoot = resolveProjectRoot(projectRootInput);
  return readJson<MigrationRecord>(path.join(migrationsDir(projectRoot), `${safeId(migrationId, 'migration id')}.json`));
}

export function latestMigration(projectRootInput: string): MigrationRecord | null {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const dir = migrationsDir(projectRoot);
  if (!fs.existsSync(dir)) return null;
  const records = fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson<MigrationRecord>(path.join(dir, name)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return records[0] ?? null;
}

export function rollbackInstance(projectRootInput: string, migrationIdInput?: string): MigrationRecord {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const manifest = readInstanceManifest(projectRoot);
  if (!manifest) throw new Error('instance manifest is missing');

  const migrationId = migrationIdInput ?? manifest.lastMigrationId;
  if (!migrationId) throw new Error('no migration is available to roll back');
  const migrationPath = path.join(migrationsDir(projectRoot), `${safeId(migrationId, 'migration id')}.json`);
  const migration = readJson<MigrationRecord>(migrationPath);
  if (migration.status !== 'applied') throw new Error(`migration is not rollbackable: ${migration.status}`);
  if (manifest.instanceId !== migration.instanceId) throw new Error('migration belongs to a different instance');
  if (manifest.lastMigrationId !== migration.migrationId) throw new Error('only the latest applied migration can be rolled back safely');
  if (digest(manifest) !== migration.afterDigest) throw new Error('current manifest no longer matches the migration result');

  atomicWriteJson(manifestFile(projectRoot), migration.beforeManifest);
  const rolledBack: MigrationRecord = {
    ...migration,
    status: 'rolled-back',
    rolledBackAt: new Date().toISOString(),
  };
  atomicWriteJson(migrationPath, rolledBack);
  return rolledBack;
}

export function instanceStatus(projectRootInput: string, target: FrameworkIdentity): {
  manifest: InstanceManifest | null;
  verification: InstanceVerificationResult;
  latestMigration: MigrationRecord | null;
} {
  const projectRoot = resolveProjectRoot(projectRootInput);
  return {
    manifest: readInstanceManifest(projectRoot),
    verification: verifyInstance(projectRoot, target),
    latestMigration: latestMigration(projectRoot),
  };
}


export function runInstanceLifecycleSelfTest(options: {
  framework: FrameworkIdentity;
  frameworkRoot: string;
}): InstanceSelfTestResult {
  const startedAt = new Date().toISOString();
  const steps: InstanceSelfTestStep[] = [];
  const requiredSteps = [
    'instance-create',
    'pre-upgrade-verify',
    'upgrade-plan',
    'upgrade-apply',
    'migration-evidence',
    'backup-evidence',
    'post-upgrade-verify',
    'rollback',
    'post-rollback-verify',
    'business-file-unchanged',
    'framework-self-isolation',
    'cleanup',
  ];

  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-instance-self-test-'));
  const projectRoot = path.join(parent, 'business-project');
  const businessFile = path.join(projectRoot, 'package.json');
  const businessFileContent = '{"name":"awb-instance-self-test"}\n';
  const oldFramework: FrameworkIdentity = {
    version: `${options.framework.version}-self-test-old-${randomUUID().slice(0, 8)}`,
    revision: `self-test-old-${randomUUID().slice(0, 8)}`,
    capabilities: { ...options.framework.capabilities },
  };

  const pass = (id: string, detail: string) => {
    steps.push({ id, ok: true, detail });
  };
  const fail = (id: string, error: unknown) => {
    steps.push({
      id,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  };
  const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };

  let currentStep = 'instance-create';

  try {
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(businessFile, businessFileContent, 'utf8');

    currentStep = 'instance-create';
    const created = createInstance({
      projectRoot,
      name: 'awb-instance-self-test',
      framework: oldFramework,
      frameworkRoot: options.frameworkRoot,
    });
    assert(created.manifest.generation === 1, 'expected generation 1 after create');
    assert(created.manifest.framework.version === oldFramework.version, 'old Framework version was not persisted');
    pass(currentStep, `generation=1 · ${oldFramework.version} · ${oldFramework.revision}`);

    currentStep = 'pre-upgrade-verify';
    const beforeVerify = verifyInstance(projectRoot, options.framework);
    assert(beforeVerify.ok, 'pre-upgrade Instance structure should be valid');
    assert(!beforeVerify.upToDate, 'pre-upgrade Instance should require upgrade');
    pass(currentStep, 'ok=true · upToDate=false');

    currentStep = 'upgrade-plan';
    const plan = planInstanceUpgrade(projectRoot, options.framework);
    assert(plan.status === 'ready', `expected ready plan, got ${plan.status}`);
    assert(plan.actions.some((action) => action.kind === 'framework-version'), 'Framework version action missing');
    assert(plan.actions.some((action) => action.kind === 'framework-revision'), 'Framework revision action missing');
    pass(currentStep, `${plan.actions.length} action(s) · plan=${plan.planId}`);

    currentStep = 'upgrade-apply';
    const applied = applyInstanceUpgrade(projectRoot, plan.planId);
    assert(applied.applied, 'upgrade was not applied');
    assert(applied.manifest.generation === 2, 'expected generation 2 after apply');
    assert(applied.manifest.framework.version === options.framework.version, 'Framework version did not upgrade');
    assert(applied.manifest.framework.revision === options.framework.revision, 'Framework revision did not upgrade');
    pass(currentStep, `generation=2 · ${options.framework.version} · ${options.framework.revision}`);

    currentStep = 'migration-evidence';
    assert(applied.migration?.status === 'applied', 'applied migration evidence is missing');
    assert(Boolean(applied.migration?.beforeDigest && applied.migration?.afterDigest), 'migration digests are missing');
    pass(currentStep, `migration=${applied.migration?.migrationId}`);

    currentStep = 'backup-evidence';
    assert(Boolean(applied.migration?.backupPath && fs.existsSync(applied.migration.backupPath)), 'Manifest backup file is missing');
    pass(currentStep, applied.migration?.backupPath ?? 'backup present');

    currentStep = 'post-upgrade-verify';
    const afterVerify = verifyInstance(projectRoot, options.framework);
    assert(afterVerify.ok, 'post-upgrade Instance structure should be valid');
    assert(afterVerify.upToDate, 'post-upgrade Instance should match the current Framework');
    pass(currentStep, 'ok=true · upToDate=true');

    currentStep = 'rollback';
    const rolledBack = rollbackInstance(projectRoot, applied.migration?.migrationId);
    assert(rolledBack.status === 'rolled-back', 'migration did not enter rolled-back state');
    const restored = readInstanceManifest(projectRoot);
    assert(restored?.generation === 1, 'rollback did not restore generation 1');
    assert(restored?.framework.version === oldFramework.version, 'rollback did not restore old Framework version');
    assert(restored?.framework.revision === oldFramework.revision, 'rollback did not restore old Framework revision');
    pass(currentStep, 'generation restored to 1 · old Framework identity restored');

    currentStep = 'post-rollback-verify';
    const rollbackVerify = verifyInstance(projectRoot, options.framework);
    assert(rollbackVerify.ok, 'rolled-back Instance structure should remain valid');
    assert(!rollbackVerify.upToDate, 'rolled-back Instance should require upgrade again');
    pass(currentStep, 'ok=true · upToDate=false');

    currentStep = 'business-file-unchanged';
    assert(fs.readFileSync(businessFile, 'utf8') === businessFileContent, 'business file changed during lifecycle test');
    pass(currentStep, 'package.json unchanged across create / upgrade / rollback');

    currentStep = 'framework-self-isolation';
    try {
      createInstance({
        projectRoot: options.frameworkRoot,
        name: 'framework-self-should-fail',
        framework: options.framework,
        frameworkRoot: options.frameworkRoot,
      });
      throw new Error('Framework Self unexpectedly accepted as an Instance target');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(message.includes('external business project'), `unexpected isolation error: ${message}`);
      pass(currentStep, 'configured Framework Self rejected before Instance state is written');
    }
  } catch (error) {
    fail(currentStep, error);
  } finally {
    try {
      fs.rmSync(parent, { recursive: true, force: true });
      if (fs.existsSync(parent)) throw new Error('temporary self-test directory still exists');
      pass('cleanup', 'temporary project and all lifecycle evidence removed');
    } catch (error) {
      fail('cleanup', error);
    }
  }

  const ok = requiredSteps.every((id) => steps.some((step) => step.id === id && step.ok));
  return {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    framework: {
      version: options.framework.version,
      revision: options.framework.revision,
    },
    steps,
  };
}
