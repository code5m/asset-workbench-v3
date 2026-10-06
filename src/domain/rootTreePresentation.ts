export type RootTreeGroup =
  | 'tooling'
  | 'skeleton'
  | 'framework'
  | 'application'
  | 'project';

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

const FRAMEWORK_PURPOSE: Record<string, string> = {
  packages: 'rootPurposeFrameworkPackages',
  providers: 'rootPurposeFrameworkProviders',
};

const APPLICATION_PURPOSE: Record<string, string> = {
  src: 'rootPurposeAppSource',
  server: 'rootPurposeAppServer',
  scripts: 'rootPurposeAppScripts',
};

const PROJECT_PURPOSE: Record<string, string> = {
  docs: 'rootPurposeProjectDocs',
  'README.md': 'rootPurposeReadme',
  'AGENTS.md': 'rootPurposeAgents',
  'CONTRIBUTING.md': 'rootPurposeContributing',
  'SECURITY.md': 'rootPurposeSecurity',
  'package.json': 'rootPurposePackageManifest',
  'package-lock.json': 'rootPurposePackageLock',
  'tsconfig.json': 'rootPurposeTypeScriptConfig',
  'tsconfig.app.json': 'rootPurposeTypeScriptConfig',
  'tsconfig.node.json': 'rootPurposeTypeScriptConfig',
  'vite.config.ts': 'rootPurposeBuildConfig',
  'index.html': 'rootPurposeWebEntry',
};

export function rootTreePresentation(name: string): RootTreePresentation {
  if (name in SKELETON_PURPOSE) {
    return { group: 'skeleton', purposeKey: SKELETON_PURPOSE[name] };
  }
  if (name in FRAMEWORK_PURPOSE) {
    return { group: 'framework', purposeKey: FRAMEWORK_PURPOSE[name] };
  }
  if (name in APPLICATION_PURPOSE) {
    return { group: 'application', purposeKey: APPLICATION_PURPOSE[name] };
  }
  if (name.startsWith('.')) {
    return { group: 'tooling', purposeKey: TOOLING_PURPOSE[name] ?? 'rootPurposeHiddenTool' };
  }
  return { group: 'project', purposeKey: PROJECT_PURPOSE[name] };
}

export const ROOT_TREE_GROUP_ORDER: RootTreeGroup[] = [
  'tooling',
  'skeleton',
  'framework',
  'application',
  'project',
];

export function rootTreeGroupKey(group: RootTreeGroup): string {
  if (group === 'tooling') return 'rootGroupTooling';
  if (group === 'skeleton') return 'rootGroupSkeleton';
  if (group === 'framework') return 'rootGroupFramework';
  if (group === 'application') return 'rootGroupApplication';
  return 'rootGroupProject';
}

export function rootTreeGroupHintKey(group: RootTreeGroup): string {
  if (group === 'tooling') return 'rootGroupToolingHint';
  if (group === 'skeleton') return 'rootGroupSkeletonHint';
  if (group === 'framework') return 'rootGroupFrameworkHint';
  if (group === 'application') return 'rootGroupApplicationHint';
  return 'rootGroupProjectHint';
}
