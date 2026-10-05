import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface DurablePairTransaction {
  version: 1;
  contentStage: string;
  metadataStage: string;
  contentTarget: string;
  metadataTarget: string;
}

function assertBasename(name: string): void {
  if (!name || name !== path.basename(name) || name.includes('/') || name.includes('\\')) {
    throw new Error(`invalid transaction filename: ${name}`);
  }
}

function fsyncDir(dir: string): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function writeSyncedFile(target: string, content: string): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(target, 'w', 0o600);
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function writeFileDurableAtomic(target: string, content: string): void {
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.awtmp-${crypto.randomBytes(8).toString('hex')}`);
  try {
    writeSyncedFile(tmp, content);
    fs.renameSync(tmp, target);
    fsyncDir(dir);
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
  }
}

export function writeDirDurableAtomic(targetDir: string, files: Record<string, string>): void {
  const parent = path.dirname(targetDir);
  fs.mkdirSync(parent, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(parent, '.awtmp-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      assertBasename(name);
      writeSyncedFile(path.join(tmp, name), content);
    }
    fsyncDir(tmp);
    fs.renameSync(tmp, targetDir);
    fsyncDir(parent);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/**
 * Crash-recoverable two-file commit for Markdown + metadata sidecars.
 *
 * Both staged files and the transaction marker are fsynced before commit.
 * Commit is roll-forward: if a crash happens between the two renames, the next
 * AssetService scan completes the transaction before exposing filesystem state.
 */
export function writePairDurableAtomic(
  contentTarget: string,
  content: string,
  metadataTarget: string,
  metadata: string,
): void {
  const contentDir = path.dirname(contentTarget);
  const metadataDir = path.dirname(metadataTarget);
  if (contentDir !== metadataDir) throw new Error('pair targets must share one directory');

  fs.mkdirSync(contentDir, { recursive: true });
  const id = crypto.randomBytes(10).toString('hex');
  const contentStage = `.awtxn-${id}.content`;
  const metadataStage = `.awtxn-${id}.metadata`;
  const marker = `.awtxn-${id}.json`;
  const markerPath = path.join(contentDir, marker);
  const tx: DurablePairTransaction = {
    version: 1,
    contentStage,
    metadataStage,
    contentTarget: path.basename(contentTarget),
    metadataTarget: path.basename(metadataTarget),
  };

  let markerDurable = false;
  try {
    writeSyncedFile(path.join(contentDir, contentStage), content);
    writeSyncedFile(path.join(contentDir, metadataStage), metadata);
    writeSyncedFile(markerPath, JSON.stringify(tx));
    fsyncDir(contentDir);
    markerDurable = true;

    fs.renameSync(path.join(contentDir, contentStage), contentTarget);
    fsyncDir(contentDir);
    fs.renameSync(path.join(contentDir, metadataStage), metadataTarget);
    fsyncDir(contentDir);

    fs.rmSync(markerPath, { force: true });
    fsyncDir(contentDir);
    markerDurable = false;
  } finally {
    if (!markerDurable) {
      for (const file of [contentStage, metadataStage, marker]) {
        try { fs.rmSync(path.join(contentDir, file), { force: true }); } catch { /* best effort */ }
      }
    }
  }
}

function recoverDirectory(dir: string): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  const markers = entries
    .filter((entry) => entry.isFile() && /^\.awtxn-[a-f0-9]+\.json$/.test(entry.name))
    .map((entry) => entry.name);

  for (const marker of markers) {
    const markerPath = path.join(dir, marker);
    let tx: DurablePairTransaction;
    try {
      tx = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as DurablePairTransaction;
      if (tx.version !== 1) throw new Error('unsupported transaction version');
      for (const name of [tx.contentStage, tx.metadataStage, tx.contentTarget, tx.metadataTarget]) assertBasename(name);
    } catch {
      continue;
    }

    const pairs: Array<[string, string]> = [
      [tx.contentStage, tx.contentTarget],
      [tx.metadataStage, tx.metadataTarget],
    ];
    let complete = true;
    for (const [stageName, targetName] of pairs) {
      const stage = path.join(dir, stageName);
      const target = path.join(dir, targetName);
      if (fs.existsSync(stage)) {
        fs.renameSync(stage, target);
        fsyncDir(dir);
      } else if (!fs.existsSync(target)) {
        complete = false;
      }
    }
    if (complete) {
      fs.rmSync(markerPath, { force: true });
      fsyncDir(dir);
    }
  }

  // Orphan stages without a durable marker were never committed and are safe
  // to remove. They are also ignored by the scanner as a second line of defense.
  const after = fs.readdirSync(dir, { withFileTypes: true });
  const activeIds = new Set(
    after
      .filter((entry) => entry.isFile() && /^\.awtxn-[a-f0-9]+\.json$/.test(entry.name))
      .map((entry) => entry.name.slice('.awtxn-'.length, -'.json'.length)),
  );
  for (const entry of after) {
    const match = /^\.awtxn-([a-f0-9]+)\.(content|metadata)$/.exec(entry.name);
    if (match && !activeIds.has(match[1])) {
      try { fs.rmSync(path.join(dir, entry.name), { force: true }); } catch { /* best effort */ }
    }
  }

  for (const entry of after) {
    if (!entry.isDirectory() || entry.name === '.git') continue;
    recoverDirectory(path.join(dir, entry.name));
  }
}

export function recoverDurableTransactions(root: string, managedRoots: readonly string[]): void {
  for (const rel of managedRoots) {
    const dir = path.join(root, rel);
    if (fs.existsSync(dir)) recoverDirectory(dir);
  }
}
