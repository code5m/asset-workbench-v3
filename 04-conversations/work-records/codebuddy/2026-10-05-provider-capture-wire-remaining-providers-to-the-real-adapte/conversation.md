# Provider capture: wire remaining providers to the real adapter/kernel chain

- Source: codebuddy
- Captured: 2026-10-04T18:12:16.708Z
- ID: conv_d20d8a09-7585-4896-9700-9b88fcf4fd35
- Capture Mode: agent-work-record

## Content

## Task

Provider capture: wire remaining providers to the real adapter/kernel chain

## Context

Connected CodeBuddy to the existing provider-neutral Capture Kernel through its official lifecycle hooks and official session transcript, and resolved every other provider to an honest terminal state.

## Investigation

Probed the real machine instead of trusting prior conclusions. Codex 0.149.0 (hooks, already verified). CodeBuddy 2.127.0: the installed bundle contains SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/PostToolUseFailure/PreCompact/Stop/SubagentStart/SubagentStop/SessionEnd and delivers {session_id, transcript_path, cwd, hook_event_name, tool_name, tool_input, tool_response, generation_id, model, agent_type, client, version}; Stop carries last_assistant_message. Print mode (-p) fails with 'default agent undefined is not registered' and ACP session/new returns -32000 'Authentication required', so new sessions cannot be created unattended. CodeArts 26.9.3 rejects every command with '认证失败，没有设置环境变量CODEARTS_CLI_AK/CODEARTS_CLI_SK'. OpenCode: no executable found anywhere (only a leftover ~/.local/share/opencode DB which is deliberately unused). Trae CN 1.107.1 is installed but exposes only editor options; no AI session CLI, hook names, or export.

## Findings

CodeBuddy hooks are a valid realtime data line and merge into one CaptureSession keyed by session_id (821 real events: 5 user.message, 183 assistant.message, 317 tool.started, 316 tool.completed; zero sequence gaps, zero duplicate canonical events). The hook payload's transcript_path points at the provider's own official transcript (index.json + messages/*.json), giving full-fidelity user/assistant text. The provider re-emits the leading prompt under a new message id, so exact-content dedupe was added. Tool events stay outside the chat body.

## Changes

- scripts/capture-provider-event.ts: provider-aware hook entry (--provider / env / payload), carries provenance
- server/providerAdapterService.ts: provider-generic event mapping, deterministic tool identities, subagent isolation, CodeBuddy official transcript importer with exact-duplicate suppression, evidence-based detectProviders
- .codebuddy/settings.json: official CodeBuddy lifecycle hook config (fail-open, async)
- scripts/import-codebuddy-history.ts + npm run capture:import:codebuddy
- scripts/test-codebuddy-capture.ts + npm run test:codebuddy-capture
- docs/provider-capture.md, 03-docs/guides/provider-adapters.md, AGENTS.md, README.md updated with real verified status

## Verification

- test:providers PASS
- test:capture PASS
- test:codebuddy-capture PASS (7 checks)
- test:agent 19 passed
- test:transcript PASS
- test:managed 13 passed
- npm run build PASS
- git diff --check clean; .codex/hooks.json untouched (no Codex regression)
- Real CodeBuddy E2E: capture session capture_40126a9f-c8de-4cb0-b505-f78330f133e2 -> transcript_43321d8a-e596-44ac-978a-e311e4fd821d

## Outcome

Codex ENABLED (unchanged, no regression). CodeBuddy ENABLED with runtimeVerified=true from a real 821-event session and a materialized transcript. CodeArts BLOCKED (credentials). OpenCode NOT_INSTALLED. Trae UNSUPPORTED (no official interface). ChatGPT LIMITED (import only).

## Follow-up

(Captured by Agent Knowledge Capture Protocol; outstanding follow-up is tracked in the AgentSession.)
## Related Assets

- server/providerAdapterService.ts
- scripts/capture-provider-event.ts
- scripts/import-codebuddy-history.ts
- scripts/test-codebuddy-capture.ts
- .codebuddy/settings.json
- docs/provider-capture.md
- 03-docs/guides/provider-adapters.md
- AGENTS.md
- README.md
- package.json
