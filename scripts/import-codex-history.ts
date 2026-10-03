import { importCodexHistory } from '../server/providerAdapterService.ts';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node --experimental-strip-types scripts/import-codex-history.ts <~/.codex/sessions/...jsonl>');
  process.exit(1);
}
const result = await importCodexHistory(sourcePath);
console.log(JSON.stringify(result));
