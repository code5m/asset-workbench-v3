import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from './config.ts';
import { listEnterpriseProviderSessions } from './enterpriseProviderCapture.ts';

type SupportedHook = 'codex' | 'codebuddy' | 'trae';
type Integration = SupportedHook | 'opencode' | 'chatgpt' | 'codearts' | 'workbuddy';
export interface GlobalProviderStatus {
  provider: Integration; configuration: 'configured' | 'not-configured' | 'blocked' | 'import-only';
  captureVerified: boolean; completedSessions: number; detail: string;
}
export interface ProviderSetupReport {
  provider: Integration; status: 'installed' | 'already-configured' | 'blocked' | 'import-only';
  detail: string; userLevel: true;
}
const EVENTS: Record<SupportedHook, string[]> = {
  codex: ['SessionStart','UserPromptSubmit','PostToolUse','Stop','SessionEnd'],
  codebuddy: ['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','PreCompact','Stop','SessionEnd'],
  trae: ['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Stop','Notification','SessionEnd'],
};
const bridge = path.join(APP_ROOT, 'scripts', 'capture-enterprise-provider-event.ts');
const SIGNATURE = 'capture-enterprise-provider-event.ts';
function home(): string {
  const raw = process.env.HOME;
  if (!raw || !path.isAbsolute(raw) || !fs.existsSync(raw)) throw new Error('HOME 目录不可用');
  return fs.realpathSync(raw);
}
function hooksPath(provider: SupportedHook): string {
  return path.join(home(), provider === 'codebuddy' ? '.codebuddy' : '.' + provider,
    provider === 'codebuddy' ? 'settings.json' : 'hooks.json');
}
function isSymlinkInPath(filename: string): boolean {
  const base = home();
  let rel = path.relative(base, path.dirname(filename));
  if (rel.startsWith('..') || path.isAbsolute(rel)) return true;
  let current = base;
  for (const part of rel.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) return true;
  }
  return fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink();
}
function safeAtomicUserWrite(filename: string, text: string) {
  if (isSymlinkInPath(filename)) throw new Error('拒绝修改符号链接的用户 Provider 配置');
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temp = filename + '.awb-' + process.pid + '.tmp';
  fs.writeFileSync(temp, text, { mode: 0o600 });
  fs.renameSync(temp, filename);
}
function readConfig(filename: string): Record<string, unknown> {
  if (!fs.existsSync(filename)) return {};
  const raw = JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('用户配置不是 JSON 对象');
  return raw as Record<string, unknown>;
}
function configured(provider: SupportedHook): boolean {
  try {
    const file = hooksPath(provider);
    const data = readConfig(file);
    return JSON.stringify(data.hooks || {}).includes(SIGNATURE);
  } catch { return false; }
}
function installUserHooks(provider: SupportedHook): ProviderSetupReport {
  const file = hooksPath(provider);
  if (isSymlinkInPath(file)) return { provider, status: 'blocked', detail: '用户级配置存在符号链接，拒绝修改', userLevel: true };
  let current: Record<string, unknown>;
  try { current = readConfig(file); }
  catch { return { provider, status: 'blocked', detail: '用户已有配置无法安全解析，保持原样', userLevel: true }; }
  if (current.hooks !== undefined && (typeof current.hooks !== 'object' || current.hooks === null || Array.isArray(current.hooks))) {
    return { provider, status: 'blocked', detail: '已有 Hooks 格式不支持合并，保持原样', userLevel: true };
  }
  const hooks = { ...(current.hooks as Record<string, unknown> | undefined) };
  const command = 'node --experimental-strip-types ' + JSON.stringify(bridge) + ' --provider=' + provider;
  let modified = false;
  for (const event of EVENTS[provider]) {
    const previous = hooks[event];
    if (previous !== undefined && !Array.isArray(previous)) {
      return { provider, status: 'blocked', detail: event + ' 现有规则无法安全合并', userLevel: true };
    }
    const existing = (previous ?? []) as unknown[];
    if (JSON.stringify(existing).includes(SIGNATURE)) continue;
    hooks[event] = [...existing, {
      ...(event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure' ? { matcher: '.*' } : {}),
      hooks: [{ type: 'command', command, timeout: 3 }],
    }];
    modified = true;
  }
  if (!modified) return { provider, status: 'already-configured', detail: '用户级采集 Hook 已存在，待真实会话验证', userLevel: true };
  if (fs.existsSync(file)) {
    const backup = file + '.awb-original-backup';
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  }
  safeAtomicUserWrite(file, JSON.stringify({ ...current, hooks }, null, 2) + '\n');
  return { provider, status: 'installed', detail: '已保留已有 Hooks；只在已登记受管工作区接受事件，仍需真实 Provider E2E', userLevel: true };
}
function globalOpenCodePlugin(): string {
  return path.join(home(), '.config', 'opencode', 'plugins', 'awb-enterprise-capture.js');
}
function legacyOpenCodeSource(): string {
  const script = JSON.stringify(bridge);
  return `/**
 * Asset Workbench user-level OpenCode plugin: no writes to project directories.
 * Events from projects not registered as managed workspaces are ignored.
 */
import { spawnSync } from 'node:child_process';
export const AssetWorkbenchEnterpriseCapture = async (ctx) => {
  const directory = ctx?.directory || process.cwd();
  const forward = (event) => {
    try {
      const info = event?.properties || {};
      const sessionID = info.sessionID || info.sessionId || info.part?.sessionID || info.message?.sessionID;
      if (!sessionID) return;
      spawnSync(process.execPath, ['--experimental-strip-types', ${script}, '--provider=opencode'], {
        cwd: directory, timeout: 3500, maxBuffer: 4096,
        input: JSON.stringify({ ...event, sessionID, projectDirectory: directory, receivedAt: new Date().toISOString() }),
        stdio: ['pipe','ignore','ignore'],
      });
    } catch { /* observation-only */ }
  };
  return {
    event: async (input) => forward(input?.event || input),
    'tool.execute.before': async (input) => forward({ type: 'tool.execute.before', properties: input || {} }),
    'tool.execute.after': async (input, output) => forward({ type: 'tool.execute.after', properties: input || {}, output }),
  };
};
export default AssetWorkbenchEnterpriseCapture;
`;
}
function openCodeSource(): string {
  const script = JSON.stringify(bridge);
  return `/**
 * Asset Workbench user-level OpenCode plugin.
 * One persistent asynchronous JSONL worker per plugin instance; no per-token
 * spawnSync and no project-local configuration/data writes.
 */
import { spawn } from 'node:child_process';
export const AssetWorkbenchEnterpriseCapture = async (ctx) => {
  const directory = ctx?.directory || process.cwd();
  let worker = null;
  let blocked = false;
  let dropped = 0;
  const forward = (event) => {
    try {
      const info = event?.properties || {};
      const sessionID = info.sessionID || info.sessionId || info.part?.sessionID
        || info.message?.sessionID || info.info?.id || info.session?.id;
      if (!sessionID) return;
      const record = { ...event, sessionID, projectDirectory: directory, receivedAt: new Date().toISOString() };
      const data = JSON.stringify(record);
      if (!data || Buffer.byteLength(data) > 128 * 1024) { dropped += 1; return; }
      if (!worker || worker.exitCode !== null || worker.killed) {
        worker = spawn(process.execPath, ['--experimental-strip-types', ${script}, '--provider=opencode', '--stream'], {
          cwd: directory, stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true,
        });
        const active = worker;
        active.on('error', () => { if (worker === active) { worker = null; blocked = false; } });
        active.on('close', () => { if (worker === active) { worker = null; blocked = false; } });
        active.stdin.on('error', () => { if (worker === active) { worker = null; blocked = false; } });
        active.stdin.on('drain', () => { blocked = false; });
      }
      if (blocked) { dropped += 1; return; }
      if (dropped > 0) {
        const warning = { type: 'Notification', sessionID, projectDirectory: directory,
          content: 'Provider capture overloaded; ' + dropped + ' events not persisted',
          receivedAt: new Date().toISOString() };
        dropped = 0;
        blocked = !worker.stdin.write(JSON.stringify(warning) + String.fromCharCode(10));
        if (blocked) return;
      }
      blocked = !worker.stdin.write(data + String.fromCharCode(10));
    } catch { dropped += 1; /* observer must never interrupt the IDE */ }
  };
  return {
    event: async (input) => forward(input?.event || input),
    'tool.execute.before': async (input) => forward({ type: 'tool.execute.before', properties: input || {} }),
    'tool.execute.after': async (input, output) => forward({
      type: 'tool.execute.after', properties: input || {}, output,
    }),
  };
};
export default AssetWorkbenchEnterpriseCapture;
`;
}

function installOpenCode(): ProviderSetupReport {
  const provider = 'opencode';
  const target = globalOpenCodePlugin();
  if (isSymlinkInPath(target)) return { provider, status: 'blocked', detail: '用户插件路径是符号链接，拒绝覆盖', userLevel: true };
  const content = openCodeSource();
  if (fs.existsSync(target)) {
    const installed = fs.readFileSync(target, 'utf8');
    if (installed === content) return { provider, status: 'already-configured', detail: '异步流式 OpenCode 用户插件已配置，待真实会话验证', userLevel: true };
    if (installed !== legacyOpenCodeSource()) {
      return { provider, status: 'blocked', detail: '用户插件内容不同，拒绝覆盖个性化配置', userLevel: true };
    }
    const backup = target + '.awb-original-backup';
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
    safeAtomicUserWrite(target, content);
    return { provider, status: 'installed', detail: '已升级旧版同步 OpenCode 插件为异步流式采集，旧版本已备份', userLevel: true };
  }
  safeAtomicUserWrite(target, content);
  return { provider, status: 'installed', detail: '已安装用户级插件，不修改任何业务仓库', userLevel: true };
}
export function setupEnterpriseUserProviderHooks(confirmation: string): ProviderSetupReport[] {
  if (process.env.AWB_INSTANCE_PROJECT_ROOT) throw new Error('只允许中央 Framework 配置用户级 Provider Hooks');
  if (confirmation !== 'INSTALL_USER_LEVEL_PROVIDER_HOOKS') throw new Error('安装用户级 Hooks 需要明确授权');
  const result: ProviderSetupReport[] = ['codex','codebuddy','trae'].map(value => installUserHooks(value as SupportedHook));
  result.push(installOpenCode());
  for (const provider of ['chatgpt','codearts','workbuddy'] as Integration[]) {
    result.push({ provider, status: 'import-only', detail: '不安装未经确认的用户级 Hook，需官方导出/API 或明确授权', userLevel: true });
  }
  return result;
}
export function enterpriseProviderStatuses(root: string): GlobalProviderStatus[] {
  const sessions = listEnterpriseProviderSessions(root);
  return (['codex','codebuddy','trae','opencode','chatgpt','codearts','workbuddy'] as Integration[]).map(provider => {
    const verified = sessions.filter(s => s.provider === provider && s.status === 'ended' && s.transcriptPath);
    const isInstalled = provider === 'opencode'
      ? (() => { try { return fs.existsSync(globalOpenCodePlugin())
        && fs.readFileSync(globalOpenCodePlugin(), 'utf8').includes(SIGNATURE); } catch { return false; } })()
      : ['codex','codebuddy','trae'].includes(provider) ? configured(provider as SupportedHook) : false;
    return {
      provider,
      configuration: ['chatgpt','codearts','workbuddy'].includes(provider)
        ? 'import-only' : isInstalled ? 'configured' : 'not-configured',
      captureVerified: verified.length > 0,
      completedSessions: verified.length,
      detail: verified.length
        ? '已找到真实保存并结束的会话；需进一步校验 Provider 官方事件来源'
        : isInstalled ? '配置存在，但尚未观察到真实完成的 Provider 会话'
          : '没有真实采集证据；需配置支持的用户级 Hook 或官方导入',
    };
  });
}
