#!/usr/bin/env node
/**
 * User-level official Provider hook bridge. Run from a provider's actual cwd.
 * Never writes into a nested business Git checkout, calls network APIs or
 * changes the provider's return status. Unregistered directories are ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const observedCwd = process.cwd();
const framework = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(framework);
const { appendEnterpriseProviderEvent } = await import('../server/enterpriseProviderCapture.ts');

function firstText(...values: unknown[]): string {
  return values.find(v => typeof v === 'string' && v.trim()) as string || '';
}
const args = process.argv.slice(2);
const providerIndex = args.findIndex(a => a === '--provider');
const provider = (providerIndex >= 0 ? args[providerIndex + 1] : args.find(a => a.startsWith('--provider='))?.slice(11)) || 'codex';
async function processPayload(input: string): Promise<void> {
  if (!input.trim() || Buffer.byteLength(input) > 2_000_000) return;
  try {
  const event = JSON.parse(input) as Record<string, any>;
  const properties = (event.properties ?? event.event?.properties ?? {}) as Record<string, any>;
  const hookEventName = firstText(event.hook_event_name, event.hookEventName, event.type,
    event.event?.type, properties.hook_event_name) || 'Notification';
  const providerSessionId = firstText(event.session_id, event.sessionId, event.sessionID,
    properties.sessionID, properties.sessionId, properties.info?.sessionID,
    properties.message?.sessionID, properties.part?.sessionID, properties.info?.id, properties.session?.id);
  if (!providerSessionId) return;
  const cwd = firstText(event.cwd, event.projectDirectory, event.directory,
    event.project?.directory, properties.cwd, properties.directory, observedCwd);
  const stamp = firstText(event.timestamp, event.receivedAt) || new Date().toISOString();
  const rawPayload = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
  if (provider === 'codex' && hookEventName === 'SessionEnd') {
    const transcriptPath = firstText(event.transcript_path, event.agent_transcript_path);
    if (transcriptPath) {
      try {
        const { importEnterpriseCodexHistory } = await import('../server/enterpriseProviderHistory.ts');
        importEnterpriseCodexHistory(transcriptPath);
      } catch {
        // The official JSONL may be unavailable; still save actual native
        // SessionEnd evidence without inventing a complete history.
      }
    }
  }
  if (provider === 'codebuddy' && hookEventName === 'SessionEnd'
    && typeof event.transcript_path === 'string' && event.transcript_path) {
    try {
      const { importEnterpriseCodeBuddyHistory } = await import('../server/enterpriseProviderHistory.ts');
      importEnterpriseCodeBuddyHistory(event.transcript_path, providerSessionId);
    } catch {
      // Preserve actual End evidence even when the optional official
      // transcript import is unavailable. Such a capture may be partial.
    }
  }
  appendEnterpriseProviderEvent({
    provider, providerSessionId, hookEventName,
    cwd, observedCwd, timestamp: stamp, rawPayload,
    eventId: firstText(event.eventId, event.event_id, properties.eventId,
      properties.part?.id, properties.message?.id),
    role: event.role === 'user' || event.role === 'assistant' ? event.role : undefined,
    content: firstText(event.prompt, event.last_assistant_message, event.content,
      properties.part?.text, properties.message?.text),
  });
} catch {
    // Observation-only: source programs must never depend on capture success.
  }
}
if (args.includes('--stream')) {
  // A single helper handles all events in the OpenCode plugin lifetime.
  // This avoids hundreds of synchronous subprocesses for streamed tokens.
  const { createInterface } = await import('node:readline');
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of reader) {
    await processPayload(line);
  }
} else {
  await processPayload(fs.readFileSync(0, 'utf8'));
}
