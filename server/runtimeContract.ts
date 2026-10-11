import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from './config.ts';

/** Increment for incompatible UI → Instance API changes. */
export const BACKEND_RUNTIME_LEVEL = 2;
/** Stable discoverable marker embedded in every published backend bundle. */
export const BACKEND_RUNTIME_MARKER = 'awb-backend-contract-v2';

type Contract = { schemaVersion: 1; minimumBackendLevel: number; requiredApiPaths: string[] };
export function requiredUiRuntimeLevel(): number {
  const file = path.join(APP_ROOT, 'public', 'awb-runtime-contract.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Contract;
  if (data.schemaVersion !== 1 || !Number.isInteger(data.minimumBackendLevel) || data.minimumBackendLevel < 1
    || !Array.isArray(data.requiredApiPaths) || data.requiredApiPaths.length === 0) {
    throw new Error('Invalid central UI runtime contract');
  }
  return data.minimumBackendLevel;
}
export function checkRuntimeCompatibility(supportedLevel = BACKEND_RUNTIME_LEVEL): {
  compatible: boolean; requiredLevel: number; supportedLevel: number; marker: string;
} {
  const requiredLevel = requiredUiRuntimeLevel();
  return { compatible: supportedLevel >= requiredLevel, requiredLevel, supportedLevel, marker: BACKEND_RUNTIME_MARKER };
}
