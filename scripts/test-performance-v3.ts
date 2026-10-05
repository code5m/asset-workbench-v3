import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanDirectory } from '../server/assetScanner.ts';
import { AssetService } from '../server/assetService.ts';
import { readAssetContent, TEXT_PREVIEW_LIMIT } from '../server/fileReader.ts';
import { detectCodeLanguage } from '../server/assetClassifier.ts';
import { getProjectRoot, setProjectRoot } from '../server/config.ts';
import { getProviderSnapshot, providerSnapshotTtlMs } from '../server/providerSnapshot.ts';

const originalRoot = getProjectRoot();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'awb-perf-v3-'));

function write(rel: string, content: string) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

test.before(() => {
  write('java/pom.xml', '<project/>');
  write('java/src/main/java/App.java', 'class App {}');
  write('web/package.json', '{"name":"x"}');
  write('web/src/app.ts', 'export const x = 1');
  write('web/src/legacy.js', 'module.exports = 1');
  write('python/pyproject.toml', '[project]\nname="x"');
  write('python/src/main.py', 'print("x")');
  write('rust/Cargo.toml', '[package]\nname="x"');
  write('rust/src/lib.rs', 'pub fn x() {}');
  write('node_modules/huge/index.js', 'ignored');
  write('java/target/classes/A.class', 'ignored');
  write('python/__pycache__/main.pyc', 'ignored');
  write('java/.gradle/cache.bin', 'ignored');
  write('large.log', 'x'.repeat(TEXT_PREVIEW_LIMIT + 80_000));
  for (let i = 0; i < 120; i += 1) fs.mkdirSync(path.join(root, `dirs/d${i}`), { recursive: true });
  setProjectRoot(root);
});

test.after(() => {
  setProjectRoot(originalRoot);
  fs.rmSync(root, { recursive: true, force: true });
});

test('root scan is one level only and excludes generated ecosystems', () => {
  const scan = scanDirectory(root, '');
  const names = scan.children.map((node) => node.name);
  assert.ok(names.includes('java'));
  assert.ok(names.includes('web'));
  assert.ok(names.includes('python'));
  assert.ok(names.includes('rust'));
  assert.equal(names.includes('node_modules'), false);
  assert.ok(scan.children.every((node) => node.children === undefined), 'wire nodes remain shallow');
});

test('nested directories load only when explicitly requested', () => {
  const rootScan = scanDirectory(root, '');
  assert.equal(rootScan.children.some((node) => node.relativePath.endsWith('App.java')), false);
  const java = scanDirectory(root, 'java');
  assert.ok(java.children.some((node) => node.name === 'pom.xml'));
  const src = scanDirectory(root, 'java/src/main/java');
  assert.ok(src.children.some((node) => node.name === 'App.java'));
});

test('bounded AssetService cache never grows with the whole project', async () => {
  const service = new AssetService();
  await service.ensureScanned();
  for (let i = 0; i < 120; i += 1) service.getTree(`dirs/d${i}`);
  const rootTree = service.getTree('');
  assert.ok((rootTree.cachedDirectoryCount ?? 0) <= 96);
  assert.equal(rootTree.statsScope, 'loaded');
  assert.ok(rootTree.children.every((node) => node.children === undefined));
});

test('large text preview reads only the bounded prefix', () => {
  const preview = readAssetContent(root, 'large.log');
  assert.equal(preview.previewable, true);
  assert.equal(preview.truncated, true);
  assert.ok((preview.content?.length ?? 0) <= TEXT_PREVIEW_LIMIT);
  assert.equal(preview.size > TEXT_PREVIEW_LIMIT, true);
});

test('Java JS TS Python and Rust language identities are explicit', () => {
  assert.equal(detectCodeLanguage('src/App.java'), 'java');
  assert.equal(detectCodeLanguage('web/index.js'), 'javascript');
  assert.equal(detectCodeLanguage('web/app.tsx'), 'typescript');
  assert.equal(detectCodeLanguage('src/main.py'), 'python');
  assert.equal(detectCodeLanguage('src/lib.rs'), 'rust');
  assert.equal(detectCodeLanguage('pom.xml'), 'java');
  assert.equal(detectCodeLanguage('package.json'), 'javascript');
  assert.equal(detectCodeLanguage('pyproject.toml'), 'python');
  assert.equal(detectCodeLanguage('Cargo.toml'), 'rust');
});

test('provider detection snapshot is reusable and has a bounded TTL', () => {
  const a = getProviderSnapshot(true);
  const b = getProviderSnapshot(false);
  assert.equal(a.detectedAt, b.detectedAt);
  assert.equal(providerSnapshotTtlMs(), 5 * 60 * 1000);
});
