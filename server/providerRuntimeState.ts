import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from './config.ts';

function enabledFile(): string {
  return path.join(getDataDir(), 'provider-runtime', 'enabled.json');
}

function readState(): Record<string, boolean> {
  try {
    return JSON.parse(fs.readFileSync(enabledFile(), 'utf8')) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveState(state: Record<string, boolean>): void {
  const file = enabledFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
}

export function isProviderEnabled(id: string): boolean {
  return readState()[id] !== false;
}

export function setProviderRuntimeEnabled(id: string, value: boolean): void {
  const state = readState();
  state[id] = value;
  saveState(state);
}

export function providerRuntimeState(): Record<string, boolean> {
  return readState();
}
