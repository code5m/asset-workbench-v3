import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT_TREE_GROUP_ORDER,
  assetTreePurposeKey,
  nestedTreeEntryHelp,
  rootTreeGroupHintKey,
  rootTreeGroupKey,
  rootTreePresentation,
} from '../src/domain/rootTreePresentation.ts';

test('root visual IA mirrors architecture roles without inventing filesystem hierarchy', () => {
  assert.deepEqual(ROOT_TREE_GROUP_ORDER, [
    'tooling',
    'skeleton',
    'framework',
    'application',
    'project',
  ]);

  assert.deepEqual(rootTreePresentation('.codex'), {
    group: 'tooling',
    purposeKey: 'rootPurposeCodex',
  });
  assert.deepEqual(rootTreePresentation('.github'), {
    group: 'tooling',
    purposeKey: 'rootPurposeGithub',
  });
  assert.deepEqual(rootTreePresentation('.unknown-tool'), {
    group: 'tooling',
    purposeKey: 'rootPurposeHiddenTool',
  });

  assert.deepEqual(rootTreePresentation('00-introduction'), {
    group: 'skeleton',
    purposeKey: 'rootPurposeIntroduction',
  });
  assert.deepEqual(rootTreePresentation('04-conversations'), {
    group: 'skeleton',
    purposeKey: 'rootPurposeConversations',
  });

  assert.deepEqual(rootTreePresentation('packages'), {
    group: 'framework',
    purposeKey: 'rootPurposeFrameworkPackages',
    learnMoreFocus: 'packages',
  });
  assert.deepEqual(rootTreePresentation('providers'), {
    group: 'framework',
    purposeKey: 'rootPurposeFrameworkProviders',
    learnMoreFocus: 'providers',
  });

  assert.deepEqual(rootTreePresentation('src'), {
    group: 'application',
    purposeKey: 'rootPurposeAppSource',
    learnMoreFocus: 'architecture',
  });
  assert.deepEqual(rootTreePresentation('server'), {
    group: 'application',
    purposeKey: 'rootPurposeAppServer',
    learnMoreFocus: 'architecture',
  });
  assert.deepEqual(rootTreePresentation('scripts'), {
    group: 'application',
    purposeKey: 'rootPurposeAppScripts',
    learnMoreFocus: 'architecture',
  });

  assert.deepEqual(rootTreePresentation('docs'), {
    group: 'project',
    purposeKey: 'rootPurposeProjectDocs',
  });
  assert.deepEqual(rootTreePresentation('package.json'), {
    group: 'project',
    purposeKey: 'rootPurposePackageManifest',
  });
  assert.deepEqual(rootTreePresentation('some-other-root'), { group: 'project', purposeKey: undefined });

  assert.equal(rootTreeGroupKey('tooling'), 'rootGroupTooling');
  assert.equal(rootTreeGroupKey('skeleton'), 'rootGroupSkeleton');
  assert.equal(rootTreeGroupKey('framework'), 'rootGroupFramework');
  assert.equal(rootTreeGroupKey('application'), 'rootGroupApplication');
  assert.equal(rootTreeGroupKey('project'), 'rootGroupProject');

  assert.equal(rootTreeGroupHintKey('tooling'), 'rootGroupToolingHint');
  assert.equal(rootTreeGroupHintKey('framework'), 'rootGroupFrameworkHint');
  assert.equal(rootTreeGroupHintKey('application'), 'rootGroupApplicationHint');
});

test('presentation metadata never invents a virtual path or virtual children', () => {
  const names = [
    '.codex',
    '.codebuddy',
    '.opencode',
    '.trae',
    '.github',
    '00-introduction',
    '01-code',
    'packages',
    'providers',
    'src',
    'server',
    'scripts',
    'docs',
    'README.md',
  ];
  const allowedGroups = ['tooling', 'skeleton', 'framework', 'application', 'project'];

  for (const name of names) {
    const presentation = rootTreePresentation(name);
    assert.ok(allowedGroups.includes(presentation.group));
    assert.equal('path' in presentation, false);
    assert.equal('children' in presentation, false);
    assert.equal('virtualParent' in presentation, false);
  }
});


test('first-level architecture help explains framework and frontend while keeping server tree selective', () => {
  assert.deepEqual(nestedTreeEntryHelp('packages/asset-core'), {
    purposeKey: 'treeHelpPackageAssetCore',
    showInTree: true,
    learnMoreFocus: 'packages',
  });
  assert.deepEqual(nestedTreeEntryHelp('src/components'), {
    purposeKey: 'treeHelpSrcComponents',
    showInTree: true,
    learnMoreFocus: 'architecture',
  });
  assert.deepEqual(nestedTreeEntryHelp('providers/examples'), {
    purposeKey: 'treeHelpProviderExamples',
    showInTree: true,
    learnMoreFocus: 'providers',
  });

  assert.equal(nestedTreeEntryHelp('server/assetPlugin.ts')?.showInTree, true);
  assert.equal(nestedTreeEntryHelp('server/captureService.ts')?.showInTree, true);
  assert.equal(nestedTreeEntryHelp('server/providerPlatformService.ts')?.showInTree, true);

  assert.equal(nestedTreeEntryHelp('server/assetScanner.ts')?.showInTree, false);
  assert.equal(nestedTreeEntryHelp('server/durableWrite.ts')?.showInTree, false);
  assert.equal(assetTreePurposeKey('server/assetScanner.ts'), 'treeHelpServerAssetScanner');
  assert.equal(assetTreePurposeKey('server/durableWrite.ts'), 'treeHelpServerDurableWrite');

  assert.equal(nestedTreeEntryHelp('packages/protocol/src'), undefined);
  assert.equal(nestedTreeEntryHelp('src/components/AssetExplorer.tsx'), undefined);
});
