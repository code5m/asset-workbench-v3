#!/usr/bin/env node
/**
 * Explicit, read-only Provider history importer. Respects the official local
 * history directory boundary. Never guesses a workspace for missing cwd.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const home = process.cwd();
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const { importEnterpriseCodexHistory } = await import('../server/enterpriseProviderHistory.ts');
const provider = process.argv[2];
const filename = process.argv[3];
if (provider !== 'codex' || !filename) {
  process.stderr.write('Usage: node --experimental-strip-types scripts/import-enterprise-history.ts codex <official-codex-jsonl>\n'
    + 'Other Providers require a real project-bound Hook or separately verified official export format.\n');
  process.exitCode = 2;
} else {
  try {
    const result = importEnterpriseCodexHistory(filename);
    process.stdout.write(JSON.stringify({ ...result, originalWorkingDirectory: home }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('BLOCKED: ' + (error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  }
}
