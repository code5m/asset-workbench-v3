import type { LStr } from '../i18n/translations';

/**
 * These are learning annotations, not filesystem nodes.
 * Only attach a guide to a path returned by the real Local Asset Runtime.
 * Self-mode descriptions must never be applied to unrelated business projects.
 */
export type BeginnerDirectoryRole = 'knowledge' | 'program' | 'tools' | 'other';

export interface BeginnerDirectoryGuide {
  role: Exclude<BeginnerDirectoryRole, 'other'>;
  summary: LStr;
  what: LStr;
  why: LStr;
  learn: LStr;
  term?: LStr;
  contrast?: { path: string; explanation: LStr };
  /** A suggested real direct child. Verify with assetClient.tree() before showing a link. */
  startAt?: string;
}

const c = (zh: string, en: string): LStr => ({ 'zh-CN': zh, en });
const guide = (
  role: BeginnerDirectoryGuide['role'],
  summary: LStr,
  what: LStr,
  why: LStr,
  learn: LStr,
  extra: Partial<Pick<BeginnerDirectoryGuide, 'term' | 'contrast' | 'startAt'>> = {},
): BeginnerDirectoryGuide => ({ role, summary, what, why, learn, ...extra });

export const BEGINNER_ROLE_NAMES: Record<BeginnerDirectoryRole, LStr> = {
  knowledge: c('项目资料', 'Project knowledge'),
  program: c('工作台程序', 'Workbench software'),
  tools: c('工具与设置', 'Tools & settings'),
  other: c('真实项目内容', 'Real project content'),
};

const SELF_ROOT_GUIDES: Record<string, BeginnerDirectoryGuide> = {
  '00-introduction': guide('knowledge',
    c('先认识这个项目', 'Meet the project'),
    c('这里有项目介绍和上手指引。', 'Project introduction and getting-started guides.'),
    c('先知道这个软件解决什么问题，再学习代码更轻松。', 'It is easier to learn code after understanding the problem.'),
    c('先看 README 或入门指南。', 'Start with the README or first-use guide.'),
    { startAt: '00-introduction/README.md', term: c('项目入门（Onboarding）', 'Onboarding') }),
  '01-code': guide('knowledge',
    c('记录代码从哪里来、有哪些版本', 'Code sources and versions'),
    c('这里管理代码来源、仓库版本和代码资产记录，不是另一套程序源码。', 'Describes repository sources, revisions, and code evidence; it is not another copy of the app source.'),
    c('学会区分“代码存在哪里”和“我们记录了哪些代码版本”。', 'Distinguish where code lives from which versions are recorded.'),
    c('先读本目录说明，再比较 src。', 'Read the directory guide, then compare with src.'),
    { startAt: '01-code/README.md',
      contrast: { path: 'src', explanation: c('src 是让 Workbench 真正运行的前端源码；01-code 是管理代码资产的资料区。', 'src contains executable Workbench frontend source; 01-code describes code assets and revisions.') } }),
  '02-design': guide('knowledge',
    c('为什么要这样设计', 'Why it was designed this way'),
    c('这里记录设计方案、架构想法，以及正式决定。', 'Design proposals, architecture, and accepted decisions live here.'),
    c('不仅知道怎么做，还能追溯当时为什么做。', 'It preserves why a choice was made, not just how it was built.'),
    c('先读设计说明，再看相关决定。', 'Read the design overview before individual decisions.'),
    { startAt: '02-design/README.md' }),
  '03-docs': guide('knowledge',
    c('项目说明和知识文档', 'Project knowledge documents'),
    c('这里保存项目积累的说明、需求和报告。', 'Project-level explanations, requirements, and reports.'),
    c('项目经验不应该只留在聊天里。', 'Useful project knowledge should not live only in chats.'),
    c('从自己关心的一份文档开始。', 'Open a document related to your current question.'),
    { startAt: '03-docs/README.md',
      contrast: { path: 'docs', explanation: c('03-docs 是项目知识资产；docs 主要是 Workbench 软件自身的开发规范和技术说明。', '03-docs holds managed project knowledge; docs contains Workbench development specifications.') } }),
  '04-conversations': guide('knowledge',
    c('开发过程中和 AI 讨论了什么', 'AI and development conversations'),
    c('这里保存真实对话和任务工作记录，两者不会冒充彼此。', 'Original conversations and separate task records are kept here.'),
    c('学习代码的同时，也能看到当时怎样讨论、发现问题。', 'You can learn how problems were discussed and investigated.'),
    c('先分清“原始对话”和“任务总结”。', 'Start by distinguishing original transcripts from work summaries.'),
    { startAt: '04-conversations/README.md' }),
  '05-derived': guide('knowledge',
    c('从原始资料整理出的知识', 'Knowledge derived from source material'),
    c('为代码关系、索引与分析结果保存位置。是否已生成要看真实文件。', 'A place for graphs, indexes, and analyses. Actual output depends on real files.'),
    c('派生结果应能追溯到原始资料，而不能当成凭空存在的事实。', 'Derived outputs need traceable original sources.'),
    c('先理解原始资料，再查看实际存在的分析结果。', 'Learn the source material before inspecting available analyses.'),
    { startAt: '05-derived/README.md', term: c('派生数据（Derived data）', 'Derived data') }),
  src: guide('program',
    c('你看到的页面和按钮', 'Visible pages and buttons'),
    c('浏览器里出现的页面、按钮、目录树，大多在这里写出来。', 'Most pages, buttons, and the tree you see in the browser are built here.'),
    c('从看得见的页面学习代码，最容易建立直观认识。', 'Starting from a visible screen makes code easier to understand.'),
    c('先打开 App.tsx，再看看 components。', 'Open App.tsx, then explore components.'),
    { startAt: 'src/App.tsx', term: c('前端（Frontend / React）', 'Frontend (React)'),
      contrast: { path: '01-code', explanation: c('src 是正在运行的软件源码；01-code 保存代码资产与版本知识。', 'src is the app source; 01-code is the code knowledge area.') } }),
  server: guide('program',
    c('在后台处理文件和数据', 'Handles files and data behind the screen'),
    c('你点击打开目录后，这里的代码会读取真实文件并把结果交给页面。', 'When you open a folder, this code reads the real files and returns data to the screen.'),
    c('页面不能直接随意读取电脑文件，必须有安全的处理层。', 'A secure boundary is needed between a web page and the filesystem.'),
    c('先看 assetService.ts 如何读取目录。', 'Start with how assetService.ts reads directories.'),
    { startAt: 'server/assetService.ts', term: c('后端（Backend / Node.js）', 'Backend (Node.js)') }),
  packages: guide('program',
    c('多个功能共用的代码', 'Code shared by several features'),
    c('把多个地方都要用到的能力放在这里。', 'Holds building blocks used by multiple parts of the software.'),
    c('这样修改公共规则时，不必到处复制和改动。', 'Shared rules should not be copied in many places.'),
    c('先看看 asset-core，理解它负责哪类公共规则。', 'Start with asset-core and its shared rules.'),
    { startAt: 'packages/asset-core', term: c('公共模块（Shared packages）', 'Shared packages') }),
  providers: guide('program',
    c('连接不同的 AI 工具', 'Connects different AI tools'),
    c('这里放 AI 工具接入示例和扩展适配。', 'AI integration examples and adapters live here.'),
    c('不同 AI 工具可以接入同一套知识采集规则。', 'Different AI tools can use a consistent capture model.'),
    c('先看看 examples 中有哪些实际示例。', 'See the real examples that exist in examples.'),
    { startAt: 'providers/examples', term: c('适配器（Provider Adapter）', 'Provider adapter') }),
  docs: guide('program',
    c('工作台软件的技术说明', 'Workbench technical documentation'),
    c('解释 Workbench 自身的框架、模块、升级和工程规范。', 'Describes Workbench architecture, modules, upgrades, and engineering rules.'),
    c('这是开发软件时查规范的地方，不等同于 03-docs 的项目知识资料。', 'These are engineering specifications, not the 03-docs project knowledge archive.'),
    c('遇到技术细节时再深入这里。', 'Read this when you need detailed technical context.'),
    { startAt: 'docs/framework-and-starter.md',
      contrast: { path: '03-docs', explanation: c('docs 记录 Workbench 开发规范；03-docs 记录被管理的项目知识。', 'docs is Workbench engineering documentation; 03-docs is managed project knowledge.') } }),
  public: guide('program',
    c('页面用到的静态文件', 'Files used by the web pages'),
    c('通常放不需要经过代码编译就能直接使用的图片或资源。', 'Usually contains images or resources served without compiling them.'),
    c('区分网页资源与编写页面的 src 源代码。', 'Learn the difference between static assets and src source code.'),
    c('有需要时再打开具体资源。', 'Inspect resources only when needed.'),
    { term: c('静态资源（Static assets）', 'Static assets') }),
  scripts: guide('tools',
    c('帮你自动执行测试和检查', 'Automates tests and checks'),
    c('这些程序可以帮开发者重复运行检查、测试与维护任务。', 'Scripts automate checks, tests, and maintenance tasks.'),
    c('可靠的软件不能只凭“看起来能用”，还要能验证。', 'A software change needs verification, not just a good appearance.'),
    c('先看一个测试脚本做了哪些检查。', 'Start by inspecting a test script.'),
    { startAt: 'scripts/test-root-tree-visual-ia.ts', term: c('自动化脚本（Scripts）', 'Automation scripts') }),
  tools: guide('tools',
    c('辅助开发的小工具', 'Development helpers'),
    c('这里是项目提供的辅助工具，不是额外的程序根目录。', 'Project helpers live here; this is not a second app root.'),
    c('把辅助工具与真正的业务代码分清。', 'Distinguish helpers from main application code.'),
    c('需要用到工具时再学习。', 'Learn a tool when you need it.') }),
  '.github': guide('tools',
    c('GitHub 自动化设置', 'GitHub automation settings'),
    c('这里一般配置提交后的自动测试和协作规则。', 'Usually configures automated checks and collaboration.'),
    c('把代码提交后，检查往往在这里配置。', 'Repository checks are commonly configured here.'),
    c('先看 workflows 目录。', 'Explore workflows first.'),
    { startAt: '.github/workflows', term: c('持续集成（CI）', 'Continuous integration (CI)') }),
  '.codex': guide('tools',
    c('Codex 工具设置', 'Codex settings'),
    c('这里保存 Codex 相关的项目设置文件。', 'Project settings for Codex.'),
    c('AI 工具配置不等于 Workbench 的主程序代码。', 'AI tool settings are not the Workbench application.'),
    c('有使用这个工具时再深入。', 'Explore only if using this tool.') }),
  '.codebuddy': guide('tools',
    c('CodeBuddy 工具设置', 'CodeBuddy settings'),
    c('这里保存 CodeBuddy 相关的项目设置文件。', 'Project settings for CodeBuddy.'),
    c('区分 AI 工具配置与程序代码。', 'Separate AI tool settings from application source.'),
    c('需要时再查看。', 'Explore when needed.') }),
  '.opencode': guide('tools',
    c('OpenCode 工具设置', 'OpenCode settings'),
    c('这里保存 OpenCode 相关的项目设置文件。', 'Project settings for OpenCode.'),
    c('区分工具配置与程序代码。', 'Separate tool settings from application source.'),
    c('需要时再查看。', 'Explore when needed.') }),
  '.trae': guide('tools',
    c('Trae 工具设置', 'Trae settings'),
    c('这里保存 Trae 相关的项目设置文件。', 'Project settings for Trae.'),
    c('区分工具配置与程序代码。', 'Separate tool settings from application source.'),
    c('需要时再查看。', 'Explore when needed.') }),
};

export function getBeginnerDirectoryGuide(
  relativePath: string,
  mode: 'framework-self' | 'business-project',
): BeginnerDirectoryGuide | undefined {
  if (mode !== 'framework-self' || relativePath.includes('/')) return undefined;
  return SELF_ROOT_GUIDES[relativePath];
}

export function beginnerRootRole(
  relativePath: string,
  mode: 'framework-self' | 'business-project',
): BeginnerDirectoryRole {
  if (mode !== 'framework-self') return 'other';
  const named = SELF_ROOT_GUIDES[relativePath];
  if (named) return named.role;
  if (relativePath.startsWith('.') || /\.(json|js|ts|html|yml|yaml)$/.test(relativePath)) return 'tools';
  return 'other';
}
