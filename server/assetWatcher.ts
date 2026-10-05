import fs from 'node:fs';
import path from 'node:path';
import { isIgnoredRelativePath } from './ignorePolicy.ts';

export const MAX_WATCHED_DIRECTORIES = 97;

/**
 * Bounded watcher for lazily-loaded directories.
 *
 * The root is always watched. Additional directories are watched only after the
 * UI loads them. Watchers are kept in LRU order and capped independently from
 * the directory cache so filesystem descriptors cannot grow without bound.
 */
export class AssetWatcher {
  private watchers = new Map<string, fs.FSWatcher>();
  private pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private root: string;
  private onChanged: (invalidatedPaths: string[]) => void;

  constructor(root: string, onChanged: (invalidatedPaths: string[]) => void) {
    this.root = root;
    this.onChanged = onChanged;
  }

  start(): void {
    this.watchDirectory('');
  }

  watchDirectory(relativePath: string): void {
    if (isIgnoredRelativePath(relativePath)) return;
    const abs = relativePath ? path.join(this.root, ...relativePath.split('/')) : this.root;

    const existing = this.watchers.get(abs);
    if (existing) {
      this.watchers.delete(abs);
      this.watchers.set(abs, existing);
      return;
    }

    try {
      const watcher = fs.watch(abs, (_event, filename) => {
        const name = filename ? filename.toString() : '';
        const changedRel = name ? (relativePath ? `${relativePath}/${name}` : name) : relativePath;
        this.schedule(relativePath);
        if (changedRel) {
          const parent = path.posix.dirname(changedRel);
          this.schedule(parent === '.' ? '' : parent);
        }
      });
      watcher.on('error', () => {
        try { watcher.close(); } catch { /* noop */ }
        this.watchers.delete(abs);
      });
      this.watchers.set(abs, watcher);
      this.trim();
    } catch {
      // Missing/unreadable directories are simply not watched.
    }
  }

  unwatchDirectory(relativePath: string): void {
    if (!relativePath) return; // the project root is always retained
    const abs = path.join(this.root, ...relativePath.split('/'));
    const watcher = this.watchers.get(abs);
    if (!watcher) return;
    try { watcher.close(); } catch { /* noop */ }
    this.watchers.delete(abs);
  }

  resetToRoot(): void {
    for (const [abs, watcher] of this.watchers) {
      if (abs === this.root) continue;
      try { watcher.close(); } catch { /* noop */ }
      this.watchers.delete(abs);
    }
    this.pending.clear();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.watchDirectory('');
  }

  private trim(): void {
    while (this.watchers.size > MAX_WATCHED_DIRECTORIES) {
      const oldest = this.watchers.keys().next().value as string | undefined;
      if (!oldest) break;
      if (oldest === this.root) {
        const rootWatcher = this.watchers.get(oldest);
        this.watchers.delete(oldest);
        if (rootWatcher) this.watchers.set(oldest, rootWatcher);
        continue;
      }
      const watcher = this.watchers.get(oldest);
      try { watcher?.close(); } catch { /* noop */ }
      this.watchers.delete(oldest);
    }
  }

  private schedule(relativePath: string): void {
    this.pending.add(relativePath);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const paths = [...this.pending];
      this.pending.clear();
      this.timer = null;
      this.onChanged(paths);
    }, 400);
  }

  stop(): void {
    for (const watcher of this.watchers.values()) {
      try { watcher.close(); } catch { /* noop */ }
    }
    this.watchers.clear();
    this.pending.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get watchedDirectoryCount(): number {
    return this.watchers.size;
  }
}
