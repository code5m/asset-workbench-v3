import { useState } from 'react';
import { Boxes, FolderTree, PlusCircle, Wrench } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { StarterCreator } from './StarterCreator';
import { InstanceLifecyclePanel } from './InstanceLifecyclePanel';

interface CreatorWorkbenchProps {
  onActivated?: () => void;
  initialWorkspace?: 'knowledge' | 'instance';
}

export function CreatorWorkbench({ onActivated, initialWorkspace = 'knowledge' }: CreatorWorkbenchProps) {
  const { t, lang } = useI18n();
  const [workspace, setWorkspace] = useState<'knowledge' | 'instance'>(initialWorkspace);
  const zh = lang === 'zh-CN';
  return (
    <section className="creator-workbench">
      <section className="panel creator-workbench-hero">
        <div>
          <p className="eyebrow">{t('creatorWorkbenchEyebrow')}</p>
          <h2>{zh ? '独立工作台' : 'Independent Workbenches'}</h2>
          <p className="detail-summary">{zh ? '一个业务项目对应一个独立工作台。集中创建、打开和管理运行实例，项目聊天、Agent 工作记录与知识资产分别保存。' : 'One workbench per project. Manage runtimes centrally; conversations, agent records and knowledge remain project-scoped.'}</p>
        </div>
        <div className="creator-hero-actions">
          <button type="button" className="primary-button creator-create-shortcut" onClick={() => setWorkspace('instance')}>
            <PlusCircle size={17} /> {zh ? '新建独立工作台' : 'New independent Workbench'}
          </button>
          <span className="creator-hero-hint">{zh ? '选择本地项目 → 一键创建并启动' : 'Choose a project → deploy and launch'}</span>
        </div>
      </section>
      <div className="creator-capability-grid" role="group" aria-label={zh ? '选择工作区' : 'Choose a workspace'}>
        <button type="button" className={`panel creator-capability-card creator-workspace-choice ${workspace === 'knowledge' ? 'selected' : ''}`}
          aria-pressed={workspace === 'knowledge'} onClick={() => setWorkspace('knowledge')}>
          <div className="creator-capability-head"><strong><FolderTree size={18} /> {zh ? '知识初始化' : 'Knowledge initialization'}</strong></div>
          <p>{zh ? '项目知识初始化 · 创建和验证 00–05 知识目录；不要求先创建 Instance。' : 'Initialize and verify 00–05 project knowledge without creating an Instance.'}</p>
          <small>{zh ? '独立使用 · 不修改业务代码' : 'Standalone · Never modifies business code'}</small>
        </button>
        <button type="button" className={`panel creator-capability-card creator-workspace-choice ${workspace === 'instance' ? 'selected' : ''}`}
          aria-pressed={workspace === 'instance'} onClick={() => setWorkspace('instance')}>
          <div className="creator-capability-head"><strong><Boxes size={18} /> {zh ? '独立工作台' : 'Independent workbenches'}</strong></div>
          <p>{zh ? '新建、查看列表、启动、停止、升级和回滚，统一在这里操作。' : 'Create, browse, start, stop, upgrade and roll back workbenches.'}</p>
          <small>{zh ? '一个业务项目对应一个独立工作台（Instance）' : 'One independent Workbench per project (Instance)'}</small>
        </button>
      </div>
      {workspace === 'knowledge' ? <StarterCreator onActivated={onActivated} /> : <InstanceLifecyclePanel />}
      <section className="panel creator-workbench-boundary">
        <Wrench size={20} />
        <div>
          <strong>{t('creatorWorkbenchBoundaryTitle')}</strong>
          <p>{t('creatorWorkbenchBoundaryBody')}</p>
        </div>
      </section>
    </section>
  );
}
