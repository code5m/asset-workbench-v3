import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BEGINNER_ROLE_NAMES,
  beginnerRootRole,
  getBeginnerDirectoryGuide,
} from '../src/data/beginnerDirectoryGuide.ts';

const read = (path: string): string => fs.readFileSync(path, 'utf8');

test('real directory explanations make knowledge and source paths distinct', () => {
  assert.equal(getBeginnerDirectoryGuide('01-code', 'framework-self')?.role, 'knowledge');
  assert.equal(getBeginnerDirectoryGuide('src', 'framework-self')?.role, 'program');
  assert.equal(getBeginnerDirectoryGuide('03-docs', 'framework-self')?.role, 'knowledge');
  assert.equal(getBeginnerDirectoryGuide('docs', 'framework-self')?.role, 'program');
  assert.equal(getBeginnerDirectoryGuide('01-code', 'framework-self')?.contrast?.path, 'src');
  assert.equal(getBeginnerDirectoryGuide('src', 'framework-self')?.contrast?.path, '01-code');
  assert.equal(getBeginnerDirectoryGuide('03-docs', 'framework-self')?.contrast?.path, 'docs');
  assert.equal(getBeginnerDirectoryGuide('docs', 'framework-self')?.contrast?.path, '03-docs');
});

test('beginner roles use human language and never invent numbering', () => {
  assert.equal(BEGINNER_ROLE_NAMES.knowledge['zh-CN'], '项目资料');
  assert.equal(BEGINNER_ROLE_NAMES.program['zh-CN'], '工作台程序');
  assert.equal(BEGINNER_ROLE_NAMES.tools['zh-CN'], '工具与设置');
  assert.equal(beginnerRootRole('00-introduction', 'framework-self'), 'knowledge');
  assert.equal(beginnerRootRole('server', 'framework-self'), 'program');
  assert.equal(beginnerRootRole('scripts', 'framework-self'), 'tools');
  assert.equal(beginnerRootRole('06-src', 'framework-self'), 'other');
  assert.equal(getBeginnerDirectoryGuide('06-src', 'framework-self'), undefined);
});

test('business project never receives Workbench-specific path explanations', () => {
  for (const path of ['src', 'server', '01-code', 'docs', '.github']) {
    assert.equal(getBeginnerDirectoryGuide(path, 'business-project'), undefined);
    assert.equal(beginnerRootRole(path, 'business-project'), 'other');
  }
  assert.equal(getBeginnerDirectoryGuide('src/components', 'framework-self'), undefined);
});

test('homepage lists only real root nodes and preserves direct paths', () => {
  const welcome = read('src/components/WelcomePage.tsx');
  const overview = read('src/components/RealDirectoryOverview.tsx');
  assert.match(welcome, /<RealDirectoryOverview onOpenAsset=\{onOpenAsset\}/);
  assert.match(overview, /assetClient\.tree\(''\)/);
  assert.match(overview, /entries\.map\(\(node\) =>/);
  assert.match(overview, /onOpenAsset\(node\.relativePath\)/);
  assert.match(overview, /setEntries\(tree\.children\)/);
  assert.match(overview, /setEntries\(null\)/);
  assert.doesNotMatch(overview, /fakeTree|sampleTree|virtualParent/);
});

test('Asset Space renders one flat true root tree with just-in-time explanations', () => {
  const explorer = read('src/components/AssetExplorer.tsx');
  const learning = read('src/components/DirectoryLearningPanel.tsx');
  assert.match(explorer, /rootChildren\.map\(\(node\) =>/);
  assert.doesNotMatch(explorer, /ROOT_TREE_GROUP_ORDER\.map/);
  assert.match(explorer, /mode=\{runtimeMode\}/);
  assert.match(explorer, /getBeginnerDirectoryGuide\(selected\.relativePath, runtimeMode\)/);
  assert.match(explorer, /<DirectoryLearningPanel/);
  assert.match(explorer, /onOpenPath=\{\(path\)/);
  assert.match(learning, /assetClient\.tree\(node\.relativePath\)/);
  assert.match(learning, /child\.relativePath === candidate/);
  assert.match(learning, /rootPaths\.includes\(guide\.contrast\.path\)/);
});

test('source annotations stay behind actual path and preserve existing access restrictions', () => {
  const overview = read('src/components/RealDirectoryOverview.tsx');
  const explorer = read('src/components/AssetExplorer.tsx');
  const agents = read('AGENTS.md');
  assert.match(overview, /getBeginnerDirectoryGuide\(node\.relativePath, mode\)/);
  assert.match(explorer, /assetClient\.tree\(node\.relativePath\)/);
  assert.doesNotMatch(explorer, /from 'node:fs'|from 'child_process'/);
  assert.match(agents, /一棵树，不是两棵树/);
  assert.match(agents, /项目资料 \/ 工作台程序 \/ 工具与设置/);
});
