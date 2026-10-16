import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { APP_ROOT } from './config.ts';

type ToolState = { available: boolean; detail: string };
export interface SemanticToolchainStatus {
  javaCompiler: ToolState;
  sqlParser: ToolState;
  localModel: ToolState;
  testSandbox: ToolState;
  readyForSemantics: boolean;
  readyForAutoRefactoring: boolean;
}
const venvPython = () => path.join(APP_ROOT, '.asset-workbench-data', 'toolchains', 'sql-python', 'bin', 'python3');
const probe = (binary: string, args: string[], timeout = 3500): ToolState => {
  const r = spawnSync(binary, args, { timeout, encoding: 'utf8', maxBuffer: 100_000,
    env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', LANG: 'C.UTF-8' } });
  return { available: r.status === 0, detail: r.status === 0
    ? (r.stdout || r.stderr || 'ready').trim().slice(0, 100)
    : (r.error?.message || r.stderr || 'not installed').trim().slice(0, 150) };
};
export async function semanticToolchainStatus(): Promise<SemanticToolchainStatus> {
  const javaCompiler = probe('java', ['-version']);
  const python = fs.existsSync(venvPython()) ? venvPython() : 'python3';
  const sqlParser = probe(python, ['-c', 'import sqlglot; print(sqlglot.__version__)']);
  const testSandbox = probe('docker', ['image', 'inspect', 'maven:3.9.11-eclipse-temurin-21']);
  if (testSandbox.available) testSandbox.detail = 'Maven/JDK Docker image cached; test outcome still requires baseline + candidate execution';
  let localModel: ToolState = { available: false, detail: 'Ollama not reachable at 127.0.0.1:11434' };
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: controller.signal });
    if (response.ok) localModel = { available: true, detail: 'Local Ollama endpoint responds; selected model readiness not proven' };
  } catch { /* local-only integration not configured */ }
  finally { clearTimeout(timer); }
  return {
    javaCompiler, sqlParser, localModel, testSandbox,
    readyForSemantics: javaCompiler.available && sqlParser.available,
    readyForAutoRefactoring: localModel.available && testSandbox.available,
  };
}
