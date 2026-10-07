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
  const language = page.indexOf("['language-core', 'Language Core'");
  const protocol = page.indexOf("['protocol', 'Protocol'");
  const provider = page.indexOf("['provider-sdk', 'Provider SDK'");

  assert.ok(asset >= 0 && starter > asset && language > starter && protocol > language && provider > protocol);
  assert.match(page, /framework-package-badge/);
  assert.match(page, /frameworkPackageBadgeStart/);
  assert.match(page, /frameworkPackageBadgeLater/);
  assert.match(page, /frameworkPackageBadgeProvider/);
});

test('framework package cards use plain-language primary titles and technical names second', () => {
  assert.equal(ui['zh-CN'].frameworkPackagesEyebrow, '底层能力');
  assert.equal(ui['zh-CN'].frameworkPackagesTitle, '这 5 块分别负责什么');
  assert.equal(ui['zh-CN'].frameworkPackageAssetTitle, '项目知识结构');
  assert.equal(ui['zh-CN'].frameworkPackageStarterTitle, '项目知识初始化器');
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

test('Starter is presented honestly as current knowledge initialization, not a full instance generator', () => {
  assert.match(ui['zh-CN'].starterTitle, /初始化项目知识结构/);
  assert.match(ui['zh-CN'].starterLead, /不是 Spring Boot Starter/);
  assert.match(ui['zh-CN'].frameworkRoleInstanceBody, /还没有完整实例生成器/);
  assert.match(ui.en.frameworkRoleInstanceBody, /full instance generator does not exist yet/);
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

test('Instance / CLI UI is visual-first and honest about implemented vs planned capabilities', () => {
  const component = read('src/components/FrameworkLearningConsole.tsx');
  const learning = read('src/data/frameworkLearning.ts');

  assert.match(component, /assetClient\.config\(\)/);
  assert.match(component, /framework-instance-current/);
  assert.match(component, /onNavigate\('guide'\)/);
  assert.match(component, /frameworkInstanceCliPlanned/);
  assert.match(learning, /id: 'knowledge-init'/);
  assert.match(learning, /status: 'available'/);
  assert.match(learning, /id: 'instance-creator'/);
  assert.match(learning, /id: 'instance-manifest'/);
  assert.match(learning, /id: 'upgrade'/);
  assert.match(learning, /id: 'migration'/);
  assert.match(learning, /status: 'planned'/);
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
  assert.match(workbench, /creatorCapabilityKnowledge/);
  assert.match(workbench, /creatorCapabilityInstance/);
  assert.match(workbench, /status: 'planned'/);
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
  assert.match(framework, /asset-workbench creator instance create/);
  assert.match(framework, /frameworkInstanceCliPlanned/);
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
    'frameworkInstanceCliFuture',
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
