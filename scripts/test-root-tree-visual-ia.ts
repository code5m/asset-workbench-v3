import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT_TREE_GROUP_ORDER,
  rootTreeGroupHintKey,
  rootTreeGroupKey,
  rootTreePresentation,
} from '../src/domain/rootTreePresentation.ts';

test('root visual IA preserves real filesystem names and classifies only presentation', () => {
  assert.deepEqual(ROOT_TREE_GROUP_ORDER, ['tooling', 'skeleton', 'project']);

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

  assert.deepEqual(rootTreePresentation('package.json'), { group: 'project' });
  assert.deepEqual(rootTreePresentation('src'), { group: 'project' });

  assert.equal(rootTreeGroupKey('tooling'), 'rootGroupTooling');
  assert.equal(rootTreeGroupKey('skeleton'), 'rootGroupSkeleton');
  assert.equal(rootTreeGroupKey('project'), 'rootGroupProject');
  assert.equal(rootTreeGroupHintKey('tooling'), 'rootGroupToolingHint');
});

test('presentation never invents a virtual path', () => {
  const names = ['.codex', '.codebuddy', '.opencode', '.trae', '.github', '00-introduction', '01-code', 'src'];
  for (const name of names) {
    const presentation = rootTreePresentation(name);
    assert.ok(['tooling', 'skeleton', 'project'].includes(presentation.group));
    assert.equal('path' in presentation, false);
    assert.equal('children' in presentation, false);
  }
});
