import { useEffect, useState } from 'react';
import {
  AlertTriangle, Archive, Blocks, BookMarked, BookOpen, ChevronRight,
  FileText, Files, Folder, FolderTree, MessagesSquare, Network,
  PanelsTopLeft, PencilRuler, Plug, RefreshCw, Server, Settings,
  Terminal, Wrench, type LucideIcon,
} from 'lucide-react';
import type { AssetNode } from '../domain/asset';
import { assetClient } from '../services/assetClient';
import {
  BEGINNER_ROLE_NAMES,
  beginnerRootRole,
  getBeginnerDirectoryGuide,
} from '../data/beginnerDirectoryGuide';
import { useI18n } from '../i18n/I18nProvider';

type Mode = 'framework-self' | 'business-project';

const ICONS: Record<string, LucideIcon> = {
  '00-introduction': BookOpen,
  '01-code': Archive,
  '02-design': PencilRuler,
  '03-docs': Files,
  '04-conversations': MessagesSquare,
  '05-derived': Network,
  src: PanelsTopLeft,
  server: Server,
  packages: Blocks,
  providers: Plug,
  docs: BookMarked,
  public: Folder,
  scripts: Terminal,
  tools: Wrench,
  '.github': Settings,
  '.codex': Settings,
  '.codebuddy': Settings,
  '.opencode': Settings,
  '.trae': Settings,
};

export function RealDirectoryOverview({ onOpenAsset }: { onOpenAsset: (path: string) => void }) {
  const { loc, lang } = useI18n();
  const [entries, setEntries] = useState<AssetNode[] | null>(null);
  const [rootName, setRootName] = useState('');
  const [mode, setMode] = useState<Mode>('framework-self');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const reload = async () => {
      try {
        const [cfg, tree] = await Promise.all([assetClient.config(), assetClient.tree('')]);
        if (!alive) return;
        setMode(cfg.mode);
        setRootName(tree.parent.name || '/');
        setEntries(tree.children);
        setError('');
      } catch (cause) {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setEntries(null); // A scan error must never leave a misleading "real" tree.
      } finally {
        if (alive) setLoading(false);
      }
    };
    void reload();
    const events = assetClient.events();
    events.onmessage = (event) => {
      try {
        const change = JSON.parse(event.data) as { type: string; invalidatedPaths?: string[] };
        if (change.type === 'scan' || (change.type === 'refresh' && (change.invalidatedPaths ?? ['']).includes(''))) {
          void reload();
        }
      } catch {
        // Ignore malformed status events, not filesystem errors.
      }
    };
    return () => {
      alive = false;
      events.close();
    };
  }, []);

  const zh = lang === 'zh-CN';
  return (
    <section className="panel beginner-root-overview" aria-label={zh ? '真实项目目录' : 'Real project directory'}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{zh ? '第一眼看懂项目' : 'Understand at a glance'}</p>
          <h2>{zh ? '这就是项目的真实目录' : 'This is the real project directory'}</h2>
          <p className="beginner-root-lead">{zh
            ? '名字和层级来自真实文件夹。彩色图标、中文解释只是帮助理解，不是额外的目录。'
            : 'Names and levels come from the actual filesystem. Icons and explanations are not extra folders.'}</p>
        </div>
        <FolderTree size={26} aria-hidden="true" />
      </div>
      <div className="beginner-root-identity">
        <Folder size={18} aria-hidden="true" />
        <strong>{rootName || (zh ? '正在读取项目…' : 'Reading project…')}</strong>
        <span>{mode === 'framework-self'
          ? (zh ? '工作台自己的项目' : 'Workbench itself')
          : (zh ? '当前真实业务项目' : 'Current real business project')}</span>
        <button type="button" onClick={() => { setLoading(true); void assetClient.tree('').then((tree) => { setEntries(tree.children); setRootName(tree.parent.name || '/'); setError(''); }).catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setEntries(null); }).finally(() => setLoading(false)); }} title={zh ? '重新读取目录' : 'Reload directory'} aria-label={zh ? '重新读取目录' : 'Reload directory'}>
          <RefreshCw size={15} />
        </button>
      </div>
      {loading && !entries ? <p className="detail-summary">{zh ? '正在读取真实目录…' : 'Reading real folders…'}</p> : null}
      {error ? <div className="banner error" role="alert"><AlertTriangle size={17} />{zh ? '目录读取失败：' : 'Directory read failed: '}{error}</div> : null}
      {entries ? (
        <div className="beginner-root-grid">
          {entries.map((node) => {
            const guide = node.kind === 'directory' ? getBeginnerDirectoryGuide(node.relativePath, mode) : undefined;
            const role = beginnerRootRole(node.relativePath, mode);
            const Icon = node.kind === 'directory' ? ICONS[node.name] ?? Folder : FileText;
            return (
              <button
                type="button"
                className="beginner-root-entry"
                data-role={role}
                key={node.id}
                onClick={() => onOpenAsset(node.relativePath)}
                title={node.relativePath}
              >
                <span className="beginner-root-icon"><Icon size={19} aria-hidden="true" /></span>
                <span className="beginner-root-text">
                  <strong>{node.name}</strong>
                  <small>{guide ? loc(guide.summary) : node.kind === 'directory'
                    ? (zh ? '真实文件夹 · 点击看看里面有什么' : 'Real folder · open to explore')
                    : (zh ? '真实文件 · 点击查看' : 'Real file · open to view')}</small>
                </span>
                <span className="beginner-root-role">{loc(BEGINNER_ROLE_NAMES[role])}</span>
                <ChevronRight size={15} aria-hidden="true" className="beginner-root-arrow" />
              </button>
            );
          })}
        </div>
      ) : null}
      {entries?.length === 0 ? <p className="detail-summary">{zh ? '当前根目录没有可浏览的条目。' : 'No browsable entries in this directory.'}</p> : null}
      <p className="beginner-root-footnote">
        {zh
          ? '说明：上面列出扫描器允许浏览的全部顶层目录和文件，并没有生成虚拟目录。像 .git、运行数据、编译缓存等技术内容会按统一的安全与性能规则排除；这不表示它们一定不存在。'
          : 'All browsable root entries come from the scanner. Technical paths such as .git, runtime data, and build caches are skipped by safety/performance policy; they may still exist on disk.'}
      </p>
    </section>
  );
}
