import type { LStr } from '../i18n/translations';

export type FrameworkGuideLevel = 'must-understand' | 'understand-later' | 'advanced';
export type FrameworkCapabilityStatus = 'available' | 'partial' | 'planned';

export interface FrameworkDirectoryGuide {
  id: string;
  path: string;
  title: LStr;
  summary: LStr;
  purpose: LStr;
  why: LStr;
  learning: LStr;
  editAdvice: LStr;
  level: FrameworkGuideLevel;
  children: Array<{ path: string; label: LStr }>;
  keyFiles: string[];
}

export interface FrameworkKeyFileGuide {
  path: string;
  title: LStr;
  responsibility: LStr;
  usedBy: LStr;
  dependsOn: LStr;
  impact: LStr;
  learning: LStr;
  level: FrameworkGuideLevel;
}

export interface FrameworkInstanceCapability {
  id: string;
  title: LStr;
  description: LStr;
  status: FrameworkCapabilityStatus;
}

export const FRAMEWORK_DIRECTORY_GUIDES: FrameworkDirectoryGuide[] = [
  {
    id: 'src',
    path: 'src',
    title: { 'zh-CN': '前端与可视化界面', en: 'Frontend & visual UI' },
    summary: { 'zh-CN': '你在浏览器里看到的页面主要都从这里出来。', en: 'Most pages you see in the browser come from here.' },
    purpose: { 'zh-CN': '负责页面、交互、可视化学习、状态展示和调用 Local API。', en: 'Owns pages, interactions, visual learning, status presentation, and Local API calls.' },
    why: { 'zh-CN': '你依赖可视化理解框架，所以 src 不只是“前端代码”，也是框架的学习与管理表面。', en: 'Because the framework is learned visually, src is not just frontend code; it is the framework learning and management surface.' },
    learning: { 'zh-CN': '优先理解 components、services、domain、data、i18n 的分工，不需要先读每个组件。', en: 'First understand components, services, domain, data, and i18n; do not start by reading every component.' },
    editAdvice: { 'zh-CN': '改页面、学习地图、交互和展示逻辑时主要会碰这里。', en: 'You mainly edit this area for pages, learning maps, interactions, and presentation logic.' },
    level: 'must-understand',
    children: [
      { path: 'src/components', label: { 'zh-CN': '页面与可复用 UI', en: 'Pages and reusable UI' } },
      { path: 'src/services', label: { 'zh-CN': '前端访问 Local API 的边界', en: 'Frontend boundary to Local API' } },
      { path: 'src/domain', label: { 'zh-CN': '前端领域类型与状态模型', en: 'Frontend domain types and state models' } },
      { path: 'src/data', label: { 'zh-CN': '产品说明与可视化元数据', en: 'Product copy and visual metadata' } },
      { path: 'src/i18n', label: { 'zh-CN': '中英文文案', en: 'Chinese/English copy' } },
    ],
    keyFiles: ['src/App.tsx', 'src/components/FrameworkPage.tsx', 'src/services/assetClient.ts'],
  },
  {
    id: 'server',
    path: 'server',
    title: { 'zh-CN': 'Node / TypeScript 本地后端', en: 'Node / TypeScript local backend' },
    summary: { 'zh-CN': '文件、Git、资产、Provider、Capture 和本地 API 的真实执行层。', en: 'The real execution layer for files, Git, assets, Providers, Capture, and local APIs.' },
    purpose: { 'zh-CN': '读取当前绑定项目、维护运行状态、扫描资产、管理知识写入、Provider 与 Capture，并把能力通过 Local API 提供给前端。', en: 'Reads the bound project, maintains runtime state, scans assets, manages knowledge writes, Provider/Capture, and exposes capabilities through the Local API.' },
    why: { 'zh-CN': '当前只维护一套 Node/TypeScript 后端；Java/Python/Rust 是被研究项目或分析对象，不代表后端要各写一套。', en: 'There is one Node/TypeScript backend. Java/Python/Rust are studied projects or analysis targets, not separate backend implementations.' },
    learning: { 'zh-CN': '先看 config、assetPlugin、assetService，再按需要看 Provider / Capture / Knowledge 服务。', en: 'Start with config, assetPlugin, and assetService; then inspect Provider, Capture, or Knowledge services as needed.' },
    editAdvice: { 'zh-CN': '增加后端能力、项目扫描、Provider、Capture 或安全边界时才深入修改。', en: 'Go deeper when adding backend capability, project scanning, Provider/Capture, or security boundaries.' },
    level: 'must-understand',
    children: [
      { path: 'server/config.ts', label: { 'zh-CN': '运行模式与当前项目绑定', en: 'Runtime mode and project binding' } },
      { path: 'server/assetPlugin.ts', label: { 'zh-CN': 'Local API 路由入口', en: 'Local API route entry' } },
      { path: 'server/assetService.ts', label: { 'zh-CN': '资产扫描与 Workspace 服务', en: 'Asset scanning and Workspace service' } },
      { path: 'server/captureService.ts', label: { 'zh-CN': 'AI 会话采集内核', en: 'AI conversation capture kernel' } },
      { path: 'server/providerPlatformService.ts', label: { 'zh-CN': 'Provider 平台服务', en: 'Provider platform service' } },
      { path: 'server/managedAssetService.ts', label: { 'zh-CN': '受管知识资产写入', en: 'Managed knowledge asset writes' } },
    ],
    keyFiles: ['server/config.ts', 'server/assetPlugin.ts', 'server/assetService.ts', 'server/captureService.ts', 'server/providerPlatformService.ts'],
  },
  {
    id: 'packages',
    path: 'packages',
    title: { 'zh-CN': '共享底层能力', en: 'Shared foundation packages' },
    summary: { 'zh-CN': '多个前后端功能共同复用的稳定定义与能力。', en: 'Stable definitions and capabilities reused across frontend and backend.' },
    purpose: { 'zh-CN': '放真正值得复用、需要单一事实源或需要稳定边界的底层能力。', en: 'Holds foundation capabilities that deserve reuse, a single source of truth, or a stable boundary.' },
    why: { 'zh-CN': '不是所有逻辑都应该放进 packages；只有通用、稳定、经过验证的能力才应该进入这里。', en: 'Not every behavior belongs in packages; only reusable, stable, verified capabilities should move here.' },
    learning: { 'zh-CN': '先理解它们属于哪个上层角色，再展开 Asset Core、Language Core、Shared Contracts、Provider SDK、Knowledge Init。', en: 'First understand which product role they support, then inspect Asset Core, Language Core, Shared Contracts, Provider SDK, and Knowledge Init.' },
    editAdvice: { 'zh-CN': '这是公共 Core，修改前要特别注意兼容性和回归测试。', en: 'This is shared Core; changes need extra compatibility and regression attention.' },
    level: 'understand-later',
    children: [
      { path: 'packages/asset-core', label: { 'zh-CN': '00–05 项目知识结构单一事实源', en: '00–05 project knowledge structure SSOT' } },
      { path: 'packages/language-core', label: { 'zh-CN': '项目生态 / 语言识别规则', en: 'Project ecosystem/language detection rules' } },
      { path: 'packages/protocol', label: { 'zh-CN': '共享数据契约（代码包名仍为 protocol）', en: 'Shared data contracts (package still named protocol)' } },
      { path: 'packages/provider-sdk', label: { 'zh-CN': 'Provider 定义与扩展边界', en: 'Provider definitions and extension boundary' } },
      { path: 'packages/starter', label: { 'zh-CN': 'Knowledge Init 当前实现', en: 'Current Knowledge Init implementation' } },
      { path: 'packages/creator-core', label: { 'zh-CN': 'Instance / Upgrade / Migration 生命周期 Core', en: 'Instance / Upgrade / Migration lifecycle Core' } },
    ],
    keyFiles: ['packages/asset-core/src/index.ts', 'packages/protocol/src/index.ts', 'packages/provider-sdk/src/index.ts', 'packages/starter/src/index.ts', 'packages/creator-core/src/index.ts'],
  },
  {
    id: 'providers',
    path: 'providers',
    title: { 'zh-CN': 'AI 接入扩展区', en: 'AI integration extension area' },
    summary: { 'zh-CN': 'Provider 示例与第三方接入扩展放在这里。', en: 'Provider examples and third-party integration extensions live here.' },
    purpose: { 'zh-CN': '展示如何把新的 AI / Agent 接入 Provider Adapter → Capture Kernel 这条统一链路。', en: 'Shows how new AI/Agent integrations enter the shared Provider Adapter → Capture Kernel path.' },
    why: { 'zh-CN': 'Provider 不能各自建立私有采集通路，否则 Transcript、身份和验证规则会失控。', en: 'Providers must not invent private capture paths or transcript identity/verification rules will drift.' },
    learning: { 'zh-CN': '普通使用先去 05 AI 接入；只有开发新 Provider 时再深入这里。', en: 'Normal users start in AI Connect; inspect this directory only when building a new Provider.' },
    editAdvice: { 'zh-CN': '开发新 Provider 或示例适配器时修改。', en: 'Edit when building new Providers or adapter examples.' },
    level: 'advanced',
    children: [
      { path: 'providers/examples', label: { 'zh-CN': 'Provider / Hook 接入示例', en: 'Provider / hook integration examples' } },
    ],
    keyFiles: [],
  },
  {
    id: 'scripts',
    path: 'scripts',
    title: { 'zh-CN': '工程门禁与自动化脚本', en: 'Engineering gates & automation' },
    summary: { 'zh-CN': '测试、校验、迁移和 Agent 收口脚本集中在这里。', en: 'Tests, verification, migrations, and Agent closure scripts live here.' },
    purpose: { 'zh-CN': '把架构规则变成可自动检查的硬门禁，而不是只写在文档里。', en: 'Turns architecture rules into executable gates instead of documentation-only conventions.' },
    why: { 'zh-CN': 'AI 会自动改很多代码，所以规则必须能被脚本和 CI 验证。', en: 'AI can change a lot of code automatically, so rules must be executable and CI-verifiable.' },
    learning: { 'zh-CN': '普通使用不需要逐个看；理解“这里负责验收”即可。', en: 'Normal use does not require reading each script; just understand that this area enforces verification.' },
    editAdvice: { 'zh-CN': '新增架构规则、迁移或验收流程时修改。', en: 'Edit when adding architecture rules, migrations, or verification flows.' },
    level: 'advanced',
    children: [
      { path: 'scripts/test-framework-ui-v1.ts', label: { 'zh-CN': '框架 UI 认知回归测试', en: 'Framework UI cognition regression tests' } },
      { path: 'scripts/test-framework-starter-v1.ts', label: { 'zh-CN': 'Knowledge Init / Asset Core 回归测试', en: 'Knowledge Init / Asset Core regression tests' } },
    ],
    keyFiles: ['package.json'],
  },
  {
    id: 'knowledge',
    path: '00–05',
    title: { 'zh-CN': '框架自己的知识资产', en: 'Framework self-knowledge assets' },
    summary: { 'zh-CN': '框架也用自己的知识体系记录介绍、设计、聊天、决策和派生产物。', en: 'The framework uses its own knowledge model for introductions, designs, conversations, decisions, and derived assets.' },
    purpose: { 'zh-CN': '保留“为什么这样设计、怎么发现问题、最后做了什么决定”的长期证据。', en: 'Preserves long-term evidence of why the framework is designed this way, how issues were discovered, and what was decided.' },
    why: { 'zh-CN': '这让框架可以 dogfooding：用自己的能力管理和反思自己。', en: 'This enables dogfooding: the framework manages and reflects on itself using its own capabilities.' },
    learning: { 'zh-CN': '重点看 02-design、04-conversations；不需要一次读完所有历史。', en: 'Focus on 02-design and 04-conversations; you do not need to read the entire history at once.' },
    editAdvice: { 'zh-CN': '通过聊天、Work Record、Design、Decision 自动或人工沉淀，不把这里当业务源码目录。', en: 'Populate through conversations, Work Records, Designs, and Decisions; do not treat these as business source directories.' },
    level: 'must-understand',
    children: [
      { path: '00-introduction', label: { 'zh-CN': '框架介绍与学习入口', en: 'Framework introduction and learning entry' } },
      { path: '02-design', label: { 'zh-CN': '设计方案与正式决策', en: 'Designs and accepted decisions' } },
      { path: '04-conversations', label: { 'zh-CN': 'Transcript 与 Work Record', en: 'Transcripts and Work Records' } },
      { path: '05-derived', label: { 'zh-CN': '派生分析与未来知识图谱', en: 'Derived analysis and future knowledge graph' } },
    ],
    keyFiles: ['AGENTS.md'],
  },
  {
    id: 'docs',
    path: 'docs',
    title: { 'zh-CN': '精确说明与长期规范', en: 'Precise docs & long-term specifications' },
    summary: { 'zh-CN': 'UI 负责看懂，docs 负责精确、长期、可追溯。', en: 'UI is for understanding; docs are for precision, durability, and traceability.' },
    purpose: { 'zh-CN': '保存 Provider、框架、迁移、架构等精确技术说明。', en: 'Stores precise technical documentation for Providers, framework, migrations, architecture, and more.' },
    why: { 'zh-CN': '可视化不能替代所有精确规范；两者分工不同。', en: 'Visuals cannot replace every exact specification; the two layers serve different purposes.' },
    learning: { 'zh-CN': '遇到页面解释不够精确时再深入文档。', en: 'Open docs when the visual explanation is not precise enough.' },
    editAdvice: { 'zh-CN': '需要长期技术规范或运行说明时维护。', en: 'Maintain when durable technical specification or operational guidance is needed.' },
    level: 'understand-later',
    children: [
      { path: 'docs/framework-ui-v1.md', label: { 'zh-CN': '框架学习 UI 规则', en: 'Framework learning UI contract' } },
      { path: 'docs/provider-capture.md', label: { 'zh-CN': 'Provider Capture 真实状态', en: 'Provider Capture real status' } },
    ],
    keyFiles: [],
  },
];

export const FRAMEWORK_KEY_FILE_GUIDES: FrameworkKeyFileGuide[] = [
  {
    path: 'src/App.tsx',
    title: { 'zh-CN': '整个前端页面的总装入口', en: 'Frontend composition entry' },
    responsibility: { 'zh-CN': '决定 01–06 页面怎么切换、资产深链和 Framework 深链怎么进入。', en: 'Composes pages 01–06 and routes asset/framework deep links.' },
    usedBy: { 'zh-CN': '浏览器运行的 React 应用。', en: 'The running React application.' },
    dependsOn: { 'zh-CN': 'Navigation、各页面组件、Workspace domain 类型。', en: 'Navigation, page components, and Workspace domain types.' },
    impact: { 'zh-CN': '高：页面接线错误会影响整个应用导航和入口。', en: 'High: wiring mistakes affect navigation and entry points across the whole app.' },
    learning: { 'zh-CN': '建议理解，不需要频繁修改。', en: 'Understand it; edit only when app-level routing/wiring changes.' },
    level: 'must-understand',
  },
  {
    path: 'src/components/FrameworkPage.tsx',
    title: { 'zh-CN': '框架学习主页面', en: 'Main framework learning page' },
    responsibility: { 'zh-CN': '把架构、运行链路、目录、Provider、Knowledge Init 和框架进化可视化。', en: 'Visualizes architecture, runtime flow, directories, Providers, Knowledge Init, and framework evolution.' },
    usedBy: { 'zh-CN': '06 框架学习。', en: '06 Framework Learning.' },
    dependsOn: { 'zh-CN': 'Framework 学习元数据、i18n、Asset Core、Language Core、Provider SDK。', en: 'Framework learning metadata, i18n, Asset Core, Language Core, and Provider SDK.' },
    impact: { 'zh-CN': '中：主要影响你的学习和管理体验，不直接改变业务项目数据。', en: 'Medium: mainly affects learning/management UX, not business project data.' },
    learning: { 'zh-CN': '这是你最值得熟悉的前端文件之一。', en: 'One of the most useful frontend files for you to understand.' },
    level: 'must-understand',
  },
  {
    path: 'src/services/assetClient.ts',
    title: { 'zh-CN': '前端到 Local API 的唯一主要边界', en: 'Primary frontend-to-Local-API boundary' },
    responsibility: { 'zh-CN': '所有文件、Workspace、Provider、受管知识资产请求都从这里进入后端。', en: 'Routes filesystem, Workspace, Provider, and managed-knowledge requests to the backend.' },
    usedBy: { 'zh-CN': '多个 React 页面与组件。', en: 'Many React pages and components.' },
    dependsOn: { 'zh-CN': 'Local API HTTP 接口。', en: 'Local API HTTP endpoints.' },
    impact: { 'zh-CN': '高：接口类型或路径变化会影响多个页面。', en: 'High: API shape or path changes affect many pages.' },
    learning: { 'zh-CN': '理解“前端不直接碰 fs/Git”这个边界即可。', en: 'Understand the rule that frontend never directly touches fs/Git.' },
    level: 'must-understand',
  },
  {
    path: 'server/config.ts',
    title: { 'zh-CN': '当前运行身份与项目绑定', en: 'Runtime identity and project binding' },
    responsibility: { 'zh-CN': '判断 Framework Self / Business Project、当前项目根目录、框架版本和运行 revision。', en: 'Determines Framework Self vs Business Project, project root, framework version, and running revision.' },
    usedBy: { 'zh-CN': 'Local API、Workspace、导航运行状态。', en: 'Local API, Workspace, and persistent runtime identity UI.' },
    dependsOn: { 'zh-CN': '文件系统、Git、.asset-workbench-data/config.json。', en: 'Filesystem, Git, and .asset-workbench-data/config.json.' },
    impact: { 'zh-CN': '很高：改错会混淆框架和业务项目，甚至让 UI 指向错误目录。', en: 'Very high: mistakes can blur framework/business boundaries or point UI at the wrong root.' },
    learning: { 'zh-CN': '必须理解，谨慎修改。', en: 'Must understand; edit carefully.' },
    level: 'must-understand',
  },
  {
    path: 'server/assetPlugin.ts',
    title: { 'zh-CN': 'Local API 总入口', en: 'Local API entry point' },
    responsibility: { 'zh-CN': '把前端请求路由到 Workspace、Provider、Starter、Knowledge 等后端服务。', en: 'Routes frontend requests to Workspace, Provider, Starter, Knowledge, and other backend services.' },
    usedBy: { 'zh-CN': 'assetClient 和 Vite 本地运行时。', en: 'assetClient and the local Vite runtime.' },
    dependsOn: { 'zh-CN': '多个 server Service。', en: 'Multiple server services.' },
    impact: { 'zh-CN': '高：新增 API 常需要经过这里。', en: 'High: new APIs commonly pass through here.' },
    learning: { 'zh-CN': '理解路由入口即可，不必记住所有接口。', en: 'Understand it as the routing entry; do not memorize every endpoint.' },
    level: 'understand-later',
  },
  {
    path: 'server/assetService.ts',
    title: { 'zh-CN': 'Workspace 与资产扫描服务', en: 'Workspace and asset scanning service' },
    responsibility: { 'zh-CN': '读取目录树、仓库、Skeleton 状态和 Workspace 事实。', en: 'Reads the tree, repositories, skeleton state, and Workspace facts.' },
    usedBy: { 'zh-CN': '资产空间、工作台、Local API。', en: 'Asset Space, Console, and Local API.' },
    dependsOn: { 'zh-CN': 'Scanner、Git Probe、Asset Core。', en: 'Scanner, Git Probe, and Asset Core.' },
    impact: { 'zh-CN': '高：直接影响用户看到的项目事实。', en: 'High: directly affects the project facts shown to users.' },
    learning: { 'zh-CN': '研究“项目如何被理解”时重点看。', en: 'Important when studying how projects are understood.' },
    level: 'must-understand',
  },
  {
    path: 'server/captureService.ts',
    title: { 'zh-CN': 'Provider-neutral Capture Kernel', en: 'Provider-neutral Capture Kernel' },
    responsibility: { 'zh-CN': '接收标准化 AI 会话事件、持久化 CaptureSession 并生成 Transcript。', en: 'Receives canonical AI events, persists CaptureSession state, and materializes Transcripts.' },
    usedBy: { 'zh-CN': '各 Provider Adapter。', en: 'All Provider adapters.' },
    dependsOn: { 'zh-CN': 'Canonical Capture Event、Managed Asset Service、持久化存储。', en: 'Canonical Capture Events, Managed Asset Service, and durable runtime storage.' },
    impact: { 'zh-CN': '很高：关系到聊天真实性、完整性和去重。', en: 'Very high: affects transcript truthfulness, completeness, and deduplication.' },
    learning: { 'zh-CN': '理解 Provider 采集原理时再深入。', en: 'Go deep when learning Provider capture internals.' },
    level: 'advanced',
  },
  {
    path: 'server/providerPlatformService.ts',
    title: { 'zh-CN': 'Provider 管理平台后端', en: 'Provider management backend' },
    responsibility: { 'zh-CN': '发现 Provider、状态、认证、验证、启停和自定义定义。', en: 'Handles Provider discovery, status, auth, verification, enable/disable, and custom definitions.' },
    usedBy: { 'zh-CN': '05 AI 接入 / Provider Manager。', en: '05 AI Connect / Provider Manager.' },
    dependsOn: { 'zh-CN': 'Provider SDK、Runtime State、Credential Store。', en: 'Provider SDK, runtime state, and credential store.' },
    impact: { 'zh-CN': '高：影响 AI 接入状态和安全边界。', en: 'High: affects AI integration state and security boundaries.' },
    learning: { 'zh-CN': '开发或调试 Provider 时重点看。', en: 'Important when building or debugging Providers.' },
    level: 'advanced',
  },
  {
    path: 'packages/asset-core/src/index.ts',
    title: { 'zh-CN': '00–05 项目知识结构单一事实源', en: '00–05 project knowledge structure SSOT' },
    responsibility: { 'zh-CN': '定义标准知识区域，供 Server、Framework UI、Knowledge Init 共同使用。', en: 'Defines the standard knowledge areas shared by Server, Framework UI, and Knowledge Init.' },
    usedBy: { 'zh-CN': 'assetService、FrameworkPage、starter。', en: 'assetService, FrameworkPage, and starter.' },
    dependsOn: { 'zh-CN': '尽量少依赖其它实现。', en: 'Intentionally minimal implementation dependencies.' },
    impact: { 'zh-CN': '高：改这里会改变所有项目知识结构标准。', en: 'High: changes affect the project knowledge structure standard everywhere.' },
    learning: { 'zh-CN': '必须理解“定义标准”和“创建项目”不是一回事。', en: 'Must understand that defining the standard is different from creating a project.' },
    level: 'must-understand',
  },
  {
    path: 'packages/protocol/src/index.ts',
    title: { 'zh-CN': '共享数据契约入口', en: 'Shared data contract entry' },
    responsibility: { 'zh-CN': '集中导出 Asset / Capture / Provider 的 TypeScript 公共类型。', en: 'Exports shared TypeScript types for Asset, Capture, and Provider domains.' },
    usedBy: { 'zh-CN': '前端、Server、Provider SDK。', en: 'Frontend, Server, and Provider SDK.' },
    dependsOn: { 'zh-CN': 'asset.ts / capture.ts / provider.ts。', en: 'asset.ts / capture.ts / provider.ts.' },
    impact: { 'zh-CN': '高：契约变化会跨多个层传播。', en: 'High: contract changes propagate across layers.' },
    learning: { 'zh-CN': '理解它是 Shared Contracts，不是“多语言后端协议”。', en: 'Understand it as Shared Contracts, not a multi-language backend protocol.' },
    level: 'understand-later',
  },
  {
    path: 'packages/starter/src/index.ts',
    title: { 'zh-CN': 'Knowledge Init 当前实现', en: 'Current Knowledge Init implementation' },
    responsibility: { 'zh-CN': '给空目录创建 00–05、README、AGENTS、Transcript / Work Record、Decision 结构。', en: 'Creates 00–05, README, AGENTS, Transcript/Work Record, and Decision structure in an empty target.' },
    usedBy: { 'zh-CN': 'Guide / Framework 页面里的 Knowledge Init。', en: 'Knowledge Init in Guide / Framework pages.' },
    dependsOn: { 'zh-CN': 'Asset Core 的标准结构。', en: 'The standard structure from Asset Core.' },
    impact: { 'zh-CN': '中：不会生成业务代码，也不是完整 Workbench Instance Creator。', en: 'Medium: it does not generate business code and is not a full Workbench Instance Creator.' },
    learning: { 'zh-CN': '理解当前能力边界，避免和 Spring Boot Starter / Maven 混淆。', en: 'Understand its current boundary to avoid Spring Boot Starter/Maven confusion.' },
    level: 'must-understand',
  },
  {
    path: 'packages/creator-core/src/index.ts',
    title: { 'zh-CN': 'Creator Instance 生命周期 Core', en: 'Creator Instance lifecycle Core' },
    responsibility: { 'zh-CN': '创建 Instance Manifest、验证版本身份、生成升级计划、应用迁移、记录备份并执行安全回滚。', en: 'Creates Instance Manifests, verifies version identity, plans upgrades, applies migrations, records backups, and performs safe rollback.' },
    usedBy: { 'zh-CN': 'Creator CLI、Local API、Creator Workbench 与生命周期测试。', en: 'Creator CLI, Local API, Creator Workbench, and lifecycle tests.' },
    dependsOn: { 'zh-CN': 'Knowledge Init、文件系统与 Framework identity。', en: 'Knowledge Init, filesystem state, and Framework identity.' },
    impact: { 'zh-CN': '很高：这里定义 Instance 版本、升级和回滚的真实安全边界。', en: 'Very high: this defines the real safety boundary for Instance versioning, upgrades, and rollback.' },
    learning: { 'zh-CN': '理解 Manifest / Plan / Migration 三个对象及“只回滚最新迁移”规则即可。', en: 'Understand Manifest / Plan / Migration plus the latest-migration-only rollback rule.' },
    level: 'must-understand',
  },
  {
    path: 'AGENTS.md',
    title: { 'zh-CN': '框架治理与 Agent 行为契约', en: 'Framework governance and Agent behavior contract' },
    responsibility: { 'zh-CN': '记录不可回退的产品、架构、知识沉淀和 Agent 执行规则。', en: 'Records non-regression product, architecture, knowledge capture, and Agent execution rules.' },
    usedBy: { 'zh-CN': '支持读取 AGENTS.md 的 Agent，以及人工审查。', en: 'Agents that support AGENTS.md plus human review.' },
    dependsOn: { 'zh-CN': '项目长期治理决策。', en: 'Long-term project governance decisions.' },
    impact: { 'zh-CN': '高：规则错误会让后续 AI 实施方向持续偏移。', en: 'High: wrong rules can steer future AI implementation in the wrong direction.' },
    learning: { 'zh-CN': '建议经常回看核心章节，不需要逐字背诵。', en: 'Review important sections regularly; no need to memorize it line by line.' },
    level: 'must-understand',
  },
  {
    path: 'package.json',
    title: { 'zh-CN': '工程入口与验证命令', en: 'Engineering entry and verification commands' },
    responsibility: { 'zh-CN': '定义 dev、build、test、migration、Agent gate 等 npm 命令。', en: 'Defines npm commands for dev, build, tests, migrations, and Agent gates.' },
    usedBy: { 'zh-CN': '开发者、CI、Agent。', en: 'Developers, CI, and Agents.' },
    dependsOn: { 'zh-CN': 'scripts 与 Node 依赖。', en: 'Scripts and Node dependencies.' },
    impact: { 'zh-CN': '中高：会影响构建和验收流程。', en: 'Medium-high: affects build and verification workflows.' },
    learning: { 'zh-CN': '知道常用 scripts 从这里来即可。', en: 'Know that common scripts originate here.' },
    level: 'understand-later',
  },
];

export const FRAMEWORK_INSTANCE_CAPABILITIES: FrameworkInstanceCapability[] = [
  {
    id: 'framework-self',
    title: { 'zh-CN': 'Framework Self 学习 / 自检', en: 'Framework Self learning / self-check' },
    description: { 'zh-CN': '可以观察并理解框架自己，但不会冒充业务项目。', en: 'The framework can inspect itself without pretending to be a business project.' },
    status: 'available',
  },
  {
    id: 'project-binding',
    title: { 'zh-CN': '一个实例绑定一个业务系统', en: 'One instance binds one business system' },
    description: { 'zh-CN': '当前可在引导页绑定一个外部真实项目。', en: 'You can currently bind one external real project from Guide.' },
    status: 'available',
  },
  {
    id: 'knowledge-init',
    title: { 'zh-CN': 'Knowledge Init', en: 'Knowledge Init' },
    description: { 'zh-CN': '当前可以给空目录初始化 00–05 等知识结构。', en: 'Currently initializes the 00–05 knowledge structure in an empty target.' },
    status: 'available',
  },
  {
    id: 'instance-creator',
    title: { 'zh-CN': '完整 Workbench Instance Creator / CLI', en: 'Full Workbench Instance Creator / CLI' },
    description: { 'zh-CN': '当前可为一个外部业务项目创建带 Framework / capability 版本身份的 Workbench Instance Manifest。', en: 'Creates a version-identified Workbench Instance Manifest for one external business project.' },
    status: 'available',
  },
  {
    id: 'instance-manifest',
    title: { 'zh-CN': 'Instance Manifest / Framework 版本锁定', en: 'Instance Manifest / framework version pinning' },
    description: { 'zh-CN': '当前真实记录实例基于哪个 Framework 版本、revision 与 Creator capability 版本。', en: 'Records the Framework version, revision, and Creator capability versions used by the instance.' },
    status: 'available',
  },
  {
    id: 'upgrade',
    title: { 'zh-CN': '升级检查与适用能力判断', en: 'Upgrade checks and capability applicability' },
    description: { 'zh-CN': '当前可比较中央 Framework 与 Instance Manifest，生成可审计、可应用的升级计划。', en: 'Compares the central Framework to the Instance Manifest and creates an auditable, applicable upgrade plan.' },
    status: 'available',
  },
  {
    id: 'migration',
    title: { 'zh-CN': 'Migration / Rollback', en: 'Migration / rollback' },
    description: { 'zh-CN': '当前对 Instance 版本身份变更生成迁移记录、Manifest 备份、验证与最新迁移回滚；业务代码迁移仍需未来扩展。', en: 'Creates migration evidence, Manifest backups, verification, and latest-migration rollback for Instance identity changes; business-code migrations remain future extensions.' },
    status: 'available',
  },
];
