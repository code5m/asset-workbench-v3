import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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

export type WorkbenchRuntimeMode = 'framework-self' | 'business-project';

export interface WorkbenchConfig {
  projectRoot: string;
  appRoot: string;
  mode: WorkbenchRuntimeMode;
  hasExternalProject: boolean;
  frameworkVersion: string;
  frameworkRevision: string;
  instanceId?: string;
  lockedToInstance?: boolean;
}

let currentRoot = APP_ROOT;

function frameworkRevision(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: APP_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

const FRAMEWORK_VERSION = '0.1.0';


export function ensureDataDir(): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function lockedInstance(): { projectRoot: string; instanceId: string } | null {
  const raw = process.env.AWB_INSTANCE_PROJECT_ROOT;
  if (!raw) return null;
  const root = fs.realpathSync(path.resolve(raw));
  if (!fs.statSync(root).isDirectory() || root === fs.realpathSync(APP_ROOT)) throw new Error('Invalid managed Instance project');
  const file = path.join(root, '.asset-workbench-data', 'instance', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as { projectRoot?: string; instanceId?: string; state?: string };
  if (path.resolve(manifest.projectRoot ?? '') !== root || manifest.state !== 'ready' || !manifest.instanceId) {
    throw new Error('Instance runtime requires matching ready Manifest');
  }
  return { projectRoot: root, instanceId: manifest.instanceId };
}

function runtimeMode(root = currentRoot): WorkbenchRuntimeMode {
  return path.resolve(root) === path.resolve(APP_ROOT) ? 'framework-self' : 'business-project';
}

export function loadConfig(): WorkbenchConfig {
  const locked = lockedInstance();
  if (locked) {
    currentRoot = locked.projectRoot;
    ensureDataDir();
    return {
      projectRoot: currentRoot, appRoot: APP_ROOT, mode: 'business-project', hasExternalProject: true,
      frameworkVersion: FRAMEWORK_VERSION, frameworkRevision: frameworkRevision(),
      instanceId: locked.instanceId, lockedToInstance: true,
    };
  }
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
  return {
    projectRoot: currentRoot,
    appRoot: APP_ROOT,
    mode: runtimeMode(currentRoot),
    hasExternalProject: runtimeMode(currentRoot) === 'business-project',
    frameworkVersion: FRAMEWORK_VERSION,
    frameworkRevision: frameworkRevision(),
  };
}

export function getProjectRoot(): string {
  return currentRoot;
}

export function setProjectRoot(root: string): WorkbenchConfig {
  if (process.env.AWB_INSTANCE_PROJECT_ROOT) throw new Error('This Instance is locked to one business project; project switching is disabled');
  const resolved = path.resolve(root);
  if (!fs.existsSync(resolved)) {
    throw new Error(`project root does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`project root is not a directory: ${resolved}`);
  }
  currentRoot = fs.realpathSync(resolved);
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ projectRoot: currentRoot }, null, 2), 'utf8');
  return {
    projectRoot: currentRoot,
    appRoot: APP_ROOT,
    mode: runtimeMode(currentRoot),
    hasExternalProject: runtimeMode(currentRoot) === 'business-project',
    frameworkVersion: FRAMEWORK_VERSION,
    frameworkRevision: frameworkRevision(),
  };
}
