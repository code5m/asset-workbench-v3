import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  BUILTIN_PROVIDER_DEFINITIONS,
  defineProvider,
  validateProviderDefinition,
} from '../packages/provider-sdk/src/index.ts';
import {
  LANGUAGE_DESCRIPTORS,
  detectCodeLanguage,
  LANGUAGE_GENERATED_DIRS,
} from '../packages/language-core/src/index.ts';
import { DEFAULT_ASSET_SKELETON } from '../packages/asset-core/src/index.ts';
import { createStarter } from '../packages/starter/src/index.ts';
import type {
  CanonicalCaptureEvent,
  ProviderDefinition,
} from '../packages/protocol/src/index.ts';

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

test('framework exports stable Provider definitions through SDK', () => {
  assert.deepEqual(
    BUILTIN_PROVIDER_DEFINITIONS.map((provider) => provider.id),
    ['codex', 'codebuddy', 'opencode', 'trae', 'codearts', 'chatgpt', 'workbuddy'],
  );
  for (const provider of BUILTIN_PROVIDER_DEFINITIONS) {
    assert.equal(validateProviderDefinition(provider, { allowExecutableCommands: true }), provider);
  }
});

test('custom Provider SDK rejects executable command injection', () => {
  const unsafe = {
    schemaVersion: 1,
    version: '1.0.0',
    id: 'unsafe-provider',
    displayName: 'Unsafe',
    description: 'unsafe',
    providerType: 'custom',
    discovery: { versionCommand: ['sh', '-c', 'echo nope'] },
    auth: { type: 'external' },
    eventSource: { type: 'custom' },
    events: {},
    finalization: { strategy: 'manual' },
    verification: { required: [], requireTranscript: false },
  } satisfies ProviderDefinition;

  assert.throws(
    () => validateProviderDefinition(unsafe, { allowExecutableCommands: false }),
    /cannot contain executable commands/,
  );
});

test('Provider SDK accepts declarative third-party definition', () => {
  const provider = defineProvider({
    schemaVersion: 1,
    version: '1.0.0',
    id: 'sample-agent',
    displayName: 'Sample Agent',
    description: 'sample',
    providerType: 'coding-agent',
    discovery: { configPaths: ['.sample/hooks.json'] },
    auth: { type: 'external' },
    eventSource: { type: 'hooks', projectConfigPath: '.sample/hooks.json' },
    events: { Stop: { canonical: 'assistant.message' } },
    finalization: { strategy: 'explicit-event', event: 'SessionEnd' },
    verification: { required: ['assistant.message'], requireTranscript: true },
  }, { allowExecutableCommands: false });
  assert.equal(provider.id, 'sample-agent');
});

test('language core is first-class for Java JS/Node TS Python Rust', () => {
  assert.deepEqual(
    LANGUAGE_DESCRIPTORS.map((language) => language.id),
    ['java', 'javascript', 'typescript', 'python', 'rust'],
  );
  assert.equal(detectCodeLanguage('src/Main.java'), 'java');
  assert.equal(detectCodeLanguage('package.json'), 'javascript');
  assert.equal(detectCodeLanguage('src/app.tsx'), 'typescript');
  assert.equal(detectCodeLanguage('service/main.py'), 'python');
  assert.equal(detectCodeLanguage('src/lib.rs'), 'rust');
  assert.ok(LANGUAGE_GENERATED_DIRS.has('node_modules'));
  assert.ok(LANGUAGE_GENERATED_DIRS.has('.venv'));
  assert.ok(LANGUAGE_GENERATED_DIRS.has('target'));
});

test('starter creates the canonical real 00-05 skeleton', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-starter-parent-'));
  const project = path.join(target, 'demo');
  try {
    const result = createStarter({ target: project, name: 'demo' });
    assert.ok(result.created.includes('README.md'));
    assert.ok(result.created.includes('AGENTS.md'));
    for (const entry of DEFAULT_ASSET_SKELETON) {
      assert.ok(fs.statSync(path.join(project, entry.path)).isDirectory());
      assert.ok(fs.statSync(path.join(project, entry.path, 'README.md')).isFile());
    }
    assert.ok(fs.statSync(path.join(project, '04-conversations', 'transcripts')).isDirectory());
    assert.ok(fs.statSync(path.join(project, '04-conversations', 'work-records')).isDirectory());
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('protocol contract can describe a canonical cross-language event', () => {
  const event: CanonicalCaptureEvent = {
    schemaVersion: 1,
    eventId: 'example:1',
    provider: 'other',
    providerSessionId: 'session-1',
    captureSessionId: 'capture-1',
    workspaceId: 'workspace-1',
    eventType: 'user.message',
    timestamp: new Date(0).toISOString(),
    actor: 'user',
    content: 'hello',
    captureSource: 'provider-api',
  };
  assert.equal(event.eventType, 'user.message');
});


test('Asset Core is the single source of truth for the 00-05 knowledge structure', () => {
  const starter = read('packages/starter/src/index.ts');
  const server = read('server/assetService.ts');
  const frameworkUi = read('src/components/FrameworkPage.tsx');

  assert.match(starter, /DEFAULT_ASSET_SKELETON/);
  assert.match(server, /DEFAULT_ASSET_SKELETON/);
  assert.match(frameworkUi, /DEFAULT_ASSET_SKELETON/);
  assert.doesNotMatch(server, /const EXPECTED_SKELETON/);

  assert.deepEqual(
    DEFAULT_ASSET_SKELETON.map((entry) => entry.path),
    ['00-introduction', '01-code', '02-design', '03-docs', '04-conversations', '05-derived'],
  );
});
