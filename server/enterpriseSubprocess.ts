import { spawn } from 'node:child_process';

export interface GuardedProcessResult {
  exit: number; stdout: string; stderr: string; error?: string; durationMs: number;
}
/** Never blocks the Node API event loop or invokes a shell for untrusted repository tooling. */
export async function runGuardedProcess(command: string, args: string[], options: {
  cwd?: string; timeoutMs: number; maxOutputBytes?: number; env?: NodeJS.ProcessEnv;
}): Promise<GuardedProcessResult> {
  const began = Date.now(), max = options.maxOutputBytes ?? 256 * 1024;
  return new Promise(resolve => {
    let child;
    try { child = spawn(command, args, {
      cwd: options.cwd, env: options.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }); } catch (error) {
      resolve({ exit: -1, stdout: '', stderr: '', error: String(error), durationMs: Date.now() - began });
      return;
    }
    let stdout = '', stderr = '', count = 0, finished = false, failure = '';
    const collect = (data: Buffer, which: 'out' | 'err') => {
      count += data.byteLength;
      if (count > max) { failure = 'Subprocess output limit exceeded'; child.kill('SIGKILL'); return; }
      if (which === 'out') stdout += data.toString('utf8'); else stderr += data.toString('utf8');
    };
    child.stdout.on('data', (data: Buffer) => collect(data, 'out'));
    child.stderr.on('data', (data: Buffer) => collect(data, 'err'));
    const timeout = setTimeout(() => {
      failure = 'Subprocess timed out'; child.kill('SIGKILL');
    }, options.timeoutMs);
    const done = (code: number | null, message?: string) => {
      if (finished) return;
      finished = true; clearTimeout(timeout);
      resolve({ exit: code ?? -1, stdout: stdout.slice(-max), stderr: stderr.slice(-max),
        error: message || failure || undefined, durationMs: Date.now() - began });
    };
    child.on('error', (error: Error) => done(-1, error.message));
    child.on('close', code => done(code));
  });
}
