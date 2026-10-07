import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDashed, FileCode2, FolderTree, GitBranch, PackageOpen, Route, Wrench } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import {
  FRAMEWORK_DIRECTORY_GUIDES,
  FRAMEWORK_INSTANCE_CAPABILITIES,
  FRAMEWORK_KEY_FILE_GUIDES,
  type FrameworkCapabilityStatus,
  type FrameworkDirectoryGuide,
  type FrameworkKeyFileGuide,
} from '../data/frameworkLearning';

type Tab = 'directories' | 'files' | 'instances' | 'versions';

function statusLabel(status: FrameworkCapabilityStatus, t: (key: string) => string): string {
  if (status === 'available') return t('frameworkCapabilityAvailable');
  if (status === 'partial') return t('frameworkCapabilityPartial');
  return t('frameworkCapabilityPlanned');
}

export function FrameworkLearningConsole() {
  const { t, loc } = useI18n();
  const [tab, setTab] = useState<Tab>('directories');
  const [directoryId, setDirectoryId] = useState(FRAMEWORK_DIRECTORY_GUIDES[0]?.id ?? 'src');
  const [filePath, setFilePath] = useState(FRAMEWORK_KEY_FILE_GUIDES[0]?.path ?? 'src/App.tsx');

  const directory = useMemo(
    () => FRAMEWORK_DIRECTORY_GUIDES.find((item) => item.id === directoryId) ?? FRAMEWORK_DIRECTORY_GUIDES[0],
    [directoryId],
  );

  const file = useMemo(
    () => FRAMEWORK_KEY_FILE_GUIDES.find((item) => item.path === filePath) ?? FRAMEWORK_KEY_FILE_GUIDES[0],
    [filePath],
  );

  const openFile = (path: string) => {
    setFilePath(path);
    setTab('files');
  };

  return (
    <section className="framework-learning-console">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('frameworkConsoleEyebrow')}</p>
          <h2>{t('frameworkConsoleTitle')}</h2>
          <p className="framework-section-lead">{t('frameworkConsoleLead')}</p>
        </div>
      </div>

      <div className="framework-console-tabs" role="tablist" aria-label={t('frameworkConsoleTitle')}>
        <button className={tab === 'directories' ? 'active' : ''} onClick={() => setTab('directories')}>
          <FolderTree size={16} /> {t('frameworkConsoleDirectories')}
        </button>
        <button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>
          <FileCode2 size={16} /> {t('frameworkConsoleFiles')}
        </button>
        <button className={tab === 'instances' ? 'active' : ''} onClick={() => setTab('instances')}>
          <PackageOpen size={16} /> {t('frameworkConsoleInstances')}
        </button>
        <button className={tab === 'versions' ? 'active' : ''} onClick={() => setTab('versions')}>
          <GitBranch size={16} /> {t('frameworkConsoleVersions')}
        </button>
      </div>

      {tab === 'directories' ? (
        <div className="framework-console-grid">
          <aside className="panel framework-console-list">
            {FRAMEWORK_DIRECTORY_GUIDES.map((item) => (
              <button
                key={item.id}
                className={item.id === directory?.id ? 'selected' : ''}
                onClick={() => setDirectoryId(item.id)}
              >
                <div>
                  <strong>{loc(item.title)}</strong>
                  <code>{item.path}</code>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </aside>
          {directory ? <DirectoryDetail item={directory} onOpenFile={openFile} /> : null}
        </div>
      ) : null}

      {tab === 'files' ? (
        <div className="framework-console-grid">
          <aside className="panel framework-console-list">
            {FRAMEWORK_KEY_FILE_GUIDES.map((item) => (
              <button
                key={item.path}
                className={item.path === file?.path ? 'selected' : ''}
                onClick={() => setFilePath(item.path)}
              >
                <div>
                  <strong>{loc(item.title)}</strong>
                  <code>{item.path}</code>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </aside>
          {file ? <FileDetail item={file} /> : null}
        </div>
      ) : null}

      {tab === 'instances' ? <InstanceManager /> : null}
      {tab === 'versions' ? <VersionMap /> : null}
    </section>
  );
}

function DirectoryDetail({ item, onOpenFile }: { item: FrameworkDirectoryGuide; onOpenFile: (path: string) => void }) {
  const { t, loc } = useI18n();

  return (
    <article className="panel framework-console-detail">
      <div className="framework-console-detail-head">
        <div>
          <span className={`framework-learning-level ${item.level}`}>{t(`frameworkLevel.${item.level}`)}</span>
          <h3>{loc(item.title)}</h3>
          <code>{item.path}</code>
        </div>
        <FolderTree size={28} />
      </div>

      <p className="framework-console-summary">{loc(item.summary)}</p>

      <div className="framework-explainer-grid">
        <Explainer title={t('frameworkGuideWhat')} body={loc(item.purpose)} />
        <Explainer title={t('frameworkGuideWhy')} body={loc(item.why)} />
        <Explainer title={t('frameworkGuideLearn')} body={loc(item.learning)} />
        <Explainer title={t('frameworkGuideEdit')} body={loc(item.editAdvice)} />
      </div>

      <div className="framework-child-map">
        <strong>{t('frameworkGuideInside')}</strong>
        <div>
          {item.children.map((child) => (
            <article key={child.path}>
              <code>{child.path}</code>
              <span>{loc(child.label)}</span>
            </article>
          ))}
        </div>
      </div>

      {item.keyFiles.length ? (
        <div className="framework-key-file-links">
          <strong>{t('frameworkGuideKeyFiles')}</strong>
          <div>
            {item.keyFiles.map((path) => (
              <button key={path} onClick={() => onOpenFile(path)}>
                <FileCode2 size={15} />
                <code>{path}</code>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function FileDetail({ item }: { item: FrameworkKeyFileGuide }) {
  const { t, loc } = useI18n();
  return (
    <article className="panel framework-console-detail">
      <div className="framework-console-detail-head">
        <div>
          <span className={`framework-learning-level ${item.level}`}>{t(`frameworkLevel.${item.level}`)}</span>
          <h3>{loc(item.title)}</h3>
          <code>{item.path}</code>
        </div>
        <FileCode2 size={28} />
      </div>
      <div className="framework-file-five">
        <Explainer title={t('frameworkFileResponsibility')} body={loc(item.responsibility)} />
        <Explainer title={t('frameworkFileUsedBy')} body={loc(item.usedBy)} />
        <Explainer title={t('frameworkFileDependsOn')} body={loc(item.dependsOn)} />
        <Explainer title={t('frameworkFileImpact')} body={loc(item.impact)} />
        <Explainer title={t('frameworkFileLearning')} body={loc(item.learning)} />
      </div>
    </article>
  );
}

function InstanceManager() {
  const { t, loc } = useI18n();
  return (
    <div className="framework-instance-manager">
      <section className="panel framework-instance-model">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkInstanceEyebrow')}</p>
            <h3>{t('frameworkInstanceTitle')}</h3>
            <p className="framework-section-lead">{t('frameworkInstanceLead')}</p>
          </div>
        </div>
        <div className="framework-instance-flow">
          <div><span>1</span><strong>{t('frameworkInstanceCentral')}</strong><small>{t('frameworkInstanceCentralNote')}</small></div>
          <i>→</i>
          <div><span>2</span><strong>{t('frameworkInstanceCreator')}</strong><small>{t('frameworkInstanceCreatorNote')}</small></div>
          <i>→</i>
          <div><span>3</span><strong>{t('frameworkInstanceBound')}</strong><small>{t('frameworkInstanceBoundNote')}</small></div>
        </div>
      </section>

      <section className="framework-capability-grid">
        {FRAMEWORK_INSTANCE_CAPABILITIES.map((capability) => (
          <article className="panel framework-capability-card" key={capability.id}>
            <div className="framework-capability-head">
              <strong>{loc(capability.title)}</strong>
              <span className={`framework-capability-status ${capability.status}`}>
                {capability.status === 'available' ? <CheckCircle2 size={14} /> : capability.status === 'partial' ? <AlertTriangle size={14} /> : <CircleDashed size={14} />}
                {statusLabel(capability.status, t)}
              </span>
            </div>
            <p>{loc(capability.description)}</p>
          </article>
        ))}
      </section>

      <section className="panel framework-instance-actions">
        <div>
          <Wrench size={20} />
          <div>
            <strong>{t('frameworkInstanceUiFirstTitle')}</strong>
            <p>{t('frameworkInstanceUiFirstBody')}</p>
          </div>
        </div>
        <div className="framework-cli-example">
          <span>{t('frameworkInstanceCliUnderlying')}</span>
          <code>asset-workbench instance create --project ./my-service</code>
          <small>{t('frameworkInstanceCliPlanned')}</small>
        </div>
      </section>
    </div>
  );
}

function VersionMap() {
  const { t } = useI18n();
  return (
    <div className="framework-version-map">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('frameworkVersionMapEyebrow')}</p>
            <h3>{t('frameworkVersionMapTitle')}</h3>
            <p className="framework-section-lead">{t('frameworkVersionMapLead')}</p>
          </div>
        </div>
        <div className="framework-version-flow">
          <div><span>{t('frameworkVersionCentral')}</span><strong>Framework vX.Y</strong><small>{t('frameworkVersionCentralNote')}</small></div>
          <i>→</i>
          <div><span>{t('frameworkVersionInstance')}</span><strong>{t('frameworkVersionInstanceValue')}</strong><small>{t('frameworkVersionInstanceNote')}</small></div>
          <i>→</i>
          <div><span>{t('frameworkVersionProject')}</span><strong>{t('frameworkVersionProjectValue')}</strong><small>{t('frameworkVersionProjectNote')}</small></div>
        </div>
      </section>

      <section className="framework-upgrade-grid">
        <article className="panel">
          <Route size={20} />
          <strong>{t('frameworkUpgradeDiscoverTitle')}</strong>
          <p>{t('frameworkUpgradeDiscoverBody')}</p>
          <span className="framework-capability-status planned">{t('frameworkCapabilityPlanned')}</span>
        </article>
        <article className="panel">
          <Route size={20} />
          <strong>{t('frameworkUpgradePlanTitle')}</strong>
          <p>{t('frameworkUpgradePlanBody')}</p>
          <span className="framework-capability-status planned">{t('frameworkCapabilityPlanned')}</span>
        </article>
        <article className="panel">
          <Route size={20} />
          <strong>{t('frameworkUpgradeVerifyTitle')}</strong>
          <p>{t('frameworkUpgradeVerifyBody')}</p>
          <span className="framework-capability-status planned">{t('frameworkCapabilityPlanned')}</span>
        </article>
        <article className="panel">
          <Route size={20} />
          <strong>{t('frameworkUpgradeRollbackTitle')}</strong>
          <p>{t('frameworkUpgradeRollbackBody')}</p>
          <span className="framework-capability-status planned">{t('frameworkCapabilityPlanned')}</span>
        </article>
      </section>

      <p className="framework-version-honesty">{t('frameworkVersionHonesty')}</p>
    </div>
  );
}

function Explainer({ title, body }: { title: string; body: string }) {
  return (
    <article>
      <strong>{title}</strong>
      <p>{body}</p>
    </article>
  );
}
