# Multi-Agent Conversation Capture

## What this guide lets you do

Use one local capture path for supported Agent conversations without granting a
provider permission to write project assets. The status panel on the welcome
page tells you exactly what this machine can currently capture.

```text
Provider -> Provider Adapter -> Capture API -> Capture Kernel -> Managed Transcript
```

Adapters send events only. They never write `04-conversations` themselves.
The Capture Kernel keeps raw payloads and normalized events, deduplicates by
event id, records ordering problems, and uses the Managed Asset Service to
create the final Transcript.

## Capability matrix (verified on this machine)

| Provider | Installed evidence | Supported path | User / assistant / tools | Real-time | History | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | `codex-cli 0.149.0` | project lifecycle hooks + JSONL importer | yes / yes / PostToolUse | yes | yes | ENABLED, runtime verified |
| CodeBuddy | CLI exposes ACP and stream JSON | generic ACP/stream event contract | contract only | no configured subscriber | no verified importer | LIMITED |
| CodeArts | CLI exposes ACP, `session list`, and `export` | generic ACP / export ingestion boundary | contract only | no configured subscriber | CLI export is available | LIMITED |
| OpenCode | local state found, no executable or stable schema | future local-history adapter | not verified | no | no | LIMITED |
| Trae | no local installation found | future provider integration | not available | no | no | NOT_INSTALLED |
| ChatGPT desktop | no workspace-accessible event feed | explicit transcript import | imported content only | no | user export/import | LIMITED |
| WorkBuddy | no local installation found | future provider integration | not available | no | no | NOT_INSTALLED |

`LIMITED` is intentional: it means the workbench has not observed a reliable,
automatic live feed and will not label a reconstructed summary as a transcript.

## Codex automatic capture

This project contains `.codex/hooks.json`. Codex must trust the project hook
configuration before it runs. Once trusted, normal Codex work in this project
automatically forwards:

1. session start;
2. each submitted user prompt;
3. tool completions when Codex emits them;
4. the last assistant response for a turn; and
5. session end, which materializes the transcript.

The hook is fail-open: a capture error never blocks the Agent's task. The
adapter serializes same-session hook deliveries so concurrent lifecycle events
cannot create separate CaptureSessions.

## Safe Codex history import

Use this only for genuine Codex JSONL records beneath `~/.codex/sessions`:

```bash
npm run capture:import:codex -- ~/.codex/sessions/YYYY/MM/DD/rollout-<id>.jsonl
```

The importer reads the source without modifying it. Event ids use the original
session id and line ordinal, so repeating the command imports zero duplicates.
Imported messages retain their source session id; sequence gaps remain visible
and result in a partial transcript when materialized.

## Adding another provider

Implement only this boundary: map a real provider event to
`ingestProviderEvent` or the local Capture API. Required fields are provider,
provider session id, event type, timestamp, actor, and original payload. Map
user messages, assistant messages, tool calls/results, lifecycle signals,
workspace path, and model when supplied. Do not bypass the Capture Kernel or
write managed metadata directly.

Before calling a provider ENABLED, prove an actual authenticated session end to
end, including a resulting `conversation-transcript`. Otherwise use one of
`AVAILABLE`, `LIMITED`, `NEEDS_AUTH`, `DISABLED`, `NOT_INSTALLED`, or `ERROR`.
