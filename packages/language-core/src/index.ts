import type { CodeLanguage } from '../../protocol/src/asset.ts';

export interface LanguageDescriptor {
  id: Exclude<CodeLanguage, 'other'>;
  displayName: string;
  extensions: readonly string[];
  manifests: readonly string[];
  generatedDirectories: readonly string[];
}

export const LANGUAGE_DESCRIPTORS: readonly LanguageDescriptor[] = [
  {
    id: 'java',
    displayName: 'Java',
    extensions: ['java'],
    manifests: ['pom.xml', 'build.gradle', 'settings.gradle', 'gradle.properties'],
    generatedDirectories: ['target', '.gradle', '.settings'],
  },
  {
    id: 'javascript',
    displayName: 'JavaScript / Node.js',
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    manifests: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    generatedDirectories: ['node_modules', 'dist', 'coverage', '.next', '.nuxt', '.svelte-kit', 'out', '.turbo', '.output', '.parcel-cache'],
  },
  {
    id: 'typescript',
    displayName: 'TypeScript',
    extensions: ['ts', 'tsx'],
    manifests: ['tsconfig.json'],
    generatedDirectories: [],
  },
  {
    id: 'python',
    displayName: 'Python',
    extensions: ['py', 'pyi'],
    manifests: ['pyproject.toml', 'requirements.txt', 'poetry.lock'],
    generatedDirectories: ['__pycache__', '.venv', 'venv', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox', '.nox'],
  },
  {
    id: 'rust',
    displayName: 'Rust',
    extensions: ['rs'],
    manifests: ['cargo.toml', 'cargo.lock'],
    generatedDirectories: ['target'],
  },
] as const;

export const GENERIC_CODE_EXTENSIONS = new Set([
  'go', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'rb', 'php', 'kt', 'kts', 'swift',
  'scala', 'sh', 'bash', 'zsh', 'sql', 'xml', 'yaml', 'yml', 'toml', 'json',
  'jsonc', 'properties', 'ini', 'cfg', 'conf', 'html', 'htm', 'css', 'scss',
  'less', 'vue', 'svelte', 'gradle', 'pl', 'pm', 'r', 'm', 'mm', 'dart', 'zig',
  'lua', 'ex', 'exs', 'erl', 'hs', 'clj', 'groovy', 'tf', 'bzl', 'mk',
]);

export const LANGUAGE_CODE_EXTENSIONS = new Set(
  LANGUAGE_DESCRIPTORS.flatMap((language) => [...language.extensions]),
);

export const LANGUAGE_GENERATED_DIRS = new Set(
  LANGUAGE_DESCRIPTORS.flatMap((language) => [...language.generatedDirectories]),
);

function basename(rel: string): string {
  const normalized = rel.replaceAll('\\', '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
}

function extension(rel: string): string {
  const name = basename(rel);
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1) : '';
}

export function detectCodeLanguage(rel: string): CodeLanguage | undefined {
  const base = basename(rel);
  for (const language of LANGUAGE_DESCRIPTORS) {
    if (language.manifests.includes(base)) return language.id;
  }
  const ext = extension(rel);
  for (const language of LANGUAGE_DESCRIPTORS) {
    if (language.extensions.includes(ext)) return language.id;
  }
  if (GENERIC_CODE_EXTENSIONS.has(ext)) return 'other';
  return undefined;
}

export function isRecognizedCodeExtension(ext: string): boolean {
  const normalized = ext.toLowerCase();
  return LANGUAGE_CODE_EXTENSIONS.has(normalized) || GENERIC_CODE_EXTENSIONS.has(normalized);
}
