import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertSafeEnterpriseManagedPath, canonicalEnterpriseRoot, enterpriseEntryForRoot } from './enterpriseStorage.ts';
import { discoverEnterpriseWorkspace } from './enterpriseWorkspace.ts';
import { readEnterprisePrivateFile } from './enterprisePrivateIO.ts';

export interface EnterpriseKnowledgeNote {
  id: string; workspaceId: string; title: string; content: string; repository: string | null;
  module: string | null; source: 'manual'; createdAt: string;
}
function notesDir(root: string) {
  const canonical = canonicalEnterpriseRoot(root);
  if (enterpriseEntryForRoot(canonical)?.sourcePolicy !== 'managed') throw new Error('Only managed workspace can store knowledge');
  const base = path.join(canonical, '.asset-workbench-data');
  if (!fs.existsSync(base) || !fs.lstatSync(base).isDirectory() || fs.lstatSync(base).isSymbolicLink()) {
    throw new Error('Invalid managed data directory');
  }
  const folder = assertSafeEnterpriseManagedPath(canonical, 'knowledge/notes');
  for (const segment of [path.join(base, 'knowledge'), folder]) {
    if (fs.existsSync(segment) && fs.lstatSync(segment).isSymbolicLink()) throw new Error('Knowledge directory is a symlink');
  }
  return folder;
}
export function listEnterpriseKnowledgeNotes(root: string): EnterpriseKnowledgeNote[] {
  const dir = notesDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(x => /^knowledge_[0-9a-f-]{36}\.json$/.test(x))
    .flatMap(name => {
      try {
        const note = JSON.parse(readEnterprisePrivateFile(path.join(dir, name), 256 * 1024).toString('utf8')) as EnterpriseKnowledgeNote;
        return note.workspaceId === enterpriseEntryForRoot(root)?.workspaceId ? [note] : [];
      } catch { return []; }
    }).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
}
export function createEnterpriseKnowledgeNote(root: string, input: {
  title: string; content: string; repository?: string | null; module?: string | null;
}): EnterpriseKnowledgeNote {
  const dir = notesDir(root);
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) throw new Error('Invalid knowledge title');
  if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > 50_000) throw new Error('Invalid knowledge content');
  const repository = input.repository || null;
  if (repository) {
    const candidates = discoverEnterpriseWorkspace(root).repositories;
    if (!candidates.some(repo => repo.path === repository)) throw new Error('Knowledge repository is not registered under this workspace');
  }
  const id = 'knowledge_' + randomUUID();
  const note: EnterpriseKnowledgeNote = {
    id, workspaceId: enterpriseEntryForRoot(root)!.workspaceId,
    title: input.title.trim(), content: input.content, repository,
    module: typeof input.module === 'string' && input.module.length < 500 ? input.module : null,
    source: 'manual', createdAt: new Date().toISOString(),
  };
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(note, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return note;
}
