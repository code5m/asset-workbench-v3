import fs from 'node:fs';
import path from 'node:path';
import { importCodebuddyHistory } from '../server/providerAdapterService.ts';

/**
 * Import an official CodeBuddy session transcript into the shared Capture Kernel.
 *
 * The source path is normally the `transcript_path` value delivered by CodeBuddy's
 * own lifecycle hook payload, i.e. the provider itself tells us where its session
 * transcript lives. Nothing is scraped or guessed.
 */
const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node --experimental-strip-types scripts/import-codebuddy-history.ts <transcript-dir-or-index.json>');
  console.error('       (should live under ~/.local/share/CodeBuddyExtension/Data)');
  process.exit(1);
}
const resolved = path.resolve(sourcePath);
if (!fs.existsSync(resolved)) {
  console.error(`path does not exist: ${resolved}`);
  process.exit(1);
}
const result = await importCodebuddyHistory(resolved);
console.log(JSON.stringify(result, null, 2));
