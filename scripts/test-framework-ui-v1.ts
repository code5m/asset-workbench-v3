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
  assert.match(explorer, /onLearnMore\(learnMoreFocus\)/);
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
  assert.match(ui['zh-CN'].rootPurposeAppSource, /页面和客户端代码/);
  assert.match(ui['zh-CN'].rootPurposeAppServer, /本地运行的后台服务/);
});
