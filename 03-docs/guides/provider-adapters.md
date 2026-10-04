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
| CodeBuddy | `2.127.0`, hooks supported by the installed build | official `.codebuddy/settings.json` lifecycle hooks + official session transcript | yes / yes / Pre+PostToolUse | yes | yes (official transcript) | ENABLED, runtime verified |
| CodeArts | `26.9.3` | official `run` / `export`, both credential-gated | not reachable | no | blocked | BLOCKED, no `CODEARTS_CLI_AK`/`CODEARTS_CLI_SK` |
| OpenCode | no executable anywhere | plugin / SDK event stream | not available | no | no | NOT_INSTALLED |
| Trae | `trae-cn 1.107.1` (IDE) | none found in the installed build | not available | no | no | UNSUPPORTED, no official session/hook interface |
| ChatGPT desktop | desktop app present | explicit transcript import | imported content only | no | user import | LIMITED |
| WorkBuddy | no local installation found | future provider integration | not available | no | no | NOT_INSTALLED |

`LIMITED`, `BLOCKED`, and `UNSUPPORTED` are intentional and honest states: they
mean the workbench has not observed a reliable, automatic live feed from that
provider and will not label a reconstructed summary as a transcript. Full
evidence for each row is in [`docs/provider-capture.md`](../../docs/provider-capture.md).

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

## CodeBuddy automatic capture

This project contains `.codebuddy/settings.json`, which registers official
CodeBuddy lifecycle hooks:

```text
SessionStart        -> session.started
UserPromptSubmit    -> user.message          (payload field `prompt`)
PreToolUse          -> tool.started
PostToolUse         -> tool.completed
PostToolUseFailure  -> tool.completed (ok=false)
PreCompact          -> session.compacted
Stop                -> assistant.message    (payload field `last_assistant_message`)
SubagentStart/Stop  -> no canonical event   (never a separate main transcript)
```

The adapter keys everything on the official `session_id`, so one CodeBuddy
session is exactly one CaptureSession. Hooks are fail-open and mostly async.

CodeBuddy also publishes its official session transcript location in the hook
payload's `transcript_path`. That directory (`index.json` + `messages/*.json`)
can be imported for full-fidelity user/assistant text:

```bash
npm run capture:import:codebuddy -- <transcript-path-from-hook-payload>
```

The import is idempotent and suppresses exact duplicate content, so a provider
re-emission (for example, re-sending the leading prompt) does not produce a
duplicated message.

Limitation: creating a brand-new CodeBuddy session headlessly (`codebuddy -p`,
or ACP `session/new`) returns `default agent undefined is not registered` /
`Authentication required`, i.e. it needs an interactive provider login. Real
sessions that the user actually runs are captured; sessions cannot be
fabricated unattended.

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
