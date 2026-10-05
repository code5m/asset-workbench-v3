import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { scanDirectory } from '../server/assetScanner.ts';
import { AssetWatcher, MAX_WATCHED_DIRECTORIES } from '../server/assetWatcher.ts';
import { isIgnoredRelativePath } from '../server/ignorePolicy.ts';
import { assetClient } from '../src/services/assetClient.ts';
import { ui } from '../src/i18n/translations.ts';

function tempRoot(prefix = 'awb-audit-v3-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('lazy scan does not precompute grandchildren counts', () => {
  const root = tempRoot();
  try {
    fs.mkdirSync(path.join(root, 'src', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'deep', 'x.ts'), 'export const x = 1;');
    const result = scanDirectory(root, '');
    const src = result.children.find((node) => node.name === 'src');
    assert.ok(src);
    assert.equal(src!.kind, 'directory');
    assert.equal(src!.childCount, undefined);
    assert.equal(src!.fileCount, undefined);

    const opened = scanDirectory(root, 'src');
    assert.equal(opened.parent.childCount, 1);
    assert.equal(opened.parent.fileCount, 0);
    assert.equal(opened.children[0]?.name, 'deep');
    assert.equal(opened.children[0]?.childCount, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ignore policy is project-relative, not polluted by parent directory names', () => {
  assert.equal(isIgnoredRelativePath(''), false);
  assert.equal(isIgnoredRelativePath('src/main'), false);
  assert.equal(isIgnoredRelativePath('target/classes'), true);
  assert.equal(isIgnoredRelativePath('build/generated'), true);
  assert.equal(isIgnoredRelativePath('python/.venv/lib'), true);
});

test('watchers stay bounded after browsing many directories', async () => {
  const outer = tempRoot('awb-parent-build-');
  const root = path.join(outer, 'build', 'project');
  fs.mkdirSync(root, { recursive: true });
  for (let i = 0; i < 140; i += 1) fs.mkdirSync(path.join(root, `d${i}`));

  const watcher = new AssetWatcher(root, () => undefined);
  try {
    watcher.start();
    assert.equal(watcher.watchedDirectoryCount, 1, 'root remains watchable even when an ancestor is named build');
    for (let i = 0; i < 140; i += 1) watcher.watchDirectory(`d${i}`);
    assert.ok(watcher.watchedDirectoryCount <= MAX_WATCHED_DIRECTORIES);
    assert.ok(watcher.watchedDirectoryCount >= 1);
  } finally {
    watcher.stop();
    fs.rmSync(outer, { recursive: true, force: true });
  }
});

test('provider client cache is invalidated after switching project root', async () => {
  const originalFetch = globalThis.fetch;
  let providerReads = 0;
  let rootWrites = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith('/api/provider-manager/redetect')) {
      providerReads += 1;
      return new Response(JSON.stringify({ providers: [], detectedAt: '2026-10-06T00:00:00.000Z' }), { status: 200 });
    }
    if (url.endsWith('/api/providers')) {
      providerReads += 1;
      return new Response(JSON.stringify({ providers: [], detectedAt: '2026-10-06T00:01:00.000Z' }), { status: 200 });
    }
    if (url.endsWith('/api/workspace/root') && init?.method === 'POST') {
      rootWrites += 1;
      return new Response(JSON.stringify({ projectRoot: '/tmp/next', scannedAt: 'x', nodeCount: 0, fileCount: 0, directoryCount: 0 }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    await assetClient.providerOverview(true);
    await assetClient.providerOverview(false);
    assert.equal(providerReads, 1, 'second overview is served from cache');

    await assetClient.setRoot('/tmp/next');
    assert.equal(rootWrites, 1);
    await assetClient.providerOverview(false);
    assert.equal(providerReads, 2, 'root switch invalidates the provider cache');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider client cache is invalidated after provider mutation', async () => {
  const originalFetch = globalThis.fetch;
  let providerReads = 0;
  let actions = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith('/api/provider-manager/redetect') || url.endsWith('/api/providers')) {
      providerReads += 1;
      return new Response(JSON.stringify({ providers: [], detectedAt: new Date().toISOString() }), { status: 200 });
    }
    if (url.includes('/api/provider-manager/providers/codex/disable') && init?.method === 'POST') {
      actions += 1;
      return new Response(JSON.stringify({ detail: 'ok' }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    await assetClient.providerOverview(true);
    await assetClient.providerOverview(false);
    assert.equal(providerReads, 1);
    await assetClient.providerAction('codex', 'disable');
    assert.equal(actions, 1);
    await assetClient.providerOverview(false);
    assert.equal(providerReads, 2, 'provider mutation invalidates overview cache');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('zh-CN and en UI dictionaries have identical key coverage', () => {
  const zh = Object.keys(ui['zh-CN']).sort();
  const en = Object.keys(ui.en).sort();
  assert.deepEqual(en, zh);
});
