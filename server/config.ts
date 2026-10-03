import fs from 'node:fs';
import path from 'node:path';

/**
 * Runtime configuration for the Local Asset Engine.
 *
 * The Asset Engine never writes into the scanned project root. Its own state
 * (workspace root override) lives in a private data directory next to this
 * application, so user repositories are never polluted.
 */

export const APP_ROOT = process.cwd();

/**
 * Runtime data dir is colocated with the active project root (never the app
 * cwd), so agent sessions and the per-workspace config live inside the
 * workspace's own `.asset-workbench-data` (Scanner-ignored, git-ignored).
 */
export function getDataDir(): string {
  return path.join(getProjectRoot(), '.asset-workbench-data');
}

const CONFIG_FILE = path.join(APP_ROOT, '.asset-workbench-data', 'config.json');

export interface WorkbenchConfig {
  projectRoot: string;
}

let currentRoot = APP_ROOT;

export function ensureDataDir(): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): WorkbenchConfig {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WorkbenchConfig>;
    if (parsed.projectRoot && fs.existsSync(parsed.projectRoot)) {
      currentRoot = parsed.projectRoot;
    }
  } catch {
    // keep default (current working directory)
  }
  return { projectRoot: currentRoot };
}

export function getProjectRoot(): string {
  return currentRoot;
}

export function setProjectRoot(root: string): WorkbenchConfig {
  const resolved = path.resolve(root);
  if (!fs.existsSync(resolved)) {
    throw new Error(`project root does not exist: ${resolved}`);
  }
  currentRoot = resolved;
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ projectRoot: resolved }, null, 2), 'utf8');
  return { projectRoot: resolved };
}
