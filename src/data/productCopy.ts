import { Code2, FileText, MessageSquareText, Network, Braces } from 'lucide-react';
import type {
  AssetCategory,
  ExplainerStep,
  KeyDocument,
  SourceLayer,
  PipelineNote,
} from '../domain/workspace';

/**
 * Product narrative copy.
 *
 * These are human-language explanations of the product model. They are NOT a
 * substitute for real scanned asset data. Counts and repository facts are
 * fetched live from the Local Asset Engine.
 */

export const welcomeSteps: ExplainerStep[] = [
  {
    title: { 'zh-CN': '找到代码和资料', en: 'Find code and materials' },
    body: { 'zh-CN': '从本地项目目录发现代码、设计方案、文稿和聊天记录，先建立完整资产地图。', en: 'Discover code, design plans, documents, and conversations from the local project directory to build a complete asset map.' },
  },
  {
    title: { 'zh-CN': '确认来源身份', en: 'Confirm source identity' },
    body: { 'zh-CN': '代码用 Git Remote 确认身份，文档和聊天记录保留原始路径、来源和版本归属。', en: 'Code identity comes from Git remotes; documents and conversations keep their original path, source, and version ownership.' },
  },
  {
    title: { 'zh-CN': '冻结一个项目版本', en: 'Freeze a project version' },
    body: { 'zh-CN': '把多仓库提交、文档清单和资产 manifest 一起冻结，形成可追溯的项目版本。', en: 'Freeze repository commits, document inventory, and asset manifests together into a traceable project version.' },
  },
  {
    title: { 'zh-CN': '生成可检索资产', en: 'Generate searchable assets' },
    body: { 'zh-CN': '在 Raw 和 manifest 验证后，再生成 Diff、CodeGraph、摘要、标签和跨资产关联。', en: 'After Raw and manifest verification, generate diff, CodeGraph, summaries, tags, and cross-asset links.' },
  },
];

export const guideSteps: ExplainerStep[] = [
  {
    title: { 'zh-CN': '选择项目根目录', en: 'Choose project root' },
    body: { 'zh-CN': '选择要纳入资产空间的项目目录；它只是发现入口，不直接当成长期版本事实。', en: 'Choose the project directory to include; it is only the discovery entry, not the long-term version fact.' },
  },
  {
    title: { 'zh-CN': '发现仓库和资料目录', en: 'Discover repositories and asset folders' },
    body: { 'zh-CN': '系统扫描 Git 仓库、设计目录、文档目录、聊天记录和派生产物目录。', en: 'The system scans Git repositories, design folders, document folders, conversations, and derived outputs.' },
  },
  {
    title: { 'zh-CN': '进入目录和文件详情', en: 'Open folders and file details' },
    body: { 'zh-CN': '每个目录能进入，每个文件都有统一详情页，展示内容、来源、版本、关联和索引状态。', en: 'Every folder is navigable and every file has a unified detail page with content, source, version, relations, and index status.' },
  },
  {
    title: { 'zh-CN': '确认版本并生成分析', en: 'Confirm version and analyze' },
    body: { 'zh-CN': '确认 manifest 后生成 WorkspaceVersion，再继续做 Diff、CodeGraph 和语义检索。', en: 'After confirming the manifest, create a WorkspaceVersion and continue to diff, CodeGraph, and semantic retrieval.' },
  },
];

export const sourceLayers: SourceLayer[] = [
  {
    label: { 'zh-CN': '本地目录', en: 'Local root' },
    value: { 'zh-CN': '首次发现入口', en: 'First discovery entry' },
    detail: { 'zh-CN': '扫描项目根下的真实文件与 Git 仓库，不复制 working tree。', en: 'Scans real files and Git repositories under the project root; never copies the working tree.' },
  },
  {
    label: { 'zh-CN': 'Git Remote', en: 'Git Remote' },
    value: { 'zh-CN': '仓库长期身份', en: 'Long-term repository identity' },
    detail: { 'zh-CN': 'origin URL 标准化后写入仓库身份，缺失或冲突需要人工处理。', en: 'Normalized origin URL becomes repository identity; missing or conflicting remotes need review.' },
  },
  {
    label: { 'zh-CN': '受管 Mirror', en: 'Managed Mirror' },
    value: { 'zh-CN': '后续刷新入口', en: 'Future refresh entry' },
    detail: { 'zh-CN': '后续 fetch 只在受管 mirror 执行，不修改用户本地 checkout。', en: 'Future fetches run only in a managed mirror and never mutate the user checkout.' },
  },
  {
    label: { 'zh-CN': 'Master Commit', en: 'Master Commit' },
    value: { 'zh-CN': 'Raw 代码事实', en: 'Raw source fact' },
    detail: { 'zh-CN': 'WorkspaceVersion 只冻结 resolved master commit、treeHash 和 manifest。', en: 'WorkspaceVersion freezes only the resolved master commit, tree hash, and manifest.' },
  },
  {
    label: { 'zh-CN': 'Release Ref', en: 'Release Ref' },
    value: { 'zh-CN': '发布观察证据', en: 'Release observation evidence' },
    detail: { 'zh-CN': 'release/master 差异进入分析报告，不能反向改写 Raw 内容。', en: 'release/master drift enters analysis reports and cannot rewrite Raw content.' },
  },
];

/**
 * Key Project Documents — real files worth reading directly.
 *
 * Every entry is a FILE (never a directory). `path` is a real relative path
 * verified against the project root; existence is resolved live from the Local
 * Asset Engine and rendered as FOUND / MISSING, never assumed.
 */
export const keyDocuments: KeyDocument[] = [
  {
    name: 'AGENTS.md',
    path: 'AGENTS.md',
    description: { 'zh-CN': 'Agent 与项目规则：产品身份、信息架构、UX、版本模型和 Git 安全边界。', en: 'Agent and project rules: product identity, IA, UX, version model, and Git safety boundaries.' },
  },
  {
    name: 'product-introduction.md',
    path: '00-introduction/product-introduction.md',
    description: { 'zh-CN': '产品介绍：这个工作台解决什么问题，怎么组织资产。', en: 'Product introduction: what this workbench solves and how assets are organized.' },
  },
  {
    name: 'first-import-guide.md',
    path: '00-introduction/first-import-guide.md',
    description: { 'zh-CN': '首次导入说明：把人类语言过渡到系统语言的引导。', en: 'First-import guide: bridging human language into system terms.' },
  },
  {
    name: '0001-project-workspace.md',
    path: '02-design/decisions/0001-project-workspace.md',
    description: { 'zh-CN': '核心决策记录：Project Workspace 的边界与来源模型。', en: 'Core decision record: Project Workspace boundaries and source model.' },
  },
  {
    name: 'product-skeleton.md',
    path: 'docs/product-skeleton.md',
    description: { 'zh-CN': '产品与架构设计：分层、Runtime 与页面结构。', en: 'Product and architecture design: layering, runtime, and page structure.' },
  },
];

export const assetCategoryCards: AssetCategory[] = [
  { id: 'code', name: { 'zh-CN': '代码', en: 'Code' }, path: '01-code/', description: { 'zh-CN': 'Git 仓库、Raw、版本、Diff 和源码文件。', en: 'Git repositories, Raw source, versions, diffs, and source files.' }, count: 0, indexed: 0, icon: Code2 },
  { id: 'design', name: { 'zh-CN': '设计方案', en: 'Design' }, path: '02-design/', description: { 'zh-CN': '架构蓝图、产品方案、技术设计和决策记录。', en: 'Architecture blueprints, product plans, technical designs, and decisions.' }, count: 0, indexed: 0, icon: Braces },
  { id: 'document', name: { 'zh-CN': '文稿文档', en: 'Documents' }, path: '03-docs/', description: { 'zh-CN': 'README、说明书、需求文档、报告和可交付文稿。', en: 'README files, manuals, requirements, reports, and deliverable drafts.' }, count: 0, indexed: 0, icon: FileText },
  { id: 'conversation', name: { 'zh-CN': '聊天记录', en: 'Conversations' }, path: '04-conversations/', description: { 'zh-CN': '真实 Transcript、Agent Work Record 与人工讨论证据；过程证据和正式决策分开保存。', en: 'Real Transcripts, Agent Work Records, and human discussion evidence; process evidence stays separate from formal decisions.' }, count: 0, indexed: 0, icon: MessageSquareText },
  { id: 'derived', name: { 'zh-CN': '派生产物', en: 'Derived' }, path: '05-derived/', description: { 'zh-CN': 'CodeGraph、语义索引、摘要、标签和知识图谱。', en: 'CodeGraph, semantic indexes, summaries, tags, and knowledge graphs.' }, count: 0, indexed: 0, icon: Network },
];

export const pipelineNotes: PipelineNote[] = [
  { text: { 'zh-CN': 'Raw 验证完成后，WorkspaceVersion 已经可信；CodeGraph 不是版本可信的前置条件。', en: 'After Raw verification, WorkspaceVersion is trusted; CodeGraph is not a prerequisite for version trust.' }, warn: false },
  { text: { 'zh-CN': 'Repository/File Diff 可先生成；Symbol Diff 与 Graph Diff 等 CodeGraph 完成后补充。', en: 'Repository/File Diff can be generated first; Symbol Diff and Graph Diff are added after CodeGraph finishes.' }, warn: false },
  { text: { 'zh-CN': '页面不执行 push、merge、pull 或创建 release 分支。', en: 'The page does not push, merge, pull, or create release branches.' }, warn: false },
];


