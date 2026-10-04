import fs from 'node:fs';
import path from 'node:path';
import { importOpencodeInbox, importOpencodeSession } from '../server/providerAdapterService.ts';

/**
 * Import OpenCode evidence into the shared Capture Kernel.
 *
 * Two official sources are supported:
 *  - `--inbox <file>` : the fail-open plugin inbox written live by
 *                       `.opencode/plugins/awb-capture.js`
 *  - `<export.json>`  : an official `opencode export <sessionID>` payload
 */
const args = process.argv.slice(2);
const inboxIndex = args.indexOf('--inbox');
if (!args.length) {
  console.error('Usage: node --experimental-strip-types scripts/import-opencode-session.ts <export.json>');
  console.error('       node --experimental-strip-types scripts/import-opencode-session.ts --inbox <inbox.jsonl>');
  process.exit(1);
}

let result: { captureSessionId: string; imported: number };
if (inboxIndex >= 0) {
  const inbox = args[inboxIndex + 1];
  if (!inbox) { console.error('missing --inbox value'); process.exit(1); }
  const resolved = path.resolve(inbox);
  if (!fs.existsSync(resolved)) { console.error(`inbox missing: ${resolved}`); process.exit(1); }
  result = importOpencodeInbox(resolved);
} else {
  const resolved = path.resolve(args[0]);
  if (!fs.existsSync(resolved)) { console.error(`export missing: ${resolved}`); process.exit(1); }
  result = importOpencodeSession(resolved);
}
console.log(JSON.stringify(result, null, 2));
