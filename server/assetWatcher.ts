import fs from 'node:fs';
import path from 'node:path';
import { isIgnoredPath } from './ignorePolicy.ts';

/**
 * Self-contained recursive filesystem watcher.
 *
 * Node's fs.watch is not recursive on Linux, so we watch every directory we
 * descend into and re-watch whenever a new directory appears. Symlinked
 * directories are skipped to avoid cycles. Any change is debounced and handed
 * to onChanged, which performs a single re-scan so the asset state stays a
 * single source of truth.
 */

export class AssetWatcher {
  private watchers = new Map<string, fs.FSWatcher>();
  private timer: NodeJS.Timeout | null = null;
  private root: string;
  private onChanged: () => void;

  constructor(root: string, onChanged: () => void) {
    this.root = root;
    this.onChanged = onChanged;
  }

  start(): void {
    this.watchRecursively(this.root);
  }

  private scheduleRescan(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onChanged();
    }, 200);
  }

  private watchRecursively(dir: string): void {
    if (this.watchers.has(dir) || isIgnoredPath(dir)) return;

    let watcher: fs.FSWatcher;
    try {
      watcher = fs.watch(dir, (event, filename) => {
        const name = filename ? filename.toString() : '';
        if (!name) {
          this.scheduleRescan();
          return;
        }
        const full = path.join(dir, name);
        this.handleEntry(full);
      });
    } catch {
      return;
    }

    this.watchers.set(dir, watcher);
    watcher.on('error', () => {
      // Directory may have been removed; drop the watcher and let the parent rescan.
      this.watchers.delete(dir);
    });

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === '.git') continue;
      if (isIgnoredPath(path.join(dir, e.name))) continue;
      const full = path.join(dir, e.name);
      if (this.isSymlink(full)) continue;
      this.watchRecursively(full);
    }
  }

  private handleEntry(full: string): void {
    this.scheduleRescan();
    try {
      const st = fs.statSync(full);
      if (st.isDirectory() && !this.watchers.has(full) && !isIgnoredPath(full) && !this.isSymlink(full)) {
        this.watchRecursively(full);
      }
    } catch {
      // Entry was removed; the rescan will reconcile the tree.
    }
  }

  private isSymlink(p: string): boolean {
    try {
      return fs.lstatSync(p).isSymbolicLink();
    } catch {
      return false;
    }
  }

  stop(): void {
    for (const w of this.watchers.values()) {
      try {
        w.close();
      } catch {
        // ignore
      }
    }
    this.watchers.clear();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
