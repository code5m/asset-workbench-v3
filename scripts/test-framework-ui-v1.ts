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

test('Starter UI crosses the Local API boundary instead of writing files in React', () => {
  const starter = read('src/components/StarterCreator.tsx');
  const client = read('src/services/assetClient.ts');
  const server = read('server/assetPlugin.ts');
  assert.doesNotMatch(starter, /node:fs|writeFileSync|mkdirSync/);
  assert.match(starter, /assetClient\.createStarter/);
  assert.match(client, /\/starter\/create/);
  assert.match(server, /pathPart === '\/starter\/create'/);
  assert.match(server, /createStarter\(\{ target, name \}\)/);
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
  assert.match(page, /BEGINNER_LEARNING_ORDER/);
  assert.match(page, /frameworkLearningTitle/);
  assert.match(page, /frameworkScopeKnowTitle/);
  assert.match(page, /frameworkScopeSkipTitle/);
});

test('beginner learning order starts with assets and leaves Provider SDK last', () => {
  const page = read('src/components/FrameworkPage.tsx');
  const asset = page.indexOf("['asset-core', 'frameworkLearnAssetTitle'");
  const starter = page.indexOf("['starter', 'frameworkLearnStarterTitle'");
  const language = page.indexOf("['language-core', 'frameworkLearnLanguageTitle'");
  const protocol = page.indexOf("['protocol', 'frameworkLearnProtocolTitle'");
  const provider = page.indexOf("['provider-sdk', 'frameworkLearnProviderTitle'");

  assert.ok(asset >= 0 && starter > asset && language > starter && protocol > language && provider > protocol);
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
  assert.equal(ui['zh-CN'].frameworkPackageStarterTitle, '新项目生成器');
  assert.equal(ui['zh-CN'].frameworkPackageLanguageTitle, '项目语言识别');
  assert.equal(ui['zh-CN'].frameworkPackageProtocolTitle, '统一数据规则');
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
  assert.match(ui['zh-CN'].starterLead, /Starter 按 Asset Core 定义/);
  assert.match(ui.en.frameworkPackageAssetBody, /current Workbench already uses/);
  assert.match(ui.en.starterLead, /Starter creates a new project from the Asset Core standard/);
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
