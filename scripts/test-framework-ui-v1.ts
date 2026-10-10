import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ui } from '../src/i18n/translations.ts';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

test('framework page is a real sixth navigation section', () => {
  const workspace = read('src/domain/workspace.ts');
  const navigation = read('src/data/navigation.ts');
  const app = read('src/App.tsx');
  assert.match(workspace, /'framework'/);
  assert.match(navigation, /id: 'framework'/);
  assert.match(app, /FrameworkPage/);
  assert.match(app, /activeSection === 'framework'/);
});

test('existing product pages link into framework without changing their core roles', () => {
  const welcome = read('src/components/WelcomePage.tsx');
  const guide = read('src/components/GuidePage.tsx');
  const provider = read('src/components/ProviderManager.tsx');
  assert.match(welcome, /onNavigate\('framework'\)/);
  assert.match(guide, /StarterCreator/);
  assert.match(guide, /setProjectRoot/);
  assert.match(provider, /onFramework/);
  assert.match(provider, /ProviderConsole/);
});

test('Knowledge Creator UI crosses the Local API boundary instead of writing files in React', () => {
  const starter = read('src/components/StarterCreator.tsx');
  const client = read('src/services/assetClient.ts');
  const server = read('server/assetPlugin.ts');
  assert.doesNotMatch(starter, /node:fs|writeFileSync|mkdirSync|child_process/);
  assert.match(starter, /assetClient\.createKnowledge/);
  assert.match(starter, /assetClient\.verifyKnowledge/);
  assert.match(client, /\/creator\/knowledge\/create/);
  assert.match(client, /\/creator\/knowledge\/verify/);
  assert.match(server, /pathPart === '\/creator\/knowledge\/create'/);
  assert.match(server, /pathPart === '\/creator\/knowledge\/verify'/);
  assert.match(server, /createKnowledge\(\{ target, name \}\)/);
  assert.match(server, /verifyKnowledge\(target\)/);
  assert.match(server, /pathPart === '\/starter\/create'/);
});

test('framework UI consumes framework single sources of truth', () => {
  const page = read('src/components/FrameworkPage.tsx');
  assert.match(page, /DEFAULT_ASSET_SKELETON/);
  assert.match(page, /LANGUAGE_DESCRIPTORS/);
  assert.match(page, /BUILTIN_PROVIDER_DEFINITIONS/);
});

test('new framework UI keys exist in both locales', () => {
  const keys = [
    'welcomeFrameworkTitle',
    'guideStartModeTitle',
    'providerDeveloperTitle',
    'starterTitle',
    'frameworkTitle',
    'frameworkLanguageNeutral',
    'frameworkProviderTitle',
    'frameworkSkeletonTitle',
  ];
  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN key: ${key}`);
    assert.ok(ui.en[key], `missing en key: ${key}`);
  }
});


test('Asset Space uses beginner language and deep-links technical explanations', () => {
  const app = read('src/App.tsx');
  const explorer = read('src/components/AssetExplorer.tsx');
  const presentation = read('src/domain/rootTreePresentation.ts');

  assert.match(app, /openFramework/);
  assert.match(app, /onOpenFramework=\{openFramework\}/);
  assert.match(explorer, /rootLearnMore/);
  assert.match(explorer, /onLearnMore\(effectiveLearnMoreFocus\)/);
  assert.match(presentation, /learnMoreFocus/);
  assert.match(presentation, /name === 'providers' \? 'providers' : 'packages'/);
});

test('Framework page provides a plain-language map before technical details', () => {
  const page = read('src/components/FrameworkPage.tsx');
  assert.match(page, /frameworkBeginnerTitle/);
  assert.match(page, /frameworkBeginnerAssetsTitle/);
  assert.match(page, /frameworkBeginnerAiTitle/);
  assert.match(page, /frameworkBeginnerBaseTitle/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /packagesRef/);
  assert.match(page, /providersRef/);
});

test('beginner-facing copy exists in both locales', () => {
  const keys = [
    'rootLearnMore',
    'frameworkBeginnerTitle',
    'frameworkBeginnerAssetsBody',
    'frameworkBeginnerAiBody',
    'frameworkBeginnerBaseBody',
  ];
  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN beginner key: ${key}`);
    assert.ok(ui.en[key], `missing en beginner key: ${key}`);
  }

  assert.match(ui['zh-CN'].rootPurposeFrameworkPackages, /底层能力/);
  assert.match(ui['zh-CN'].rootPurposeFrameworkProviders, /AI 工具接入/);
  assert.match(ui['zh-CN'].rootPurposeAppSource, /Workbench 前端/);
  assert.match(ui['zh-CN'].rootPurposeAppServer, /Workbench 本地后端/);
});


test('Asset Space explains first-level src/packages/server entries without turning every deep file into tree prose', () => {
  const explorer = read('src/components/AssetExplorer.tsx');
  const presentation = read('src/domain/rootTreePresentation.ts');

  assert.match(explorer, /nestedTreeEntryHelp/);
  assert.match(explorer, /assetTreePurposeKey/);
  assert.match(explorer, /asset-purpose-note/);
  assert.match(explorer, /assetTreeHelpHint/);

  assert.match(presentation, /packages\/asset-core/);
  assert.match(presentation, /src\/components/);
  assert.match(presentation, /server\/assetPlugin\.ts/);
  assert.match(presentation, /server\/assetScanner\.ts/);
  assert.match(presentation, /showInTree: false/);
});

test('first-level architecture explanations exist in zh-CN and en', () => {
  const keys = [
    'assetPurpose',
    'assetTreeHelpHint',
    'treeHelpPackageAssetCore',
    'treeHelpPackageLanguageCore',
    'treeHelpPackageProtocol',
    'treeHelpPackageProviderSdk',
    'treeHelpPackageStarter',
    'treeHelpProviderExamples',
    'treeHelpSrcComponents',
    'treeHelpSrcData',
    'treeHelpSrcDomain',
    'treeHelpSrcI18n',
    'treeHelpSrcServices',
    'treeHelpServerAssetPlugin',
    'treeHelpServerAssetService',
    'treeHelpServerCaptureService',
    'treeHelpServerProviderPlatform',
    'treeHelpServerProviderAdapter',
    'treeHelpServerManagedAsset',
    'treeHelpServerCredentialStore',
    'treeHelpServerPathGuard',
  ];

  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN architecture help key: ${key}`);
    assert.ok(ui.en[key], `missing en architecture help key: ${key}`);
  }
});


test('Framework page closes the beginner mental-model loop', () => {
  const page = read('src/components/FrameworkPage.tsx');

  assert.match(page, /frameworkRuntimeTitle/);
  assert.match(page, /frameworkRuntimeFrontend/);
  assert.match(page, /frameworkRuntimeBackend/);
  assert.match(page, /frameworkVsProjectTitle/);
  assert.match(page, /frameworkSelfTitle/);
  assert.match(page, /frameworkManagedTitle/);
  assert.match(page, /framework-role-grid/);
  assert.match(page, /frameworkRoleFrameworkTitle/);
  assert.match(page, /frameworkRoleInstanceTitle/);
  assert.match(page, /frameworkRoleBindingTitle/);
  assert.match(page, /frameworkRoleKnowledgeTitle/);
  assert.match(page, /frameworkRoleProviderTitle/);
  assert.match(page, /frameworkRoleEvolutionTitle/);
  assert.match(page, /frameworkScopeKnowTitle/);
  assert.match(page, /frameworkScopeSkipTitle/);
});

test('beginner learning starts from six product roles, not package names', () => {
  const page = read('src/components/FrameworkPage.tsx');
  const framework = page.indexOf("frameworkRoleFrameworkTitle");
  const instance = page.indexOf("frameworkRoleInstanceTitle");
  const binding = page.indexOf("frameworkRoleBindingTitle");
  const knowledge = page.indexOf("frameworkRoleKnowledgeTitle");
  const provider = page.indexOf("frameworkRoleProviderTitle");
  const evolution = page.indexOf("frameworkRoleEvolutionTitle");

  assert.ok(framework >= 0 && instance > framework && binding > instance && knowledge > binding && provider > knowledge && evolution > provider);
  assert.match(page, /framework-technical-details/);
  assert.doesNotMatch(page, /BEGINNER_LEARNING_ORDER/);
});

test('framework-vs-managed-project explanation explicitly prevents copying Workbench internals into business projects', () => {
  assert.match(ui['zh-CN'].frameworkVsProjectLead, /工具本身/);
  assert.match(ui['zh-CN'].frameworkManagedBody, /真实项目/);
  assert.match(ui['zh-CN'].frameworkVsProjectRule, /src\/server\/packages.*必须/);
  assert.match(ui.en.frameworkVsProjectRule, /does not need Workbench’s own src\/server\/packages directories/);
});

test('all four beginner mental-model sections have zh-CN and en coverage', () => {
  const keys = [
    'frameworkRuntimeTitle',
    'frameworkRuntimeFrontend',
    'frameworkRuntimeBackend',
    'frameworkVsProjectTitle',
    'frameworkSelfTitle',
    'frameworkManagedTitle',
    'frameworkLearningTitle',
    'frameworkLearnAssetTitle',
    'frameworkLearnStarterTitle',
    'frameworkLearnLanguageTitle',
    'frameworkLearnProtocolTitle',
    'frameworkLearnProviderTitle',
    'frameworkScopeTitle',
    'frameworkScopeKnowTitle',
    'frameworkScopeSkipTitle',
  ];

  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN mental-model key: ${key}`);
    assert.ok(ui.en[key], `missing en mental-model key: ${key}`);
  }
});


test('framework package cards are beginner-first and follow the recommended learning order', () => {
  const page = read('src/components/FrameworkPage.tsx');

  const asset = page.indexOf("['asset-core', 'Asset Core'");
  const starter = page.indexOf("['starter', 'Starter'");
  const creator = page.indexOf("['creator-core', 'Creator Core'");
  const language = page.indexOf("['language-core', 'Language Core'");
  const protocol = page.indexOf("['protocol', 'Protocol'");
  const provider = page.indexOf("['provider-sdk', 'Provider SDK'");

  assert.ok(asset >= 0 && starter > asset && creator > starter && language > creator && protocol > language && provider > protocol);
  assert.match(page, /framework-package-badge/);
  assert.match(page, /frameworkPackageBadgeStart/);
  assert.match(page, /frameworkPackageBadgeLater/);
  assert.match(page, /frameworkPackageBadgeProvider/);
});

test('framework package cards use plain-language primary titles and technical names second', () => {
  assert.equal(ui['zh-CN'].frameworkPackagesEyebrow, '底层能力');
  assert.equal(ui['zh-CN'].frameworkPackagesTitle, '这 6 块分别负责什么');
  assert.equal(ui['zh-CN'].frameworkPackageAssetTitle, '项目知识结构');
  assert.equal(ui['zh-CN'].frameworkPackageStarterTitle, '项目知识初始化器');
  assert.equal(ui['zh-CN'].frameworkPackageCreatorTitle, 'Instance 生命周期 Core');
  assert.equal(ui['zh-CN'].frameworkPackageLanguageTitle, '项目生态识别（内部能力）');
  assert.equal(ui['zh-CN'].frameworkPackageProtocolTitle, '共享数据契约');
  assert.equal(ui['zh-CN'].frameworkPackageProviderTitle, 'AI 接入工具箱');

  const page = read('src/components/FrameworkPage.tsx');
  assert.match(page, /<h3>\{t\(title\)\}<\/h3>/);
  assert.match(page, /<code>\{technicalName\}<\/code>/);
  assert.match(page, /<small>packages\/\{name\}<\/small>/);
});

test('framework package learning badges exist in both locales', () => {
  const keys = [
    'frameworkPackagesLead',
    'frameworkPackageBadgeStart',
    'frameworkPackageBadgeLater',
    'frameworkPackageBadgeProvider',
  ];

  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN package learning key: ${key}`);
    assert.ok(ui.en[key], `missing en package learning key: ${key}`);
  }
});


test('Asset Core copy says it is already in use and Starter consumes the standard', () => {
  assert.match(ui['zh-CN'].frameworkPackageAssetBody, /当前 Workbench 已经在使用/);
  assert.match(ui['zh-CN'].frameworkPackageAssetBody, /新项目也会复用/);
  assert.match(ui['zh-CN'].starterLead, /只负责.*知识结构|不是 Spring Boot Starter/);
  assert.match(ui.en.frameworkPackageAssetBody, /current Workbench already uses/);
  assert.match(ui.en.starterLead, /initializes only the 00–05 knowledge areas|not a Spring Boot Starter/);
});


test('knowledge lifecycle is integrated into existing product pages without adding a duplicate navigation page', () => {
  const component = read('src/components/KnowledgeLifecycle.tsx');
  const welcome = read('src/components/WelcomePage.tsx');
  const guide = read('src/components/GuidePage.tsx');
  const assets = read('src/components/AssetExplorer.tsx');
  const providers = read('src/components/ProviderManager.tsx');
  const app = read('src/App.tsx');
  const navigation = read('src/data/navigation.ts');

  assert.match(component, /knowledgeStepConversationTitle/);
  assert.match(component, /knowledgeStepWorkRecordTitle/);
  assert.match(component, /knowledgeStepDesignTitle/);
  assert.match(component, /knowledgeStepDecisionTitle/);

  assert.match(welcome, /KnowledgeLifecycle/);
  assert.match(welcome, /04-conversations/);
  assert.match(welcome, /02-design\/decisions/);

  assert.match(guide, /titleKey="guideKnowledgeTitle"/);
  assert.match(guide, /onOpenAsset/);
  assert.match(assets, /titleKey="assetKnowledgeTitle"/);
  assert.match(providers, /titleKey="providerKnowledgeTitle"/);
  assert.match(app, /GuidePage onNavigate=\{setActiveSection\} onOpenAsset=\{openAsset\}/);
  assert.match(app, /ProviderManager onNavigate=\{setActiveSection\} onOpenAsset=\{openAsset\}/);

  assert.doesNotMatch(navigation, /id: 'knowledge'/);
  assert.doesNotMatch(navigation, /id: 'decisions'/);
});

test('knowledge lifecycle copy is bilingual and keeps evidence separate from conclusions', () => {
  const keys = [
    'knowledgeLifecycleTitle',
    'knowledgeLifecycleLead',
    'knowledgeStepConversationTitle',
    'knowledgeStepWorkRecordTitle',
    'knowledgeStepDesignTitle',
    'knowledgeStepDecisionTitle',
    'knowledgeLifecycleRuleBody',
    'guideKnowledgeTitle',
    'assetKnowledgeTitle',
    'providerKnowledgeTitle',
  ];

  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN knowledge lifecycle key: ${key}`);
    assert.ok(ui.en[key], `missing en knowledge lifecycle key: ${key}`);
  }

  assert.match(ui['zh-CN'].knowledgeLifecycleRuleBody, /04-conversations/);
  assert.match(ui['zh-CN'].knowledgeLifecycleRuleBody, /02-design\/decisions/);
  assert.match(ui['zh-CN'].providerKnowledgeLead, /不等于|另外判断|证据/);
});


test('Framework page exposes governed evolution only as an advanced collapsed section', () => {
  const page = read('src/components/FrameworkPage.tsx');

  assert.match(page, /<details className="panel framework-evolution">/);
  assert.match(page, /frameworkEvolutionTitle/);
  assert.match(page, /frameworkEvolutionProject/);
  assert.match(page, /frameworkEvolutionEvidence/);
  assert.match(page, /frameworkEvolutionPattern/);
  assert.match(page, /frameworkEvolutionCandidate/);
  assert.match(page, /frameworkEvolutionVerify/);
  assert.match(page, /frameworkEvolutionRelease/);
  assert.match(page, /frameworkEvolutionAdopt/);
});

test('framework evolution copy is bilingual and protects Core from one-project exceptions', () => {
  const keys = [
    'frameworkEvolutionTitle',
    'frameworkEvolutionSummary',
    'frameworkEvolutionLead',
    'frameworkEvolutionProject',
    'frameworkEvolutionEvidence',
    'frameworkEvolutionPattern',
    'frameworkEvolutionCandidate',
    'frameworkEvolutionVerify',
    'frameworkEvolutionRelease',
    'frameworkEvolutionAdopt',
    'frameworkEvolutionRuleProjectTitle',
    'frameworkEvolutionRuleCoreTitle',
    'frameworkEvolutionRuleRsiTitle',
  ];

  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN framework evolution key: ${key}`);
    assert.ok(ui.en[key], `missing en framework evolution key: ${key}`);
  }

  assert.match(ui['zh-CN'].frameworkEvolutionRuleProjectBody, /不能.*直接进入.*Core|不能.*进入公共 Core/);
  assert.match(ui['zh-CN'].frameworkEvolutionRuleRsiBody, /证据.*版本.*兼容性.*迁移.*回滚/);
});

test('AGENTS governs evidence-driven framework evolution and controlled RSI', () => {
  const agents = read('AGENTS.md');

  assert.match(agents, /Evidence-Driven Framework Evolution/);
  assert.match(agents, /one-project special case remains project-local by default/i);
  assert.match(agents, /Framework Candidate/);
  assert.match(agents, /not by copying the entire Workbench repository/i);
  assert.match(agents, /Discover -> Propose -> Prove -> Promote/);
});


test('Workbench separates framework self-study mode from a bound business project', () => {
  const config = read('server/config.ts');
  const plugin = read('server/assetPlugin.ts');
  const consolePage = read('src/components/WorkspaceConsole.tsx');
  const assets = read('src/components/AssetExplorer.tsx');
  const guide = read('src/components/GuidePage.tsx');

  assert.match(config, /'framework-self' \| 'business-project'/);
  assert.match(config, /hasExternalProject/);
  assert.match(plugin, /\.\.\.loadConfig\(\), configurable: true/);
  assert.match(consolePage, /runtimeMode === 'framework-self'/);
  assert.match(consolePage, /runtimeFrameworkNoticeTitle/);
  assert.match(assets, /assetFrameworkModeTitle/);
  assert.match(guide, /guideBindingTitle/);
  assert.match(guide, /cfg\.mode === 'business-project'/);
});

test('Framework is primarily a visual learning page and technical packages are secondary', () => {
  const page = read('src/components/FrameworkPage.tsx');

  assert.match(page, /frameworkLearningPurposeTitle/);
  assert.match(page, /frameworkModelTitle/);
  assert.match(page, /framework-role-grid/);
  assert.match(page, /<details className="panel framework-technical-details"/);

  const keys = [
    'frameworkLearningPurposeTitle',
    'frameworkModelTitle',
    'frameworkRoleFrameworkTitle',
    'frameworkRoleInstanceTitle',
    'frameworkRoleBindingTitle',
    'frameworkRoleKnowledgeTitle',
    'frameworkRoleProviderTitle',
    'frameworkRoleEvolutionTitle',
    'runtimeFrameworkNoticeTitle',
    'runtimeBusinessNoticeTitle',
    'assetFrameworkModeTitle',
    'guideBindingTitle',
  ];
  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN key: ${key}`);
    assert.ok(ui.en[key], `missing en key: ${key}`);
  }
});

test('Starter remains Knowledge-only while Instance lifecycle is a separate real capability', () => {
  assert.match(ui['zh-CN'].starterTitle, /初始化项目知识结构/);
  assert.match(ui['zh-CN'].starterLead, /不是 Spring Boot Starter/);
  assert.match(ui['zh-CN'].frameworkRoleInstanceBody, /真实 Workbench Instance Manifest/);
  assert.match(ui.en.frameworkRoleInstanceBody, /real Workbench Instance Manifest/);
  assert.match(ui['zh-CN'].instanceSafety, /不自动重写业务代码/);
  assert.match(ui.en.instanceSafety, /never rewrite business code automatically/);
});


test('navigation always shows visual runtime identity so the user can manage by sight', () => {
  const nav = read('src/components/AppNavigation.tsx');
  const config = read('server/config.ts');
  const client = read('src/services/assetClient.ts');

  assert.match(nav, /nav-runtime-card/);
  assert.match(nav, /navRuntimeTitle/);
  assert.match(nav, /navFrameworkVersion/);
  assert.match(nav, /navCurrentProject/);
  assert.match(nav, /frameworkRevision/);
  assert.match(nav, /navNoBusinessProject/);
  assert.match(config, /frameworkVersion/);
  assert.match(config, /frameworkRevision/);
  assert.match(client, /frameworkVersion: string/);
  assert.match(client, /frameworkRevision: string/);

  for (const key of ['navRuntimeTitle', 'navFrameworkVersion', 'navCurrentProject', 'navNoBusinessProject']) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN runtime identity key: ${key}`);
    assert.ok(ui.en[key], `missing en runtime identity key: ${key}`);
  }
});


test('visual framework console exposes directories, key files, instances, and version learning views', () => {
  const page = read('src/components/FrameworkPage.tsx');
  const consoleView = read('src/components/FrameworkLearningConsole.tsx');
  const learning = read('src/data/frameworkLearning.ts');

  assert.match(page, /FrameworkLearningConsole/);
  assert.match(page, /onNavigate=\{onNavigate\}/);
  assert.match(consoleView, /frameworkConsoleDirectories/);
  assert.match(consoleView, /frameworkConsoleFiles/);
  assert.match(consoleView, /frameworkConsoleInstances/);
  assert.match(consoleView, /frameworkConsoleVersions/);
  assert.match(consoleView, /DirectoryDetail/);
  assert.match(consoleView, /FileDetail/);
  assert.match(consoleView, /InstanceManager/);
  assert.match(consoleView, /VersionMap/);

  for (const path of ['src', 'server', 'packages', 'providers', 'scripts', '00–05', 'docs']) {
    assert.match(learning, new RegExp(`path: '${path.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}'`));
  }
});

test('directory learning explains purpose, reason, learning depth, edit advice, and key files', () => {
  const learning = read('src/data/frameworkLearning.ts');

  assert.match(learning, /purpose:/);
  assert.match(learning, /why:/);
  assert.match(learning, /learning:/);
  assert.match(learning, /editAdvice:/);
  assert.match(learning, /keyFiles:/);
  assert.match(learning, /server\/config\.ts/);
  assert.match(learning, /src\/components\/FrameworkPage\.tsx/);
  assert.match(learning, /packages\/asset-core\/src\/index\.ts/);
});

test('key file explanations answer the five beginner questions without documenting every file', () => {
  const component = read('src/components/FrameworkLearningConsole.tsx');
  const learning = read('src/data/frameworkLearning.ts');

  assert.match(component, /frameworkFileResponsibility/);
  assert.match(component, /frameworkFileUsedBy/);
  assert.match(component, /frameworkFileDependsOn/);
  assert.match(component, /frameworkFileImpact/);
  assert.match(component, /frameworkFileLearning/);

  assert.match(learning, /responsibility:/);
  assert.match(learning, /usedBy:/);
  assert.match(learning, /dependsOn:/);
  assert.match(learning, /impact:/);
  assert.match(learning, /AGENTS\.md/);
});

test('Instance / CLI UI is visual-first and exposes the implemented lifecycle honestly', () => {
  const component = read('src/components/FrameworkLearningConsole.tsx');
  const learning = read('src/data/frameworkLearning.ts');

  assert.match(component, /assetClient\.config\(\)/);
  assert.match(component, /assetClient\.instanceStatus/);
  assert.match(component, /framework-instance-current/);
  assert.match(component, /onNavigate\('guide'\)/);
  assert.match(component, /frameworkInstanceCliAvailable/);
  assert.doesNotMatch(component, /frameworkInstanceCliPlanned/);
  for (const id of ['knowledge-init', 'instance-creator', 'instance-manifest', 'upgrade', 'migration']) {
    const block = learning.slice(learning.indexOf(`id: '${id}'`), learning.indexOf(`id: '${id}'`) + 700);
    assert.match(block, /status: 'available'/, `${id} should be available`);
  }
  assert.match(learning, /packages\/creator-core\/src\/index\.ts/);
});

test('Creator Knowledge is executable from Workbench and shares its core with CLI and Local API', () => {
  const creator = read('src/components/StarterCreator.tsx');
  const workbench = read('src/components/CreatorWorkbench.tsx');
  const workspace = read('src/components/WorkspaceConsole.tsx');
  const app = read('src/App.tsx');
  const client = read('src/services/assetClient.ts');
  const plugin = read('server/assetPlugin.ts');
  const core = read('packages/starter/src/index.ts');
  const cli = read('scripts/creator-cli.ts');
  const framework = read('src/components/FrameworkLearningConsole.tsx');
  const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  assert.match(creator, /assetClient\.createKnowledge/);
  assert.match(creator, /assetClient\.verifyKnowledge/);
  assert.match(creator, /starterVerificationTitle/);
  assert.match(creator, /starter-cli-map/);
  assert.match(workbench, /<StarterCreator/);
  assert.match(workbench, /workspace === 'knowledge'/);
  assert.match(workbench, /Knowledge Creator/);
  assert.match(workbench, /workspace === 'instance'/);
  assert.match(workbench, /Instance Manager/);
  assert.match(read('src/components/InstanceLifecyclePanel.tsx'), /instance-stage-nav/);
  assert.match(workbench, /<InstanceLifecyclePanel/);
  assert.doesNotMatch(workbench, /status: 'planned'/);
  assert.doesNotMatch(workbench, /child_process|exec\(|spawn\(/);
  assert.match(workspace, /<CreatorWorkbench/);
  assert.match(workspace, /consoleModeCreator/);
  assert.match(app, /openCreatorWorkbench/);
  assert.match(app, /setConsoleView\('creator'\)/);
  assert.match(client, /\/creator\/knowledge\/create/);
  assert.match(client, /\/creator\/knowledge\/verify/);
  assert.match(plugin, /createKnowledge/);
  assert.match(plugin, /verifyKnowledge/);
  assert.match(core, /export function createKnowledge/);
  assert.match(core, /export function verifyKnowledge/);
  assert.match(cli, /creator knowledge/);
  assert.equal(packageJson.scripts.creator, 'node --experimental-strip-types scripts/creator-cli.ts');
  assert.doesNotMatch(framework, /<StarterCreator/);
  assert.match(framework, /frameworkCreatorWorkbenchAction/);
  assert.match(framework, /npm run creator -- knowledge create/);
  assert.match(framework, /npm run creator -- instance create/);
  assert.match(framework, /npm run creator -- instance upgrade-plan/);
  assert.match(framework, /npm run creator -- instance rollback/);
  assert.match(framework, /frameworkInstanceCliAvailable/);
});

test('Instance lifecycle Workbench uses typed APIs and never exposes arbitrary shell', () => {
  const panel = read('src/components/InstanceLifecyclePanel.tsx');
  const client = read('src/services/assetClient.ts');
  const plugin = read('server/assetPlugin.ts');
  const core = read('packages/creator-core/src/index.ts');
  const cli = read('scripts/creator-cli.ts');

  assert.match(panel, /assetClient\.createInstance/);
  assert.match(panel, /assetClient\.verifyInstance/);
  assert.match(panel, /assetClient\.planInstanceUpgrade/);
  assert.match(panel, /assetClient\.applyInstanceUpgrade/);
  assert.match(panel, /assetClient\.rollbackInstance/);
  assert.doesNotMatch(panel, /child_process|exec\(|spawn\(/);

  assert.match(client, /\/creator\/instance\/create/);
  assert.match(client, /\/creator\/instance\/status/);
  assert.match(client, /\/creator\/instance\/verify/);
  assert.match(client, /\/creator\/instance\/upgrade\/plan/);
  assert.match(client, /\/creator\/instance\/upgrade\/apply/);
  assert.match(client, /\/creator\/instance\/rollback/);

  assert.match(plugin, /createInstance/);
  assert.match(plugin, /planInstanceUpgrade/);
  assert.match(plugin, /applyInstanceUpgrade/);
  assert.match(plugin, /rollbackInstance/);

  assert.match(core, /InstanceManifest/);
  assert.match(core, /InstanceUpgradePlan/);
  assert.match(core, /MigrationRecord/);
  assert.match(core, /backupPath/);
  assert.match(core, /only the latest applied migration can be rolled back safely/);
  assert.match(core, /external business project/);

  assert.match(cli, /instance create/);
  assert.match(cli, /instance upgrade-plan/);
  assert.match(cli, /instance upgrade-apply/);
  assert.match(cli, /instance rollback/);
});

test('Upgrade lifecycle cards show implemented truth and keep business-code migration explicitly planned', () => {
  const component = read('src/components/FrameworkLearningConsole.tsx');
  const zh = ui['zh-CN'];
  const en = ui.en;

  const upgradeSection = component.slice(component.indexOf('framework-upgrade-grid'), component.indexOf('framework-version-honesty'));
  assert.equal((upgradeSection.match(/framework-capability-status available/g) ?? []).length, 4);
  assert.equal((upgradeSection.match(/framework-capability-status planned/g) ?? []).length, 0);
  assert.match(zh.frameworkVersionHonesty, /仍在规划.*业务代码 Migration.*数据库 Schema Migration.*源码跨版本改写/);
  assert.match(en.frameworkVersionHonesty, /Still planned: automatic business-code migration, database schema migration, and automatic cross-version source rewriting/);
});

test('Creator Workbench exposes a typed one-click Instance self test without browser shell', () => {
  const panel = read('src/components/InstanceLifecyclePanel.tsx');
  const client = read('src/services/assetClient.ts');
  const plugin = read('server/assetPlugin.ts');
  const core = read('packages/creator-core/src/index.ts');
  const cli = read('scripts/creator-cli.ts');

  assert.match(panel, /assetClient\.runInstanceSelfTest/);
  assert.match(panel, /instanceSelfTestAction/);
  assert.match(panel, /SELF_TEST_PASS/);
  assert.doesNotMatch(panel, /child_process|exec\(|spawn\(/);

  assert.match(client, /\/creator\/instance\/self-test/);
  assert.match(plugin, /runInstanceLifecycleSelfTest/);
  assert.match(plugin, /\/creator\/instance\/self-test/);
  assert.match(core, /export function runInstanceLifecycleSelfTest/);
  assert.match(core, /business-file-unchanged/);
  assert.match(core, /framework-self-isolation/);
  assert.match(core, /cleanup/);
  assert.match(cli, /instance self-test/);
});

test('Instance Self Test is presented as an ordered learning flow with purpose, action, and pass criteria', () => {
  const panel = read('src/components/InstanceLifecyclePanel.tsx');
  const zh = ui['zh-CN'];
  const en = ui.en;

  const orderedIds = [
    'instance-create',
    'pre-upgrade-verify',
    'upgrade-plan',
    'upgrade-apply',
    'migration-evidence',
    'backup-evidence',
    'post-upgrade-verify',
    'rollback',
    'post-rollback-verify',
    'business-file-unchanged',
    'framework-self-isolation',
    'cleanup',
  ];

  let previous = -1;
  for (const id of orderedIds) {
    const index = panel.indexOf(`id: '${id}'`);
    assert.ok(index > previous, `Self Test step should appear in order: ${id}`);
    previous = index;
  }

  assert.match(panel, /number: '01'/);
  assert.match(panel, /number: '12'/);
  assert.match(panel, /instanceSelfTestPurposeLabel/);
  assert.match(panel, /instanceSelfTestCommandLabel/);
  assert.match(panel, /instanceSelfTestCheckLabel/);
  assert.match(panel, /instanceSelfTestPassCriteriaLabel/);
  assert.match(panel, /instance-self-test-technical/);
  assert.match(panel, /<details className="instance-self-test-technical">/);

  assert.match(zh.instanceSelfTestRoute, /创建旧版本 Instance.*升级前验证.*生成升级计划.*应用升级.*回滚.*清理临时数据/);
  assert.match(zh.instanceSelfTestStepPlanPurpose, /比较旧 Instance 与当前 Framework/);
  assert.match(zh.instanceSelfTestStepPlanAction, /npm run creator -- instance upgrade-plan/);
  assert.match(zh.instanceSelfTestStepPlanPass, /Upgrade Plan/);
  assert.match(zh.instanceSelfTestStepBusinessPurpose, /不偷偷修改业务源码/);
  assert.match(zh.instanceSelfTestStepIsolationPass, /外部业务项目/);

  assert.match(en.instanceSelfTestRoute, /Create old Instance.*upgrade plan.*rollback.*cleanup/i);
  assert.match(en.instanceSelfTestStepPlanAction, /npm run creator -- instance upgrade-plan/);
});

test('Framework Learning is slimmed to learning while operational Creator lives in Workbench', () => {
  const page = read('src/components/FrameworkPage.tsx');
  const frameworkConsole = read('src/components/FrameworkLearningConsole.tsx');
  const workspace = read('src/components/WorkspaceConsole.tsx');
  const creatorWorkbench = read('src/components/CreatorWorkbench.tsx');

  assert.doesNotMatch(page, /<StarterCreator/);
  assert.doesNotMatch(frameworkConsole, /<StarterCreator/);
  assert.match(page, /onOpenCreator/);
  assert.match(page, /frameworkOpenCreatorWorkbench/);
  assert.match(frameworkConsole, /frameworkCreatorWorkbenchAction/);
  assert.match(workspace, /view === 'creator'/);
  assert.match(workspace, /CreatorWorkbench/);
  assert.match(creatorWorkbench, /Knowledge Creator|creatorCapabilityKnowledge/);

  const collapsedSections = page.match(/<details className="panel framework-technical-details/g) ?? [];
  assert.ok(collapsedSections.length >= 4, 'technical/reference sections should be progressively disclosed');
});

test('version view keeps Framework, Instance, and Business Project identities separate', () => {
  const component = read('src/components/FrameworkLearningConsole.tsx');

  assert.match(component, /frameworkVersionCentral/);
  assert.match(component, /frameworkVersionInstance/);
  assert.match(component, /frameworkVersionProject/);
  assert.match(component, /frameworkRevision/);
  assert.match(component, /frameworkVersionInstanceCurrentBound/);
  assert.match(component, /frameworkVersionInstanceUnbound/);
  assert.match(component, /frameworkVersionHonesty/);
});

test('visual framework console copy exists in zh-CN and en', () => {
  const keys = [
    'frameworkConsoleTitle',
    'frameworkConsoleDirectories',
    'frameworkConsoleFiles',
    'frameworkConsoleInstances',
    'frameworkConsoleVersions',
    'frameworkGuideWhat',
    'frameworkGuideWhy',
    'frameworkGuideLearn',
    'frameworkGuideEdit',
    'frameworkFileResponsibility',
    'frameworkFileUsedBy',
    'frameworkFileDependsOn',
    'frameworkFileImpact',
    'frameworkFileLearning',
    'frameworkInstanceTitle',
    'frameworkInstanceUiFirstTitle',
    'frameworkInstanceCurrentMode',
    'frameworkInstanceBindAction',
    'frameworkCreatorCliAvailable',
    'frameworkCreatorWorkbenchTitle',
    'frameworkCreatorWorkbenchAction',
    'frameworkOpenCreatorWorkbench',
    'consoleModeProject',
    'consoleModeCreator',
    'creatorWorkbenchTitle',
    'creatorCapabilityKnowledge',
    'creatorCapabilityInstance',
    'creatorWorkbenchBoundaryTitle',
    'frameworkInstanceCliCurrent',
    'frameworkInstanceCliAvailable',
    'instanceLifecycleTitle',
    'instanceCreateAction',
    'instanceVerifyAction',
    'instancePlanAction',
    'instanceApplyAction',
    'instanceRollbackAction',
    'instanceManifestTitle',
    'instanceVerificationTitle',
    'instanceUpgradePlanTitle',
    'instanceMigrationEvidence',
    'instanceSelfTestAction',
    'instanceSelfTestRunning',
    'instanceSelfTestPass',
    'instanceSelfTestFail',
    'instanceSelfTestTitle',
    'instanceSelfTestCleanup',
    'instanceSelfTestPassHuman',
    'instanceSelfTestFailHuman',
    'instanceSelfTestRouteTitle',
    'instanceSelfTestRoute',
    'instanceSelfTestPurposeLabel',
    'instanceSelfTestCommandLabel',
    'instanceSelfTestCheckLabel',
    'instanceSelfTestPassCriteriaLabel',
    'instanceSelfTestFailureReason',
    'instanceSelfTestStatusPass',
    'instanceSelfTestStatusFail',
    'instanceSelfTestStatusPending',
    'instanceSelfTestTechnicalDetails',
    'instanceSelfTestTechnicalDetailsHint',
    'instanceSelfTestPhaseBaseline',
    'instanceSelfTestPhaseUpgrade',
    'instanceSelfTestPhaseVerify',
    'instanceSelfTestPhaseRollback',
    'instanceSelfTestPhaseSafety',
    'instanceSelfTestPhaseCleanup',
    'instanceSelfTestStepCreateTitle',
    'instanceSelfTestStepCreatePurpose',
    'instanceSelfTestStepCreateAction',
    'instanceSelfTestStepCreatePass',
    'instanceSelfTestStepPreVerifyTitle',
    'instanceSelfTestStepPreVerifyPurpose',
    'instanceSelfTestStepPreVerifyAction',
    'instanceSelfTestStepPreVerifyPass',
    'instanceSelfTestStepPlanTitle',
    'instanceSelfTestStepPlanPurpose',
    'instanceSelfTestStepPlanAction',
    'instanceSelfTestStepPlanPass',
    'instanceSelfTestStepApplyTitle',
    'instanceSelfTestStepApplyPurpose',
    'instanceSelfTestStepApplyAction',
    'instanceSelfTestStepApplyPass',
    'instanceSelfTestStepMigrationTitle',
    'instanceSelfTestStepMigrationPurpose',
    'instanceSelfTestStepMigrationAction',
    'instanceSelfTestStepMigrationPass',
    'instanceSelfTestStepBackupTitle',
    'instanceSelfTestStepBackupPurpose',
    'instanceSelfTestStepBackupAction',
    'instanceSelfTestStepBackupPass',
    'instanceSelfTestStepPostVerifyTitle',
    'instanceSelfTestStepPostVerifyPurpose',
    'instanceSelfTestStepPostVerifyAction',
    'instanceSelfTestStepPostVerifyPass',
    'instanceSelfTestStepRollbackTitle',
    'instanceSelfTestStepRollbackPurpose',
    'instanceSelfTestStepRollbackAction',
    'instanceSelfTestStepRollbackPass',
    'instanceSelfTestStepPostRollbackTitle',
    'instanceSelfTestStepPostRollbackPurpose',
    'instanceSelfTestStepPostRollbackAction',
    'instanceSelfTestStepPostRollbackPass',
    'instanceSelfTestStepBusinessTitle',
    'instanceSelfTestStepBusinessPurpose',
    'instanceSelfTestStepBusinessAction',
    'instanceSelfTestStepBusinessPass',
    'instanceSelfTestStepIsolationTitle',
    'instanceSelfTestStepIsolationPurpose',
    'instanceSelfTestStepIsolationAction',
    'instanceSelfTestStepIsolationPass',
    'instanceSelfTestStepCleanupTitle',
    'instanceSelfTestStepCleanupPurpose',
    'instanceSelfTestStepCleanupAction',
    'instanceSelfTestStepCleanupPass',
    'starterVerify',
    'starterVerificationTitle',
    'starterCliCreateTitle',
    'starterCliVerifyTitle',
    'frameworkVersionMapTitle',
    'frameworkVersionHonesty',
  ];

  for (const key of keys) {
    assert.ok(ui['zh-CN'][key], `missing zh-CN visual framework console key: ${key}`);
    assert.ok(ui.en[key], `missing en visual framework console key: ${key}`);
  }
});
