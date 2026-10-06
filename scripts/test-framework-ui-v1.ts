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
