import fs from 'node:fs';
import path from 'node:path';
import { isIgnoredPath } from './ignorePolicy.ts';

/**
 * Bounded watcher for lazily-loaded directories.
 *
 * The root is always watched. Additional directories are watched only after the
 * UI loads them. Events are debounced and reported as relative parent paths so
 * AssetService can invalidate just the affected cache entries.
 */
export class AssetWatcher {
  private watchers = new Map<string, fs.FSWatcher>();
  private pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private root: string,
    private onChanged: (invalidatedPaths: string[]) => void,
  ) {}

  start(): void {
    this.watchDirectory('');
  }

  watchDirectory(relativePath: string): void {
    const abs = relativePath ? path.join(this.root, ...relativePath.split('/')) : this.root;
    if (this.watchers.has(abs) || isIgnoredPath(abs)) return;
    try {
      const watcher = fs.watch(abs, (_event, filename) => {
        const name = filename ? filename.toString() : '';
        const changedRel = name ? (relativePath ? `${relativePath}/${name}` : name) : relativePath;
        this.schedule(relativePath);
        if (changedRel) this.schedule(path.posix.dirname(changedRel) === '.' ? '' : path.posix.dirname(changedRel));
      });
      watcher.on('error', () => {
        try { watcher.close(); } catch { /* noop */ }
        this.watchers.delete(abs);
      });
      this.watchers.set(abs, watcher);
    } catch {
      // Missing/unreadable directories are simply not watched.
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
