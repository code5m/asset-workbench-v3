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
| OpenCode | yes | 1.18.34 | official plugin (`.opencode/plugins/`) + official `opencode export` | ENABLED | yes | Streaming merged semantically; free `opencode/*` models used, so no paid credential was required |
| Trae | yes | 1.107.1 (`trae-cn`) | official workspace hooks (`.trae/hooks.json`) | LIMITED | no | Hooks ARE supported by this build and are configured, but a real Trae AI turn needs an interactive logged-in Trae IDE session, so no real event has been observed yet. The build has **no `SessionEnd`** and none is fabricated |
| ChatGPT | yes (desktop) | — | explicit import only | LIMITED | no | No product realtime hook, no self-service export on this workspace, no OpenAI API agent surface configured. Browser/private-API/DOM scraping is deliberately not used |

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

## CodeBuddy SessionEnd and Red Team audit

- **Realtime capture = PASS.** Real `SessionStart` / `UserPromptSubmit` /
  `PreToolUse` / `PostToolUse` / `Stop` payloads are captured from real sessions.
- **Auto SessionEnd = NOT_RUNTIME_VERIFIED.** `SessionEnd` is registered in
  `.codebuddy/settings.json`, but no real `hook_event_name: SessionEnd` has been
  observed yet: a CodeBuddy session ends only when the user ends it, and new
  headless sessions cannot be created (`-p` fails with `default agent undefined is
  not registered`; ACP `session/new` returns `-32000 Authentication required`).
  The materialized E2E transcript was therefore finalized by the workbench, not by
  a provider SessionEnd. Not overclaimed.

**Red Team: 5 `user.message` vs 183 `assistant.message`.** Audited result:

- 183/183 assistant messages have **distinct** content (0 identical).
- **0** consecutive prefix-growth pairs and **0** containment pairs — the
  signature of streaming snapshots is absent, so these are not streaming chunks.
- Root cause: the session was a long autonomous agentic run with ~316 tool calls.
  The provider's official transcript stores each assistant narration between tool
  steps ("Now let me run both test suites.") as its own message. That is the real
  conversation shape, not an adapter defect. Median length is 105 chars.
- Tool events (317 started / 316 completed) are kept out of the chat body.

## OpenCode

- Official plugin: `.opencode/plugins/awb-capture.js` (fail-open) forwards real
  events to an inbox; verified loaded (90–161 live events captured per run).
- Official `opencode export <sessionID>` provides full fidelity including user
  prompts, assistant text parts and tool parts with their state.
- **Semantic merge:** many `message.part.updated` / `message.part.delta` streaming
  events collapse to exactly **one** `assistant.message` per `messageID`; tool
  parts stay independent. Roles are taken from `message.updated` → `properties.info.role`
  (without this, user prompts would be misattributed to the assistant).
- Real E2E: 3 turns (ALPHA → bash tool → BETA → bash tool → GAMMA), 8 canonical
  events, no sequence gaps, transcript verified by reading it.

## Trae

- Official workspace hooks **are** supported by this build: the AI agent module
  contains `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
  `PreCompact`, `Stop`, `Notification`, and payload fields `hook_event_name`,
  `session_id`, `prompt`, `last_assistant_message`, `stop_hook_active`.
  Hooks are configured fail-open in `.trae/hooks.json`.
- **`SessionEnd` does not exist** in this build and is deliberately not invented;
  session finalization is therefore LIMITED, not faked.
- **No real Trae event has been observed**: Trae is an IDE product and a real AI
  turn requires an interactive logged-in Trae session, which cannot be driven
  headlessly. Adapter + config + tests are complete and ready.

## Commands

```bash
npm run test:providers
npm run test:capture
npm run test:codebuddy-capture
npm run test:opencode-capture
npm run test:trae-capture
npm run test:chatgpt-import

npm run capture:import:codebuddy <transcript-dir-or-index.json>
npm run capture:import:codex     <~/.codex/sessions/...jsonl>
npm run capture:import:opencode  <opencode-export.json>
npm run capture:import:opencode  -- --inbox <inbox.jsonl>
```
