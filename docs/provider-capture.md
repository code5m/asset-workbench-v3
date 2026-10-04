# Provider Capture — Real Capability Matrix

This document records **what is actually verified on this machine**, not what a
provider theoretically supports. Status is derived from real install probes,
credential checks, and real captured sessions.

## Architecture (unchanged)

```text
Provider
  ↓  (official hook payload / official session transcript)
Provider Adapter   (server/providerAdapterService.ts)
  ↓
Capture Kernel     (server/captureService.ts)
  ↓                raw-events.jsonl + events.jsonl + state.json
TranscriptMaterializer (existing)
  ↓
Managed Transcript (04-conversations/transcripts/...)
```

Provider adapters never write to `04-conversations/` directly; they only feed the
Capture Kernel.

## Status levels

| Level | Meaning |
|---|---|
| `ENABLED` | Integration configured; `runtimeVerified` reflects a real ended capture with a materialized transcript |
| `AVAILABLE` | Provider installed but no capture integration configured yet |
| `LIMITED` | Only a restricted path is available (e.g. explicit import) |
| `BLOCKED` | Installed but a hard external blocker (e.g. missing credentials) prevents any real capture |
| `UNSUPPORTED` | Installed but exposes no official session/hook interface to subscribe to |
| `NOT_INSTALLED` | No executable found |

`runtimeVerified=true` **only** comes from a real ended capture session with a
materialized transcript. A config file, a compiled adapter, or a mocked test is
never sufficient.

## Verified matrix (this machine, 2026-10-05)

| Provider | Installed | Version | Data entry | Status | runtimeVerified | Blocker / limitation |
|---|---|---|---|---|---|---|
| Codex | yes | codex-cli 0.149.0 | official lifecycle hooks + JSONL history import | ENABLED | yes | — |
| CodeBuddy | yes | 2.127.0 | official `.codebuddy/settings.json` lifecycle hooks + official session transcript (`transcript_path`) | ENABLED | yes | Headless session creation (`-p` / ACP `session/new`) requires interactive login, so new sessions cannot be fabricated unattended |
| CodeArts | yes | 26.9.3 | official `run` / `export` (needs AK/SK) | BLOCKED | no | `认证失败，没有设置环境变量CODEARTS_CLI_AK/CODEARTS_CLI_SK` — every command including `session list` is rejected |
| OpenCode | no | — | plugin / SDK events | NOT_INSTALLED | no | No executable in PATH / `~/.local/bin` / `~/.opencode/bin` / `/usr/local/bin` / `/usr/bin`. A leftover `~/.local/share/opencode` DB is deliberately NOT used (undocumented schema) |
| Trae | yes | 1.107.1 (`trae-cn`) | none found | UNSUPPORTED | no | The installed binary exposes only editor options; no AI session CLI, no hook event names, no session export. No `SessionEnd` is invented |
| ChatGPT | yes (desktop) | — | explicit import only | LIMITED | no | No local lifecycle hook or stable public session API; browser/private-API/DOM scraping is deliberately not used |

## CodeBuddy hook payload (verified against the installed build)

Official lifecycle events supported by 2.127.0:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `PreCompact`, `Stop`, `SubagentStart`, `SubagentStop`,
`SessionEnd`, `Notification`, `PermissionRequest`, `WorktreeCreate`,
`WorktreeRemove`.

Delivered payload fields (observed):

```json
{
  "session_id": "...", "transcript_path": "...", "cwd": "...",
  "hook_event_name": "PostToolUse", "tool_name": "Bash",
  "tool_input": {}, "tool_response": {},
  "generation_id": "...", "model": "hy4-preview",
  "agent_type": "craft", "client": "VSCode", "version": "4.12.38765564"
}
```

Mapping used by the adapter:

| Provider event | Canonical event |
|---|---|
| `SessionStart` | `session.started` |
| `UserPromptSubmit` | `user.message` (`prompt`) |
| `PreToolUse` | `tool.started` |
| `PostToolUse` / `PostToolUseFailure` | `tool.completed` |
| `Stop` | `assistant.message` (`last_assistant_message`) |
| `PreCompact` | `session.compacted` |
| `SubagentStart` / `SubagentStop` | **no canonical event** (never a separate main transcript) |

## Guarantees implemented

- One `providerSessionId` ⇒ one CaptureSession (file lock + adapter state).
- Messages dedupe per turn; tool events stay distinct by tool name + payload.
- Repeated/duplicated hook delivery is idempotent.
- Subagents never create their own main transcript.
- Capture is fail-open: capture failure never blocks the provider's answer.
- Raw provider payloads are preserved in `raw-events.jsonl`.

## Commands

```bash
npm run test:providers
npm run test:codebuddy-capture
npm run test:capture
npm run capture:import:codebuddy <transcript-dir-or-index.json>
npm run capture:import:codex    <~/.codex/sessions/...jsonl>
```
