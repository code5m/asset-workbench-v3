/**
 * agent:close
 *
 * Step 2 of the Agent Knowledge Capture Protocol. Consumes the current (or a
 * given) AgentSession and performs the Knowledge Capture Closure: it decides
 * whether a Conversation is required, whether a formal Design/Decision exists,
 * and persists the real assets through the Managed Asset Service. It does NOT
 * fabricate content — it writes the agent's actual work record.
 *
 * Usage:
 *   node scripts/agent-close.ts --input .asset-workbench-data/current-session/closure.json
 *   node scripts/agent-close.ts --skip --skip-reason trivial-change
 *   node scripts/agent-close.ts --title "..." --summary "..." --decision-create \
 *        --decision-title "..." --decision-content "..."
 *
 * Run with: npm run agent:close
 */

import fs from 'node:fs';
import path from 'node:path';
import { currentSession, readSession, SessionError } from '../server/agentSessionService.ts';
import { runClosure, type ClosureInput } from '../server/knowledgeCaptureService.ts';
import type { DecisionStatus } from '../src/domain/asset';

function parseArgs(argv: string[]): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (key === 'changes' || key === 'verification' || key === 'affected') {
      const arr: string[] = [];
      let j = i + 1;
      while (j < argv.length && !argv[j].startsWith('--')) {
        arr.push(argv[j]);
        j++;
      }
      out[key] = arr;
      i = j - 1;
    } else if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function buildFromFlags(args: Record<string, string | string[]>): ClosureInput {
  const input: ClosureInput = {};
  if (typeof args.title === 'string') input.taskTitle = args.title;
  if (typeof args.summary === 'string') input.summary = args.summary;
  if (typeof args.investigation === 'string') input.investigation = args.investigation;
  if (typeof args.findings === 'string') input.findings = args.findings;
  if (Array.isArray(args.changes)) input.changes = args.changes;
  if (Array.isArray(args.verification)) input.verification = args.verification;
  if (typeof args.outcome === 'string') input.outcome = args.outcome;
  if (Array.isArray(args.affected)) input.affectedAssetPaths = args.affected;
  if (args.skip === 'true') {
    input.captureConversation = false;
    input.skipReason = typeof args['skip-reason'] === 'string' ? (args['skip-reason'] as string) : 'trivial-change';
  }
  if (args['design-create'] === 'true') {
    input.design = {
      action: 'create',
      title: typeof args['design-title'] === 'string' ? (args['design-title'] as string) : (typeof args.title === 'string' ? (args.title as string) : undefined),
      designArea: typeof args['design-area'] === 'string' ? (args['design-area'] as string) : 'architecture',
      content: typeof args['design-content'] === 'string' ? (args['design-content'] as string) : '',
    };
  }
  if (args['decision-create'] === 'true') {
    input.decision = {
      action: 'create',
      title: typeof args['decision-title'] === 'string' ? (args['decision-title'] as string) : (typeof args.title === 'string' ? (args.title as string) : undefined),
      content: typeof args['decision-content'] === 'string' ? (args['decision-content'] as string) : '',
      status: (typeof args['decision-status'] === 'string' ? (args['decision-status'] as DecisionStatus) : 'Accepted'),
    };
  }
  return input;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let session = args.session ? readSession(args.session as string) : currentSession();
  if (!session) {
    console.error('KNOWLEDGE_CAPTURE');
    console.error('STATUS: FAIL');
    console.error('ERROR: no active AgentSession. Run agent:preflight first.');
    process.exit(1);
  }

  let input: ClosureInput;
  if (typeof args.input === 'string') {
    const raw = fs.readFileSync(path.resolve(args.input as string), 'utf8');
    input = JSON.parse(raw) as ClosureInput;
  } else {
    input = buildFromFlags(args);
  }

  try {
    const result = await runClosure(session.id, input);
    console.log('KNOWLEDGE_CAPTURE');
    console.log(`session:   ${result.session.id}`);
    console.log(`status:    ${result.skipped ? 'SKIPPED' : 'CAPTURED'}`);
    if (result.skipped) {
      console.log(`skip_reason: ${result.session.skipReason}`);
    } else {
      if (result.conversation) console.log(`work_record: ${result.conversation.path} (${result.conversation.id})`);
      if (result.transcript) console.log(`transcript:   ${result.transcript.path} (${result.transcript.id})`);
      console.log(`transcript_capture_status: ${result.session.transcriptCaptureStatus}`);
      if (result.design) console.log(`design: ${result.design.path} (${result.design.id})`);
      if (result.decision) console.log(`decision: ${result.decision.path} (${result.decision.id})`);
    }
    console.log('');
    console.log('Next: run `npm run verify:knowledge` — the gate must PASS before the task is fully closed.');
    process.exit(0);
  } catch (e) {
    console.error('KNOWLEDGE_CAPTURE');
    console.error('STATUS: FAIL');
    console.error(`ERROR: ${(e as Error).message}`);
    process.exit(1);
  }
}

main();
