import { useState } from 'react';
import { Boxes, FolderTree, PlusCircle, TerminalSquare, Wrench } from 'lucide-react';
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
          <h2>{zh ? 'Creator 与实例管理工作台' : 'Creator & Instance Manager'}</h2>
          <p className="detail-summary">{zh ? '两个独立工作区：初始化项目知识，或创建并管理一个业务系统对应的 Workbench 实例。' : 'Two independent workspaces: initialize project knowledge or manage the lifecycle of a business-project Workbench instance.'}</p>
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
          <div className="creator-capability-head"><strong><FolderTree size={18} /> ① Knowledge Creator</strong></div>
          <p>{zh ? '项目知识初始化 · 创建和验证 00–05 知识目录；不要求先创建 Instance。' : 'Initialize and verify 00–05 project knowledge without creating an Instance.'}</p>
          <small>{zh ? '独立使用 · 不修改业务代码' : 'Standalone · Never modifies business code'}</small>
        </button>
        <button type="button" className={`panel creator-capability-card creator-workspace-choice ${workspace === 'instance' ? 'selected' : ''}`}
          aria-pressed={workspace === 'instance'} onClick={() => setWorkspace('instance')}>
          <div className="creator-capability-head"><strong><Boxes size={18} /> ② Instance Manager</strong></div>
          <p>{zh ? '工作台实例管理 · 创建 → 状态验证 → 升级 → 迁移与回滚。' : 'Create → Status / Verify → Upgrade → Migration / Rollback.'}</p>
          <small>{zh ? '一个 Instance 绑定一个业务系统' : 'One Instance is bound to one business project'}</small>
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
