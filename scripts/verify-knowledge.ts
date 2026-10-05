/**
 * verify:knowledge
 *
 * Step 3 (the兜底 gate) of the Agent Knowledge Capture Protocol. Verifies that
 * the current AgentSession is cleanly closed and that every required knowledge
 * asset was actually persisted, is discoverable by the Scanner, and keeps
 * consistent bidirectional relations. Exits non-zero on any failure.
 *
 * Usage:
 *   node scripts/verify-knowledge.ts [--session <id>]
 *
 * Run with: npm run verify:knowledge
 */

import { currentSessionId, readSession } from '../server/agentSessionService.ts';
import { verifyKnowledgeCapture } from '../server/knowledgeCaptureService.ts';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const id = args.session || currentSessionId() || undefined;

const result = verifyKnowledgeCapture(id);

console.log('KNOWLEDGE_CAPTURE_GATE');
console.log(`STATUS: ${result.ok ? 'PASS' : 'FAIL'}`);
if (id) {
  const s = readSession(id);
  console.log(`session: ${id}`);
  if (s) console.log(`closure: ${s.closureStatus} / capture: ${s.captureStatus}`);
}
if (result.issues.length > 0) {
  console.log('ISSUES:');
  for (const issue of result.issues) console.log(`  - ${issue}`);
}
if (result.warnings.length > 0) {
  console.log('WARNINGS:');
  for (const warning of result.warnings) console.log(`  - ${warning}`);
}
if (result.ok && result.warnings.length === 0) {
  console.log('All knowledge-capture checks passed.');
} else if (result.ok) {
  console.log('Knowledge-capture integrity passed with explicit transcript limitations above.');
}

process.exit(result.ok ? 0 : 1);
