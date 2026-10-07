export type RootTreeGroup =
  | 'tooling'
  | 'skeleton'
  | 'framework'
  | 'application'
  | 'project';

export interface RootTreePresentation {
  group: RootTreeGroup;
  purposeKey?: string;
  learnMoreFocus?: 'architecture' | 'packages' | 'providers';
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
    return {
      group: 'framework',
      purposeKey: FRAMEWORK_PURPOSE[name],
      learnMoreFocus: name === 'providers' ? 'providers' : 'packages',
    };
  }
  if (name in APPLICATION_PURPOSE) {
    return {
      group: 'application',
      purposeKey: APPLICATION_PURPOSE[name],
      learnMoreFocus: 'architecture',
    };
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


export interface TreeEntryHelp {
  purposeKey: string;
  showInTree: boolean;
  learnMoreFocus?: 'architecture' | 'packages' | 'providers';
}

const NESTED_ENTRY_HELP: Record<string, TreeEntryHelp> = {
  'packages/asset-core': {
    purposeKey: 'treeHelpPackageAssetCore',
    showInTree: true,
    learnMoreFocus: 'packages',
  },
  'packages/language-core': {
    purposeKey: 'treeHelpPackageLanguageCore',
    showInTree: true,
    learnMoreFocus: 'packages',
  },
  'packages/protocol': {
    purposeKey: 'treeHelpPackageProtocol',
    showInTree: true,
    learnMoreFocus: 'packages',
  },
  'packages/provider-sdk': {
    purposeKey: 'treeHelpPackageProviderSdk',
    showInTree: true,
    learnMoreFocus: 'packages',
  },
  'packages/starter': {
    purposeKey: 'treeHelpPackageStarter',
    showInTree: true,
    learnMoreFocus: 'packages',
  },
  'providers/examples': {
    purposeKey: 'treeHelpProviderExamples',
    showInTree: true,
    learnMoreFocus: 'providers',
  },

  'src/components': { purposeKey: 'treeHelpSrcComponents', showInTree: true, learnMoreFocus: 'architecture' },
  'src/data': { purposeKey: 'treeHelpSrcData', showInTree: true, learnMoreFocus: 'architecture' },
  'src/domain': { purposeKey: 'treeHelpSrcDomain', showInTree: true, learnMoreFocus: 'architecture' },
  'src/i18n': { purposeKey: 'treeHelpSrcI18n', showInTree: true, learnMoreFocus: 'architecture' },
  'src/services': { purposeKey: 'treeHelpSrcServices', showInTree: true, learnMoreFocus: 'architecture' },
  'src/App.tsx': { purposeKey: 'treeHelpSrcApp', showInTree: false, learnMoreFocus: 'architecture' },
  'src/main.tsx': { purposeKey: 'treeHelpSrcMain', showInTree: false, learnMoreFocus: 'architecture' },
  'src/styles.css': { purposeKey: 'treeHelpSrcStyles', showInTree: false, learnMoreFocus: 'architecture' },

  'server/transcript': { purposeKey: 'treeHelpServerTranscript', showInTree: true, learnMoreFocus: 'architecture' },
  'server/assetPlugin.ts': { purposeKey: 'treeHelpServerAssetPlugin', showInTree: true, learnMoreFocus: 'architecture' },
  'server/assetService.ts': { purposeKey: 'treeHelpServerAssetService', showInTree: true, learnMoreFocus: 'architecture' },
  'server/captureService.ts': { purposeKey: 'treeHelpServerCaptureService', showInTree: true, learnMoreFocus: 'architecture' },
  'server/providerPlatformService.ts': { purposeKey: 'treeHelpServerProviderPlatform', showInTree: true, learnMoreFocus: 'architecture' },
  'server/providerAdapterService.ts': { purposeKey: 'treeHelpServerProviderAdapter', showInTree: true, learnMoreFocus: 'architecture' },
  'server/managedAssetService.ts': { purposeKey: 'treeHelpServerManagedAsset', showInTree: true, learnMoreFocus: 'architecture' },
  'server/credentialStore.ts': { purposeKey: 'treeHelpServerCredentialStore', showInTree: true, learnMoreFocus: 'architecture' },
  'server/pathGuard.ts': { purposeKey: 'treeHelpServerPathGuard', showInTree: true, learnMoreFocus: 'architecture' },

  'server/agentSessionService.ts': { purposeKey: 'treeHelpServerAgentSession', showInTree: false, learnMoreFocus: 'architecture' },
  'server/assetClassifier.ts': { purposeKey: 'treeHelpServerAssetClassifier', showInTree: false, learnMoreFocus: 'architecture' },
  'server/assetScanner.ts': { purposeKey: 'treeHelpServerAssetScanner', showInTree: false, learnMoreFocus: 'architecture' },
  'server/assetWatcher.ts': { purposeKey: 'treeHelpServerAssetWatcher', showInTree: false, learnMoreFocus: 'architecture' },
  'server/config.ts': { purposeKey: 'treeHelpServerConfig', showInTree: false, learnMoreFocus: 'architecture' },
  'server/conversationIaMigration.ts': { purposeKey: 'treeHelpServerConversationMigration', showInTree: false, learnMoreFocus: 'architecture' },
  'server/durableWrite.ts': { purposeKey: 'treeHelpServerDurableWrite', showInTree: false, learnMoreFocus: 'architecture' },
  'server/fileReader.ts': { purposeKey: 'treeHelpServerFileReader', showInTree: false, learnMoreFocus: 'architecture' },
  'server/gitProbe.ts': { purposeKey: 'treeHelpServerGitProbe', showInTree: false, learnMoreFocus: 'architecture' },
  'server/ignorePolicy.ts': { purposeKey: 'treeHelpServerIgnorePolicy', showInTree: false, learnMoreFocus: 'architecture' },
  'server/knowledgeCaptureService.ts': { purposeKey: 'treeHelpServerKnowledgeCapture', showInTree: false, learnMoreFocus: 'architecture' },
  'server/localApiSecurity.ts': { purposeKey: 'treeHelpServerLocalApiSecurity', showInTree: false, learnMoreFocus: 'architecture' },
  'server/managedPathPolicy.ts': { purposeKey: 'treeHelpServerManagedPathPolicy', showInTree: false, learnMoreFocus: 'architecture' },
  'server/providerRuntimeState.ts': { purposeKey: 'treeHelpServerProviderRuntimeState', showInTree: false, learnMoreFocus: 'architecture' },
  'server/providerSnapshot.ts': { purposeKey: 'treeHelpServerProviderSnapshot', showInTree: false, learnMoreFocus: 'architecture' },
  'server/transcript/transcriptSource.ts': { purposeKey: 'treeHelpServerTranscriptSource', showInTree: false, learnMoreFocus: 'architecture' },
};

export function nestedTreeEntryHelp(relativePath: string): TreeEntryHelp | undefined {
  return NESTED_ENTRY_HELP[relativePath];
}

export function assetTreePurposeKey(relativePath: string): string | undefined {
  if (!relativePath.includes('/')) return rootTreePresentation(relativePath).purposeKey;
  return nestedTreeEntryHelp(relativePath)?.purposeKey;
}
