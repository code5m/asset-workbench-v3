import {
  BookOpen,
  FolderTree,
  LayoutDashboard,
  Plug,
  Sparkles,
} from 'lucide-react';
import type { NavigationItem, WizardStep } from '../domain/workspace';

/**
 * Static UI chrome configuration (navigation + import pipeline steps).
 *
 * This is NOT project asset data. The asset tree, repository list, and version
 * summary now come from the real Local Asset Engine, not from here.
 */

export const navigationItems: NavigationItem[] = [
  { id: 'welcome', title: { 'zh-CN': '介绍', en: 'Intro' }, eyebrow: { 'zh-CN': '先看懂', en: 'Understand first' }, icon: Sparkles },
  { id: 'guide', title: { 'zh-CN': '引导', en: 'Guide' }, eyebrow: { 'zh-CN': '首次导入', en: 'First import' }, icon: BookOpen },
  { id: 'assets', title: { 'zh-CN': '资产空间', en: 'Assets' }, eyebrow: { 'zh-CN': '目录与文件', en: 'Folders and files' }, icon: FolderTree },
  { id: 'console', title: { 'zh-CN': '工作台', en: 'Console' }, eyebrow: { 'zh-CN': '版本冻结', en: 'Version freeze' }, icon: LayoutDashboard },
  { id: 'providers', title: { 'zh-CN': 'Provider 管理', en: 'Providers' }, eyebrow: { 'zh-CN': '连接与采集', en: 'Connect and capture' }, icon: Plug },
];

export const wizardSteps: WizardStep[] = [
  { id: 'workspace', title: { 'zh-CN': '工作区', en: 'Workspace' }, eyebrow: { 'zh-CN': '定义边界', en: 'Define scope' }, state: 'done', icon: Sparkles },
  { id: 'source', title: { 'zh-CN': '来源分层', en: 'Source Layers' }, eyebrow: { 'zh-CN': '分清身份', en: 'Separate identity' }, state: 'done', icon: BookOpen },
  { id: 'repositories', title: { 'zh-CN': '仓库修订', en: 'Revisions' }, eyebrow: { 'zh-CN': '审核 master 事实', en: 'Review master facts' }, state: 'active', icon: FolderTree },
  { id: 'version', title: { 'zh-CN': '工作区版本', en: 'Workspace Version' }, eyebrow: { 'zh-CN': '冻结版本', en: 'Freeze version' }, state: 'ready', icon: LayoutDashboard },
  { id: 'raw', title: { 'zh-CN': '原始导入', en: 'Raw Import' }, eyebrow: { 'zh-CN': '导入原文', en: 'Import source' }, state: 'ready', icon: BookOpen },
  { id: 'manifest', title: { 'zh-CN': '清单', en: 'Manifest' }, eyebrow: { 'zh-CN': '校验事实', en: 'Verify facts' }, state: 'ready', icon: FolderTree },
  { id: 'diff', title: { 'zh-CN': '差异', en: 'Diff' }, eyebrow: { 'zh-CN': '版本差异', en: 'Version diff' }, state: 'future', icon: FolderTree },
  { id: 'modules', title: { 'zh-CN': '模块', en: 'Modules' }, eyebrow: { 'zh-CN': '模块识别', en: 'Detect modules' }, state: 'future', icon: Sparkles },
  { id: 'model', title: { 'zh-CN': '代码模型', en: 'Code Model' }, eyebrow: { 'zh-CN': '结构模型', en: 'Structure model' }, state: 'future', icon: BookOpen },
  { id: 'graph', title: { 'zh-CN': '图谱', en: 'Graph' }, eyebrow: { 'zh-CN': '工作区图谱', en: 'Workspace graph' }, state: 'future', icon: FolderTree },
  { id: 'ready', title: { 'zh-CN': '就绪', en: 'Ready' }, eyebrow: { 'zh-CN': '检索准备', en: 'Retrieval ready' }, state: 'future', icon: Sparkles },
];
