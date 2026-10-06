export type RootTreeGroup = 'tooling' | 'skeleton' | 'project';

export interface RootTreePresentation {
  group: RootTreeGroup;
  purposeKey?: string;
}

const SKELETON_PURPOSE: Record<string, string> = {
  '00-introduction': 'rootPurposeIntroduction',
  '01-code': 'rootPurposeCode',
  '02-design': 'rootPurposeDesign',
  '03-docs': 'rootPurposeDocs',
  '04-conversations': 'rootPurposeConversations',
  '05-derived': 'rootPurposeDerived',
};

const TOOLING_PURPOSE: Record<string, string> = {
  '.codex': 'rootPurposeCodex',
  '.codebuddy': 'rootPurposeCodebuddy',
  '.opencode': 'rootPurposeOpencode',
  '.trae': 'rootPurposeTrae',
  '.github': 'rootPurposeGithub',
  '.codeartsdoer': 'rootPurposeCodeartsdoer',
  '.bevel': 'rootPurposeLocalTool',
};

export function rootTreePresentation(name: string): RootTreePresentation {
  if (name in SKELETON_PURPOSE) {
    return { group: 'skeleton', purposeKey: SKELETON_PURPOSE[name] };
  }
  if (name.startsWith('.')) {
    return { group: 'tooling', purposeKey: TOOLING_PURPOSE[name] ?? 'rootPurposeHiddenTool' };
  }
  return { group: 'project' };
}

export const ROOT_TREE_GROUP_ORDER: RootTreeGroup[] = ['tooling', 'skeleton', 'project'];

export function rootTreeGroupKey(group: RootTreeGroup): string {
  if (group === 'tooling') return 'rootGroupTooling';
  if (group === 'skeleton') return 'rootGroupSkeleton';
  return 'rootGroupProject';
}

export function rootTreeGroupHintKey(group: RootTreeGroup): string {
  if (group === 'tooling') return 'rootGroupToolingHint';
  if (group === 'skeleton') return 'rootGroupSkeletonHint';
  return 'rootGroupProjectHint';
}
