import fs from 'node:fs';
import { endProviderSession, ingestProviderEvent } from '../server/providerAdapterService.ts';

async function main(): Promise<void> {
  const raw = fs.readFileSync(0, 'utf8');
  if (!raw.trim()) return;
  const event = JSON.parse(raw) as Record<string, unknown>;
  const providerSessionId = typeof event.session_id === 'string' ? event.session_id : '';
  const hookEventName = typeof event.hook_event_name === 'string' ? event.hook_event_name : '';
  if (!providerSessionId || !hookEventName) return;
  ingestProviderEvent({
    provider: 'codex', providerSessionId, hookEventName,
    cwd: typeof event.cwd === 'string' ? event.cwd : undefined,
    model: typeof event.model === 'string' ? event.model : undefined,
    turnId: typeof event.turn_id === 'string' ? event.turn_id : undefined,
    prompt: typeof event.prompt === 'string' ? event.prompt : undefined,
    lastAssistantMessage: typeof event.last_assistant_message === 'string' ? event.last_assistant_message : null,
    toolName: typeof event.tool_name === 'string' ? event.tool_name : undefined,
    toolInput: event.tool_input, toolResponse: event.tool_response,
    rawPayload: event,
  });
  if (hookEventName === 'SessionEnd') await endProviderSession('codex', providerSessionId);
}
main().catch(() => process.exit(0));
