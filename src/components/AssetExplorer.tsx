import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, RefreshCw, AlertTriangle, Plus } from 'lucide-react';
import { assetClient } from '../services/assetClient';
import type { FrameworkFocus } from '../domain/workspace';
import type {
  AssetContent,
  AssetNode,
  ExpectedSkeletonEntry,
  ManagedAssetMetadata,
  ManagedAssetResult,
  RepositoryRevision,
} from '../domain/asset';
import { useI18n } from '../i18n/I18nProvider';
import { ROOT_TREE_GROUP_ORDER, assetTreePurposeKey, nestedTreeEntryHelp, rootTreeGroupHintKey, rootTreeGroupKey, rootTreePresentation } from '../domain/rootTreePresentation';
import { CreateAssetDialog, type CreateMode, type PromoteFrom } from './CreateAssetDialog';
import { KnowledgeLifecycle } from './KnowledgeLifecycle';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type LoadStatus = 'loading' | 'ready' | 'error';

export function AssetExplorer({ deepLink, onOpenFramework }: { deepLink: { path: string; token: number } | null; onOpenFramework: (focus: FrameworkFocus) => void }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [rootChildren, setRootChildren] = useState<AssetNode[]>([]);
  const [childrenCache, setChildrenCache] = useState<Record<string, AssetNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<AssetNode | null>(null);
  const [content, setContent] = useState<AssetContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState('');
  const [skeleton, setSkeleton] = useState<ExpectedSkeletonEntry[]>([]);
  const [stats, setStats] = useState<{ nodeCount: number; fileCount: number; directoryCount: number } | null>(null);
  const [repoCount, setRepoCount] = useState(0);
  const [scannedAt, setScannedAt] = useState('');
  const [watcher, setWatcher] = useState<'connected' | 'disconnected'>('disconnected');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [promoteFrom, setPromoteFrom] = useState<PromoteFrom | null>(null);
  const [managedMeta, setManagedMeta] = useState<ManagedAssetMetadata | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<'framework-self' | 'business-project'>('framework-self');
  const expandedRef = useRef<Set<string>>(new Set());

  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  const refreshTree = useCallback(
    async (keepSelection: boolean) => {
      const tree = await assetClient.tree('');
      setRootChildren(tree.children);
      setStats({ nodeCount: tree.nodeCount, fileCount: tree.fileCount, directoryCount: tree.directoryCount });
      setScannedAt(tree.parent.modifiedAt);
      const sk = await assetClient.skeleton();
      setSkeleton(sk);
      const repos = await assetClient.repositories();
      setRepoCount(repos.length);
      if (!keepSelection) return;
      // Re-fetch any expanded directory so the tree stays current without
      // collapsing the user's navigation.
      setExpanded((prevExpanded) => {
        const nextCache: Record<string, AssetNode[]> = {};
        let pending = Promise.resolve();
        for (const rel of prevExpanded) {
          pending = pending.then(async () => {
            try {
              const t2 = await assetClient.tree(rel);
              nextCache[rel] = t2.children;
            } catch {
              // node may have been removed; leave it out
            }
          });
        }
        Promise.resolve(pending).then(() => setChildrenCache(nextCache));
        return prevExpanded;
      });
    },
    [],
  );

  const loadAll = useCallback(async () => {
    try {
      setStatus('loading');
      const cfg = await assetClient.config();
      setRuntimeMode(cfg.mode);
      await assetClient.workspace();
      await refreshTree(false);
      setStatus('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [refreshTree]);

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [loadAll]);

  useEffect(() => {
    const es = assetClient.events();
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type: string; invalidatedPaths?: string[] };
        if (data.type === 'connected') {
          setWatcher('connected');
        } else if (data.type === 'scan') {
          setWatcher('connected');
          refreshTree(true).catch(() => undefined);
        } else if (data.type === 'refresh') {
          setWatcher('connected');
          const invalidated = new Set(data.invalidatedPaths ?? ['']);
          const reload = async () => {
            const nextCache: Record<string, AssetNode[]> = {};
            if (invalidated.has('')) {
              const root = await assetClient.tree('');
              setRootChildren(root.children);
              setStats({ nodeCount: root.nodeCount, fileCount: root.fileCount, directoryCount: root.directoryCount });
              setScannedAt(root.parent.modifiedAt);
              const [sk, repos] = await Promise.all([assetClient.skeleton(), assetClient.repositories()]);
              setSkeleton(sk);
              setRepoCount(repos.length);
            }
            for (const rel of expandedRef.current) {
              if (!invalidated.has(rel)) continue;
              try {
                const subtree = await assetClient.tree(rel);
                nextCache[rel] = subtree.children;
              } catch {
                nextCache[rel] = [];
              }
            }
            if (Object.keys(nextCache).length > 0) setChildrenCache((prev) => ({ ...prev, ...nextCache }));
          };
          reload().catch(() => undefined);
        } else if (data.type === 'error') {
          setWatcher('connected');
        }
      } catch {
        // ignore malformed event
      }
    };
    es.onerror = () => setWatcher('disconnected');
    return () => es.close();
  }, [refreshTree]);

  const toggleExpand = useCallback(
    async (node: AssetNode) => {
      if (node.kind !== 'directory') return;
      const isOpen = expanded.has(node.relativePath);
      if (isOpen) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(node.relativePath);
          return next;
        });
        return;
      }
      if (!childrenCache[node.relativePath]) {
        try {
          const tree = await assetClient.tree(node.relativePath);
          setChildrenCache((prev) => ({ ...prev, [node.relativePath]: tree.children }));
        } catch {
          // leave empty; selection still works
        }
      }
      setExpanded((prev) => new Set(prev).add(node.relativePath));
    },
    [expanded, childrenCache],
  );

  const selectNode = useCallback((node: AssetNode) => {
    setSelected(node);
    setManagedMeta(null);
    if (node.kind === 'file') {
      setContentLoading(true);
      setContentError('');
      setContent(null);
      assetClient
        .content(node.relativePath)
        .then((c) => {
          setContent(c);
          setContentLoading(false);
        })
        .catch((e) => {
          setContentError(e instanceof Error ? e.message : String(e));
          setContentLoading(false);
        });
      if (node.managedType) {
        assetClient.getManagedAsset(node.relativePath).then(setManagedMeta).catch(() => setManagedMeta(null));
      }
    } else {
      setContent(null);
      setContentLoading(false);
      setContentError('');
    }
  }, []);

  const openCreate = useCallback((mode: CreateMode, from: PromoteFrom | null = null) => {
    setPromoteFrom(from);
    setCreateMode(mode);
    setCreateMenuOpen(false);
  }, []);

  // Deep-link: open a specific path coming from the homepage (asset category or
  // key document). Expands every ancestor so the target node is rendered, then
  // selects it and (for files) loads its content on the right panel.
  const openPath = useCallback(
    async (rel: string) => {
      const clean = rel.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!clean) return;
      const parts = clean.split('/');
      const localCache: Record<string, AssetNode[]> = {};
      for (let i = 1; i < parts.length; i += 1) {
        const dirRel = parts.slice(0, i).join('/');
        if (childrenCache[dirRel]) {
          localCache[dirRel] = childrenCache[dirRel];
          continue;
        }
        try {
          const sub = await assetClient.tree(dirRel);
          localCache[dirRel] = sub.children;
        } catch {
          localCache[dirRel] = [];
        }
      }
      const parentRel = parts.slice(0, -1).join('/');
      const siblings = parentRel === '' ? rootChildren : (localCache[parentRel] ?? []);
      const node = siblings.find((n) => n.relativePath === clean);
      if (!node) return;
      setChildrenCache((prev) => ({ ...prev, ...localCache }));
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const key of Object.keys(localCache)) next.add(key);
        next.add(clean);
        return next;
      });
      if (node.kind === 'directory' && !childrenCache[clean]) {
        try {
          const sub = await assetClient.tree(clean);
          setChildrenCache((prev) => ({ ...prev, [clean]: sub.children }));
        } catch {
          // node may have been removed; selection still works
        }
      }
      selectNode(node);
    },
    [childrenCache, rootChildren, selectNode],
  );

  const handleCreated = useCallback(
    async (result: ManagedAssetResult) => {
      setCreateMode(null);
      setPromoteFrom(null);
      try {
        await assetClient.scan();
      } catch {
        // server re-scans on write; best-effort
      }
      openPath(result.path).catch(() => undefined);
    },
    [openPath],
  );

  // Consume a deep-link request once the tree is ready.
  const pendingDeepLinkRef = useRef<{ path: string } | null>(null);
  useEffect(() => {
    if (deepLink) pendingDeepLinkRef.current = { path: deepLink.path };
  }, [deepLink?.token]);

  useEffect(() => {
    if (status !== 'ready') return;
    const pending = pendingDeepLinkRef.current;
    if (!pending) return;
    pendingDeepLinkRef.current = null;
    openPath(pending.path).catch(() => undefined);
  }, [status, openPath]);

  return (
    <main className="page">
      <section className="topbar">
        <div>
          <p className="eyebrow">{t('assetSpaceEyebrow')}</p>
          <h1>{t('assetSpaceTitle')}</h1>
          <p className="lead">{t('assetSpaceLead')}</p>
        </div>
        <div className="topbar-actions">
          <span className={`conn-chip ${watcher === 'connected' ? 'ok' : 'down'}`}>
            {watcher === 'connected' ? t('watcherConnected') : t('watcherDisconnected')}
          </span>
          <div className="create-menu-wrap">
            <button className="primary-button" onClick={() => setCreateMenuOpen((v) => !v)} title={t('newAsset')}>
              <Plus size={17} />
              {t('newAsset')}
            </button>
            {createMenuOpen ? (
              <div className="create-menu" role="menu">
                <button
                  className="create-menu-item"
                  onClick={() => openCreate('transcript-import')}
                >
                  {t('newAssetTranscriptImport')}
                </button>
                <button className="create-menu-item" onClick={() => openCreate('manual-record')}>
                  {t('newAssetManualRecord')}
                </button>
                <button className="create-menu-item" onClick={() => openCreate('design')}>
                  {t('newAssetDesign')}
                </button>
                <button className="create-menu-item" onClick={() => openCreate('decision')}>
                  {t('newAssetDecision')}
                </button>
              </div>
            ) : null}
          </div>
          <button className="secondary-button" onClick={() => loadAll()} title={t('rescan')}>
            <RefreshCw size={17} />
            {t('rescan')}
          </button>
        </div>
      </section>

      {runtimeMode === 'framework-self' ? (
        <section className="panel runtime-mode-notice framework-self-notice">
          <div>
            <p className="eyebrow">{t('runtimeModeFramework')}</p>
            <h2>{t('assetFrameworkModeTitle')}</h2>
            <p>{t('assetFrameworkModeBody')}</p>
          </div>
        </section>
      ) : null}

      {status === 'error' ? (
        <div className="banner error">
          <AlertTriangle size={18} />
          <div>
            <strong>{t('scanError')}</strong>
            <p>{errorMsg}</p>
          </div>
        </div>
      ) : null}

      {status === 'loading' ? <div className="banner">{t('loading')}</div> : null}

      <section className="skeleton-strip">
        {skeleton.map((entry) => (
          <article className="skeleton-pill" key={entry.path}>
            <code>{entry.path}</code>
            <span className={`status-badge ${entry.status.toLowerCase()}`}>{t(`sk_${entry.status.toLowerCase()}`)}</span>
          </article>
        ))}
      </section>

      <KnowledgeLifecycle
        compact
        titleKey="assetKnowledgeTitle"
        leadKey="assetKnowledgeLead"
      />

      {stats ? (
        <section className="stat-row">
          <span><strong>{stats.fileCount}</strong> {t('statFiles')}</span>
          <span><strong>{stats.directoryCount}</strong> {t('statDirs')}</span>
          <span className="stats-scope-note">{t('statsLoadedScope')}</span>
          <span><strong>{repoCount}</strong> {t('statRepos')}</span>
          {scannedAt ? <span>{t('scannedAt')} {formatDate(scannedAt)}</span> : null}
        </section>
      ) : null}

      <section className="asset-workspace-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('directoryExplorer')}</p>
              <h2>{t('everythingEnterable')}</h2>
              <p className="tree-help-hint">{t('assetTreeHelpHint')}</p>
            </div>
            <FolderOpen size={26} />
          </div>
          <div className="asset-tree">
            {rootChildren.length === 0 && status === 'ready' ? (
              <p className="detail-summary">{t('emptyDirectory')}</p>
            ) : (
              ROOT_TREE_GROUP_ORDER.map((group) => {
                const nodes = rootChildren.filter((node) => rootTreePresentation(node.name).group === group);
                if (nodes.length === 0) return null;
                return (
                  <section className="root-tree-group" key={group}>
                    <div className="root-tree-group-heading">
                      <strong>{t(rootTreeGroupKey(group))}</strong>
                      <span>{t(rootTreeGroupHintKey(group))}</span>
                    </div>
                    <div className="root-tree-group-items">
                      {nodes.map((node) => {
                        const presentation = rootTreePresentation(node.name);
                        return (
                          <TreeNode
                            key={node.id}
                            node={node}
                            depth={0}
                            expanded={expanded}
                            childrenCache={childrenCache}
                            selectedId={selected?.id ?? null}
                            onToggle={toggleExpand}
                            onSelect={selectNode}
                            purposeKey={presentation.purposeKey}
                            learnMoreFocus={presentation.learnMoreFocus}
                            onLearnMore={onOpenFramework}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </article>

        <article className="panel asset-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('assetDetail')}</p>
              <h2>{selected ? selected.name : t('selectFileOrDir')}</h2>
            </div>
            {selected ? (selected.kind === 'directory' ? <FolderOpen size={26} /> : <FileText size={26} />) : <FileText size={26} />}
          </div>
          {selected ? (
            <DetailPanel
              node={selected}
              content={content}
              contentLoading={contentLoading}
              contentError={contentError}
              managedMeta={managedMeta}
              onPromote={(mode, from) => openCreate(mode, from)}
              purposeKey={assetTreePurposeKey(selected.relativePath)}
            />
          ) : (
            <p className="detail-summary">{t('selectFileOrDirHint')}</p>
          )}
        </article>
      </section>

      {createMode ? (
        <CreateAssetDialog
          mode={createMode}
          promoteFrom={promoteFrom}
          onClose={() => {
            setCreateMode(null);
            setPromoteFrom(null);
          }}
          onCreated={handleCreated}
        />
      ) : null}
    </main>
  );
}

interface TreeNodeProps {
  node: AssetNode;
  depth: number;
  expanded: Set<string>;
  childrenCache: Record<string, AssetNode[]>;
  selectedId: string | null;
  onToggle: (node: AssetNode) => void;
  onSelect: (node: AssetNode) => void;
  purposeKey?: string;
  learnMoreFocus?: FrameworkFocus;
  onLearnMore?: (focus: FrameworkFocus) => void;
}

function TreeNode({ node, depth, expanded, childrenCache, selectedId, onToggle, onSelect, purposeKey, learnMoreFocus, onLearnMore }: TreeNodeProps) {
  const { t } = useI18n();
  const isDir = node.kind === 'directory';
  const isOpen = expanded.has(node.relativePath);
  const kids = isOpen ? childrenCache[node.relativePath] : undefined;
  const Icon = isDir ? (isOpen ? FolderOpen : Folder) : FileText;
  const nestedHelp = depth > 0 ? nestedTreeEntryHelp(node.relativePath) : undefined;
  const effectivePurposeKey = purposeKey ?? (nestedHelp?.showInTree ? nestedHelp.purposeKey : undefined);
  const effectiveLearnMoreFocus = learnMoreFocus ?? (nestedHelp?.showInTree ? nestedHelp.learnMoreFocus : undefined);

  return (
    <div className="tree-node" style={{ marginLeft: depth === 0 ? 0 : 16 }}>
      <div className={`tree-row ${selectedId === node.id ? 'selected' : ''}`}>
        <button
          className="tree-toggle"
          aria-label={isOpen ? t('collapseDetail') : t('expandDetail')}
          onClick={() => onToggle(node)}
          style={{ visibility: isDir ? 'visible' : 'hidden' }}
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <button className="tree-label" onClick={() => onSelect(node)}>
          <Icon size={17} />
          <div>
            <strong>{node.name}</strong>
            <small>{node.relativePath || '/'}</small>
            {effectivePurposeKey ? <em className="tree-purpose">{t(effectivePurposeKey)}</em> : null}
          </div>
        </button>
        {effectiveLearnMoreFocus && onLearnMore ? (
          <button
            className="tree-learn-more"
            onClick={() => onLearnMore(effectiveLearnMoreFocus)}
          >
            {t('rootLearnMore')}
          </button>
        ) : null}
      </div>
      {isDir && isOpen && kids ? (
        <div className="tree-children">
          {kids.length === 0 ? (
            <p className="detail-summary">{''}</p>
          ) : (
            kids.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                childrenCache={childrenCache}
                selectedId={selectedId}
                onToggle={onToggle}
                onSelect={onSelect}
                purposeKey={undefined}
                learnMoreFocus={undefined}
                onLearnMore={onLearnMore}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

interface DetailPanelProps {
  node: AssetNode;
  content: AssetContent | null;
  contentLoading: boolean;
  contentError: string;
  managedMeta: ManagedAssetMetadata | null;
  onPromote: (mode: CreateMode, from: PromoteFrom) => void;
  purposeKey?: string;
}

function DetailPanel({ node, content, contentLoading, contentError, managedMeta, onPromote, purposeKey }: DetailPanelProps) {
  const { t } = useI18n();
  const kindLabel = useMemo(() => t(`type_${node.assetType ?? 'other'}`), [t, node.assetType]);
  const showManaged = !!managedMeta && node.kind === 'file';

  return (
    <div className="detail-body">
      {purposeKey ? (
        <div className="asset-purpose-note">
          <span>{t('assetPurpose')}</span>
          <strong>{t(purposeKey)}</strong>
        </div>
      ) : null}
      <div className="detail-grid">
        <Field label={t('assetType')} value={kindLabel} />
        {node.managedType ? (
          <Field label={t('detailType')} value={t(`type_${managedMeta?.type ?? node.managedType}`)} />
        ) : null}
        <Field label={t('assetKind')} value={node.kind === 'directory' ? t('kindDirectory') : t('kindFile')} />
        <Field label={t('assetPath')} value={node.relativePath || '/'} wide />
        {node.kind === 'file' ? <Field label={t('fileSize')} value={formatSize(node.size)} /> : null}
        {node.codeLanguage ? <Field label={t('codeLanguage')} value={t(`codeLanguage_${node.codeLanguage}`)} /> : null}
        <Field label={t('updatedAt')} value={formatDate(node.modifiedAt)} />
        {node.kind === 'directory' ? (
          <>
            <Field label={t('childCount')} value={node.childCount == null ? t('countNotLoaded') : String(node.childCount)} />
            <Field label={t('fileCount')} value={node.fileCount == null ? t('countNotLoaded') : String(node.fileCount)} />
          </>
        ) : null}
        <Field label={t('assetSource')} value={t('sourceDiscovered')} wide />
      </div>

      {node.git ? <GitPanel git={node.git} /> : null}

      {showManaged && managedMeta ? (
        <ManagedRelations node={node} meta={managedMeta} onPromote={onPromote} />
      ) : null}

      {node.kind === 'file' ? (
        <div className="preview-block">
          <p className="eyebrow">{t('contentPreview')}</p>
          {contentLoading ? <p className="detail-summary">{t('loading')}</p> : null}
          {contentError ? <p className="detail-summary error-text">{contentError}</p> : null}
          {content && !content.previewable ? (
            <div className="banner warn">
              <AlertTriangle size={16} />
              <span>{t('unsupportedPreview')} — {content.reason ?? ''}</span>
            </div>
          ) : null}
          {content && content.previewable ? (
            <pre className="preview-box code-preview">
              {content.content}
              {content.truncated ? `\n… [${t('previewTruncated')}]` : ''}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ManagedRelations({
  node,
  meta,
  onPromote,
}: {
  node: AssetNode;
  meta: ManagedAssetMetadata;
  onPromote: (mode: CreateMode, from: PromoteFrom) => void;
}) {
  const { t } = useI18n();
  const from: PromoteFrom = { type: meta.type, id: meta.id, title: meta.title };

  const isTranscript = meta.type === 'conversation-transcript';
  const isWorkRecord = meta.type === 'agent-work-record' || (meta.type === 'conversation' && meta.captureMode === 'agent-work-record');
  const capKey =
    meta.captureMode === 'full-transcript'
      ? 'capFull'
      : meta.captureMode === 'imported-transcript'
        ? 'capImported'
        : meta.captureMode === 'agent-work-record'
          ? 'capAgentWork'
          : meta.captureMode === 'manual'
            ? 'capManual'
            : null;
  const completenessKey =
    meta.completeness === 'full' ? 'completenessFull' : meta.completeness === 'partial' ? 'completenessPartial' : 'completenessUnknown';

  const transcriptStatusKey =
    meta.transcriptCaptureStatus === 'available'
      ? 'tcsAvailable'
      : meta.transcriptCaptureStatus === 'partial'
        ? 'tcsPartial'
        : meta.transcriptCaptureStatus === 'imported'
          ? 'tcsImported'
          : 'tcsUnavailable';

  return (
    <div className="managed-block">
      {isTranscript ? (
        <div className="banner">
          <strong>{t('type_conversation_transcript')}</strong>
          <span>{t('transcriptEvidenceNotice')}</span>
        </div>
      ) : null}
      {isWorkRecord ? (
        <div className={`banner ${meta.transcriptCaptureStatus === 'unavailable' ? 'warn' : ''}`}>
          <strong>{t('type_agent_work_record')}</strong>
          <span>{t('workRecordEvidenceNotice')}</span>
        </div>
      ) : null}
      {isWorkRecord && meta.transcriptCaptureStatus === 'unavailable' ? (
        <div className="banner warn">
          <AlertTriangle size={16} />
          <span>{t('transcriptUnavailableNotice')}</span>
        </div>
      ) : null}
      {isWorkRecord && meta.transcriptCaptureStatus === 'partial' ? (
        <div className="banner warn">
          <AlertTriangle size={16} />
          <span>{t('transcriptPartialNotice')}</span>
        </div>
      ) : null}
      <p className="eyebrow">{t('detailRelations')}</p>
      <div className="detail-grid">
        <Field label={t('detailType')} value={t(`type_${meta.type}`)} />
        {meta.source ? (
          <Field
            label={t('lblTranscriptSource')}
            value={t(`src${meta.source.charAt(0).toUpperCase()}${meta.source.slice(1)}`)}
          />
        ) : null}
        {capKey ? <Field label={t('captureMode')} value={t(capKey)} /> : null}
        {isTranscript ? (
          <>
            <Field label={t('relCompleteness')} value={t(completenessKey)} />
            {meta.sourceSessionId ? <Field label={t('relSourceTranscript')} value={meta.sourceSessionId} wide /> : null}
            {typeof meta.sourceMetadata?.provider === 'string' ? <Field label="Provider" value={meta.sourceMetadata.provider} /> : null}
            {typeof meta.sourceMetadata?.captureSource === 'string' ? <Field label="Capture source" value={meta.sourceMetadata.captureSource} /> : null}
            {typeof meta.sourceMetadata?.captureSessionId === 'string' ? <Field label="Capture session" value={meta.sourceMetadata.captureSessionId} wide /> : null}
            {meta.workRecordId ? <Field label={t('relWorkRecord')} value={meta.workRecordId} wide /> : null}
          </>
        ) : null}
        {isWorkRecord ? (
          <>
            <Field label={t('transcriptCaptureStatus')} value={t(transcriptStatusKey)} />
            <Field
              label={t('relSourceTranscript')}
              value={meta.sourceTranscriptId ?? t('relNone')}
              wide
            />
          </>
        ) : null}
        {meta.agentSessionId ? <Field label={t('relAgentSession')} value={meta.agentSessionId} wide /> : null}
        {meta.status ? <Field label={t('relDecisionStatus')} value={meta.status} /> : null}
        {meta.createdAt ? <Field label={t('relConvCaptured')} value={formatDate(meta.createdAt)} /> : null}
        {meta.id ? <Field label="ID" value={meta.id} wide /> : null}
      </div>

      {(meta.relatedAssetPaths?.length || meta.sourceConversations?.length || meta.sourceDesigns?.length || meta.promotedTo?.length || meta.promotedToDecisions?.length) ? (
        <ul className="relation-list">
          {meta.relatedAssetPaths && meta.relatedAssetPaths.length > 0 ? (
            <li>
              <strong>{t('relRelatedAssets')}:</strong> {meta.relatedAssetPaths.join(', ')}
            </li>
          ) : null}
          {meta.sourceConversations && meta.sourceConversations.length > 0 ? (
            <li>
              <strong>{t('relSourceConversations')}:</strong> {meta.sourceConversations.join(', ')}
            </li>
          ) : null}
          {meta.sourceDesigns && meta.sourceDesigns.length > 0 ? (
            <li>
              <strong>{t('relSourceDesigns')}:</strong> {meta.sourceDesigns.join(', ')}
            </li>
          ) : null}
          {meta.promotedTo && meta.promotedTo.length > 0 ? (
            <li>
              <strong>{t('relPromotedTo')}:</strong>{' '}
              {meta.promotedTo.map((p) => `${p.type}:${p.id}`).join(', ')}
            </li>
          ) : null}
          {meta.promotedToDecisions && meta.promotedToDecisions.length > 0 ? (
            <li>
              <strong>{t('relPromotedTo')}:</strong> {meta.promotedToDecisions.join(', ')}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="relation-actions">
        {node.managedType === 'agent-work-record' || node.managedType === 'conversation' ? (
          <>
            <button className="primary-button" onClick={() => onPromote('design', from)}>
              {t('actPromoteToDesign')}
            </button>
            <button className="secondary-button" onClick={() => onPromote('decision', from)}>
              {t('actCreateDecision')}
            </button>
          </>
        ) : null}
        {node.managedType === 'design' ? (
          <button className="primary-button" onClick={() => onPromote('decision', from)}>
            {t('actCreateDecision')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GitPanel({ git }: { git: RepositoryRevision }) {
  const { t } = useI18n();
  return (
    <div className="git-block">
      <p className="eyebrow">{t('gitRepoTitle')}</p>
      <div className="detail-grid">
        {git.branch ? <Field label={t('gitBranch')} value={git.branch} /> : null}
        {git.remote ? <Field label={t('gitRemote')} value={git.remote} wide /> : null}
        {git.headCommit ? <Field label={t('gitHead')} value={git.headCommit} wide /> : null}
        <Field label={t('gitStatus')} value={git.dirty ? t('gitDirty') : t('gitClean')} />
        {git.dirty ? (
          <>
            <Field label={t('gitModified')} value={String(git.modifiedCount)} />
            <Field label={t('gitUntracked')} value={String(git.untrackedCount)} />
          </>
        ) : null}
        {git.originMasterCommit ? <Field label={t('gitOriginMaster')} value={git.originMasterCommit} wide /> : null}
        {git.originMainCommit ? <Field label={t('gitOriginMain')} value={git.originMainCommit} wide /> : null}
      </div>
    </div>
  );
}

function Field({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
