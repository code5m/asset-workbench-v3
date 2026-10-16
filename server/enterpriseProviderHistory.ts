import fs from 'node:fs';
import path from 'node:path';
import { appendEnterpriseProviderEvent, listEnterpriseProviderSessions } from './enterpriseProviderCapture.ts';
import { canonicalEnterpriseRoot, readEnterpriseRegistry } from './enterpriseStorage.ts';

function under(base: string, source: string) {
  const parent = fs.realpathSync(base);
  const actual = fs.realpathSync(source);
  if (!actual.startsWith(parent + path.sep) || !fs.statSync(actual).isFile()
    || fs.statSync(actual).size > 64 * 1024 * 1024) throw new Error('历史会话必须位于受信任的 Provider 数据目录中');
  return actual;
}
const home = () => {
  const value = process.env.HOME;
  if (!value) throw new Error('HOME is not configured');
  return fs.realpathSync(value);
};
/** Codex official JSONL history carries its own session_meta.cwd. */
export function importEnterpriseCodexHistory(source: string): { imported: number; duplicates: number; workspaceId: string; sessionId: string } {
  const root = path.join(home(), '.codex', 'sessions');
  const file = under(root, source);
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const records = lines.flatMap(line => {
    try { return [JSON.parse(line) as Record<string, any>]; }
    catch { return []; }
  });
  const meta = records.find(v => v.type === 'session_meta')?.payload;
  if (!meta || typeof meta.cwd !== 'string' || typeof meta.session_id !== 'string') {
    throw new Error('历史 Codex 会话缺少官方 cwd/session_id 证据，不允许自动归属');
  }
  let imported = 0, duplicates = 0, workspaceId = '';
  for (const [ordinal, row] of records.entries()) {
    const payload = row.payload || {};
    const data = payload.item || payload;
    const role = data.role;
    const text = Array.isArray(data.content)
      ? data.content.map((p: Record<string, unknown>) => typeof p.text === 'string' ? p.text : '')
        .filter(Boolean).join('\n')
      : typeof data.text === 'string' ? data.text : '';
    if ((role !== 'user' && role !== 'assistant') || !text) continue;
    const result = appendEnterpriseProviderEvent({
      provider: 'codex', providerSessionId: meta.session_id, captureSource: 'official-import',
      hookEventName: role === 'user' ? 'UserPromptSubmit' : 'Stop',
      cwd: meta.cwd, eventId: 'codex-history:' + meta.session_id + ':' + ordinal,
      timestamp: typeof row.timestamp === 'string' ? row.timestamp : undefined,
      role, content: text, rawPayload: { source: 'official-history', ordinal, role },
    });
    workspaceId = result.state.workspaceId;
    imported += Number(result.accepted); duplicates += Number(result.duplicate);
  }
  return { imported, duplicates, workspaceId, sessionId: meta.session_id };
}
/**
 * A CodeBuddy transcript has no independent project root proof.
 * It can only supplement an already-observed, cwd-pinned live hook session.
 */
export function importEnterpriseCodeBuddyHistory(source: string, providerSessionId: string): {
  imported: number; duplicates: number; workspaceId: string; missing: number;
} {
  const base = path.join(home(), '.local', 'share', 'CodeBuddyExtension', 'Data');
  const file = under(base, source);
  const folder = path.dirname(file);
  const index = path.join(folder, 'index.json');
  if (path.basename(file) !== 'index.json' && !fs.existsSync(index)) {
    throw new Error('官方 CodeBuddy 会话索引缺失');
  }
  const candidates = readEnterpriseRegistry().filter(x => x.sourcePolicy === 'managed');
  const matches = candidates.flatMap(x => listEnterpriseProviderSessions(x.projectRoot)
    .filter(s => s.provider === 'codebuddy' && s.providerSessionId === providerSessionId && s.status === 'active'));
  if (matches.length !== 1) throw new Error('无法唯一找到真实 Hook 绑定的 CodeBuddy 项目会话');
  const state = matches[0];
  const structure = JSON.parse(fs.readFileSync(index, 'utf8')) as { requests?: Array<{ messages?: string[] }> };
  const ids = [...new Set((structure.requests ?? []).flatMap(item => item.messages || []))];
  let imported = 0, duplicates = 0, missing = 0;
  for (const [ordinal, id] of ids.entries()) {
    if (!/^[\w.-]{1,150}$/.test(id) || id.includes('..')) { missing++; continue; }
    const message = path.join(folder, 'messages', id + '.json');
    if (!fs.existsSync(message)) { missing++; continue; }
    try {
      const container = JSON.parse(fs.readFileSync(message, 'utf8')) as {
        message?: string; createdAt?: string | number;
      };
      const value = JSON.parse(container.message || '{}') as {
        role?: string; content?: Array<{ type?: string; text?: string }>;
      };
      if (value.role !== 'assistant' && value.role !== 'user') continue;
      const text = (value.content || []).filter(x => x.type === 'text')
        .map(x => x.text || '').filter(Boolean).join('\n');
      if (!text) continue;
      const result = appendEnterpriseProviderEvent({
        provider: 'codebuddy', providerSessionId, captureSource: 'official-import',
        hookEventName: value.role === 'user' ? 'UserPromptSubmit' : 'Stop',
        cwd: state.cwd, eventId: 'codebuddy-history:' + providerSessionId + ':' + id + ':' + ordinal,
        timestamp: typeof container.createdAt === 'string' ? container.createdAt : undefined,
        role: value.role, content: text, rawPayload: { source: 'official-CodeBuddy-history', messageId: id },
      });
      imported += Number(result.accepted); duplicates += Number(result.duplicate);
    } catch { missing++; }
  }
  return { imported, duplicates, workspaceId: state.workspaceId, missing };
}
