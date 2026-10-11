import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from './config.ts';

type ProviderId = 'codex' | 'codebuddy' | 'opencode' | 'trae';
type SetupStatus = 'installed' | 'already-configured' | 'blocked-existing-config' | 'blocked-source-missing';
export interface ProviderSetupResult { provider: ProviderId; status: SetupStatus; detail: string; }
const PROVIDER_EVENTS: Record<'codex' | 'codebuddy' | 'trae', string[]> = {
  codex: ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'SessionEnd'],
  codebuddy: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PreCompact', 'Stop', 'SessionEnd'],
  trae: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'],
};
const INTEGRATION_SIGNATURE = 'scripts/capture-provider-event.ts';

function safeProjectRoot(projectRoot: string): string {
  const project = fs.realpathSync(projectRoot);
  if (!fs.statSync(project).isDirectory() || project === fs.realpathSync(APP_ROOT)) {
    throw new Error('Provider setup requires a distinct existing business project directory');
  }
  return project;
}
function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.awb-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, content, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function commandFor(provider: 'codex' | 'codebuddy' | 'trae'): string {
  return 'node --experimental-strip-types ' + JSON.stringify(path.join(APP_ROOT, INTEGRATION_SIGNATURE))
    + ' --provider ' + provider;
}
function containsManagedHook(hooks: unknown): boolean {
  return JSON.stringify(hooks).includes(INTEGRATION_SIGNATURE);
}
function setupHooks(root: string, provider: 'codex' | 'codebuddy' | 'trae'): ProviderSetupResult {
  const file = provider === 'codebuddy'
    ? path.join(root, '.codebuddy', 'settings.json')
    : path.join(root, '.' + provider, 'hooks.json');
  let config: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Invalid configuration');
      config = parsed as Record<string, unknown>;
    } catch {
      return { provider, status: 'blocked-existing-config', detail: 'Existing provider configuration is not valid JSON; left unchanged.' };
    }
  }
  if (config.hooks !== undefined && (!config.hooks || Array.isArray(config.hooks) || typeof config.hooks !== 'object')) {
    return { provider, status: 'blocked-existing-config', detail: 'Existing hooks shape is not mergeable; left unchanged.' };
  }
  const hooks = { ...(config.hooks as Record<string, unknown> | undefined) };
  const command = commandFor(provider);
  let dirty = false;
  for (const name of PROVIDER_EVENTS[provider]) {
    const existing = hooks[name];
    if (existing !== undefined && !Array.isArray(existing)) {
      return { provider, status: 'blocked-existing-config', detail: 'Existing ' + name + ' hooks are not mergeable; left unchanged.' };
    }
    const entries = (existing ?? []) as Array<unknown>;
    if (entries.some((entry) => containsManagedHook(entry))) {
      // Preserve previous framework-generated hooks and all user-defined entries.
      continue;
    }
    const entry: Record<string, unknown> = {
      hooks: [{ type: 'command', command, timeout: provider === 'codebuddy' ? 5 : 3 }],
    };
    if (name === 'PreToolUse' || name === 'PostToolUse' || name === 'PostToolUseFailure') entry.matcher = '.*';
    hooks[name] = [...entries, entry];
    dirty = true;
  }
  if (!dirty) return { provider, status: 'already-configured', detail: 'Managed hook entries already exist.' };
  atomicWrite(file, JSON.stringify({ ...config, hooks }, null, 2) + '\n');
  return { provider, status: 'installed', detail: 'Merged supported hooks, preserving unrelated user settings.' };
}
function setupOpenCode(root: string): ProviderSetupResult {
  const provider = 'opencode';
  const source = path.join(APP_ROOT, '.opencode', 'plugins', 'awb-capture.js');
  const target = path.join(root, '.opencode', 'plugins', 'awb-capture.js');
  if (!fs.existsSync(source)) return { provider, status: 'blocked-source-missing', detail: 'Official observer plugin template missing.' };
  const template = fs.readFileSync(source, 'utf8');
  if (fs.existsSync(target)) {
    return fs.readFileSync(target, 'utf8') === template
      ? { provider, status: 'already-configured', detail: 'OpenCode plugin is installed.' }
      : { provider, status: 'blocked-existing-config', detail: 'Existing OpenCode plugin differs; left unchanged instead of overwriting user code.' };
  }
  atomicWrite(target, template);
  return { provider, status: 'installed', detail: 'Project-local OpenCode plugin installed.' };
}

/** Idempotent project-level installation. Never copies project content or writes credentials. */
export function setupProjectProviders(projectRoot: string): ProviderSetupResult[] {
  const root = safeProjectRoot(projectRoot);
  return [setupHooks(root, 'codex'), setupHooks(root, 'codebuddy'), setupOpenCode(root), setupHooks(root, 'trae')];
}
