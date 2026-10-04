import fs from 'node:fs';
import { endProviderSession, ingestProviderEvent } from '../server/providerAdapterService.ts';
import type { CaptureProvider } from '../src/domain/asset.ts';

/**
 * Provider-native hook entry point.
 *
 * A provider (Codex, CodeBuddy, Trae, ...) writes its official lifecycle hook
 * payload to stdin; this script forwards it into the provider-neutral Capture
 * Kernel. It is strictly observation-only and FAIL-OPEN: any capture problem
 * must never block or slow down the provider's own answer.
 *
 * Provider resolution order:
 *   1. --provider <name> / --provider=<name>
 *   2. AWB_CAPTURE_PROVIDER env var
 *   3. payload field `provider`
 *   4. default 'codex' (keeps the existing Codex hook config working unchanged)
 */
function providerFromArgs(payload: Record<string, unknown>): CaptureProvider {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--provider' && argv[i + 1]) return argv[i + 1] as CaptureProvider;
    if (token.startsWith('--provider=')) return token.slice('--provider='.length) as CaptureProvider;
  }
  const fromEnv = process.env.AWB_CAPTURE_PROVIDER;
  if (fromEnv) return fromEnv as CaptureProvider;
  const fromPayload = payload.provider;
  if (typeof fromPayload === 'string' && fromPayload) return fromPayload as CaptureProvider;
  return 'codex';
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

async function main(): Promise<void> {
  const raw = fs.readFileSync(0, 'utf8');
  if (!raw.trim()) return;
  const event = JSON.parse(raw) as Record<string, unknown>;

  // Codex and CodeBuddy both deliver `session_id` + `hook_event_name`.
  const providerSessionId = text(event.session_id) ?? text(event.sessionId) ?? '';
  const hookEventName = text(event.hook_event_name) ?? text(event.hookEventName) ?? '';
  if (!providerSessionId || !hookEventName) return;

  const provider = providerFromArgs(event);

  ingestProviderEvent({
    provider,
    providerSessionId,
    hookEventName,
    cwd: text(event.cwd),
    model: text(event.model),
    turnId: text(event.turn_id) ?? text(event.generation_id),
    prompt: text(event.prompt),
    lastAssistantMessage: typeof event.last_assistant_message === 'string' ? event.last_assistant_message : null,
    toolName: text(event.tool_name) ?? text(event.toolName),
    toolInput: event.tool_input ?? event.toolInput,
    toolResponse: event.tool_response ?? event.toolResponse,
    // Provider-native identity / provenance (never used for session guessing, only stored).
    transcriptPath: text(event.transcript_path),
    agentTranscriptPath: text(event.agent_transcript_path),
    agentType: text(event.agent_type),
    client: text(event.client),
    providerVersion: text(event.version),
    stopHookActive: event.stop_hook_active === true,
    source: text(event.source),
    reason: text(event.reason),
    rawPayload: event,
  });

  if (hookEventName === 'SessionEnd') await endProviderSession(provider, providerSessionId);
}

main().catch(() => process.exit(0));
