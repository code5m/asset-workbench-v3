/**
 * agent:preflight
 *
 * Step 1 of the Agent Knowledge Capture Protocol. Runs with plain Node (no
 * browser, no dev server). Confirms the workspace, the AGENTS.md contract, and
 * the managed knowledge paths, then opens an AgentSession and prints its id.
 *
 * Usage:
 *   node scripts/agent-preflight.ts [--agent codex] [--title "..."] [--summary "..."]
 *
 * Run with: npm run agent:preflight
 */

import fs from 'node:fs';
import path from 'node:path';
import { getProjectRoot } from '../server/config.ts';
import { createSession } from '../server/agentSessionService.ts';
import type { AgentType, CaptureMode } from '../src/domain/asset';

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
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

const VALID_AGENTS: AgentType[] = ['chatgpt', 'codex', 'codebuddy', 'manual', 'other'];

const args = parseArgs(process.argv.slice(2));

const root = getProjectRoot();
const agentType = (args.agent && VALID_AGENTS.includes(args.agent as AgentType) ? args.agent : 'codex') as AgentType;
const captureMode = (args['capture-mode'] as CaptureMode) || 'agent-work-record';

// 1. workspace / cwd
// 2. AGENTS.md presence
const agentsMd = path.join(root, 'AGENTS.md');
const agentsExists = fs.existsSync(agentsMd);

// 3. managed knowledge paths
const managedPaths = ['04-conversations', '02-design', '03-docs', '05-derived'] as const;
const missingManaged = managedPaths.filter((p) => !fs.existsSync(path.join(root, p)));

// 4. create session (also detects an un-closed previous session)
const res = createSession({
  agentType,
  taskTitle: args.title || 'Untitled Agent Task',
  taskSummary: args.summary || '',
  captureMode,
});

console.log('AGENT_PREFLIGHT');
console.log(`workspace:      ${path.basename(root)}`);
console.log(`root:           ${root}`);
console.log(`agents:         ${agentsExists ? 'loaded' : 'MISSING (protocol not enforced by contract file)'}`);
console.log(`managed_paths:  ${missingManaged.length === 0 ? managedPaths.join(' ') : `${managedPaths.join(' ')} (missing: ${missingManaged.join(', ')})`}`);
console.log(`session:        ${res.session.id}`);
console.log(`agent_type:     ${agentType}`);
console.log(`capture_mode:   ${captureMode}`);
console.log('knowledge_capture: required');

if (res.interruptedPrevious) {
  console.log('');
  console.log('WARNING: previous session was still ACTIVE and has been marked INTERRUPTED:');
  console.log(`  ${res.interruptedPrevious.id} (started ${res.interruptedPrevious.startedAt})`);
  console.log('  It was NOT silently overwritten. Review it before starting a new task.');
}

console.log('');
console.log('Protocol summary (see AGENTS.md > Agent Knowledge Capture Protocol):');
console.log('  Start-of-Task : read AGENTS.md, identify workspace/task, decide capture need');
console.log('  During-Task    : investigation=Conversation, formal plan=Design, adopted ruling=Decision');
console.log('  End-of-Task    : run agent:close, then verify:knowledge (gate must PASS)');
console.log(`session_id=${res.session.id}`);
