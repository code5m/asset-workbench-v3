# Provider final wiring: OpenCode install+adapter+E2E, Trae hook re-verification, ChatGPT boundary, CodeBuddy audit

- Source: codebuddy
- Captured: 2026-10-04T19:10:06.983Z
- ID: conv_4c95a201-f2dd-43c3-9a38-93fb5f3bdc30
- Capture Mode: agent-work-record

## Content

## Task

Provider final wiring: OpenCode install+adapter+E2E, Trae hook re-verification, ChatGPT boundary, CodeBuddy audit

## Context

Installed OpenCode with a real E2E, overturned the Trae UNSUPPORTED verdict by proving official workspace hooks exist, fixed a transcript classification bug, and audited the CodeBuddy assistant-message count.

## Investigation

Re-probed the real machine. Network was down (proxy 127.0.0.1:7897 dead); restarting the user's Clash Verge client restored it, after which `npm i -g opencode-ai` installed OpenCode 1.18.34 (a stale dangling AppImage symlink had to be replaced). OpenCode exposes free `opencode/*` models, so no paid credential was needed. Trae: `command -v trae` finds nothing, but /usr/share/trae-cn/resources/app/modules/ai-agent/libai_agent.so contains SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PreCompact, Stop, Notification and payload fields hook_event_name/session_id/prompt/last_assistant_message/stop_hook_active, and the workbench bundle references a real `.trae/hooks.json` asset — so the previous UNSUPPORTED verdict was wrong. No SessionEnd exists in the Trae build. ChatGPT: desktop app present, no conversations.json/export, no OPENAI_API_KEY, no agents webhook. CodeArts: CODEARTS_CLI_AK/SK still missing (same auth error).

## Findings

OpenCode real E2E: 3 turns with two real bash tool calls, 161 live plugin events merged into 8 canonical events, 0 sequence gaps, transcript verified by reading it. A role bug was found and fixed: live plugin events carry no role on the part, so user prompts were attributed to the assistant; roles now come from message.updated -> properties.info.role, and sequences are monotonic across successive imports. Trae hooks are configured fail-open in .trae/hooks.json with the adapter wired, but no real Trae event can be observed without an interactive logged-in Trae IDE session. A classification bug was fixed: metadataRelForContent mapped transcript.md to transcript.metadata.json while createTranscript writes metadata.json, so transcripts were misclassified as plain conversation. CodeBuddy Red Team: 183 assistant messages are 183 distinct contents with 0 prefix-growth and 0 containment pairs — genuine inter-tool narration in a long agentic run, not streaming fragmentation.

## Changes

- scripts/import-opencode-session.ts + npm run capture:import:opencode (official export and plugin inbox drain)
- .opencode/plugins/awb-capture.js: official fail-open OpenCode capture plugin
- .trae/hooks.json: official fail-open Trae workspace hooks (no SessionEnd invented)
- server/providerAdapterService.ts: OpenCode adapter with semantic stream merge, role resolution, monotonic sequences; detection evidence for opencode/trae
- server/managedAssetService.ts: transcript.md now resolves to metadata.json (classification fix)
- scripts/test-opencode-capture.ts, scripts/test-trae-capture.ts, scripts/test-chatgpt-import.ts + package scripts
- docs/provider-capture.md, 03-docs/guides/provider-adapters.md, AGENTS.md, README.md updated with verified-only status

## Verification

- test:providers PASS
- test:capture PASS
- test:codebuddy-capture PASS
- test:opencode-capture PASS
- test:trae-capture PASS
- test:chatgpt-import PASS
- test:agent PASS
- test:transcript PASS
- test:managed PASS
- npm run build PASS
- OpenCode real E2E: capture_3b2f7bba-3d9f-485f-a771-06bb9586c225 -> transcript_0426f9c9-3361-48d7-99b7-7888e1dc738c

## Outcome

Codex ENABLED (regression-free). CodeBuddy ENABLED (realtime PASS; auto SessionEnd NOT_RUNTIME_VERIFIED). OpenCode ENABLED with runtimeVerified=true. Trae LIMITED (hooks supported+configured; no real event observed; finalization LIMITED). CodeArts BLOCKED (credentials). ChatGPT LIMITED (explicit import only).

## Follow-up

(Captured by Agent Knowledge Capture Protocol; outstanding follow-up is tracked in the AgentSession.)
## Related Assets

- server/providerAdapterService.ts
- server/managedAssetService.ts
- scripts/import-opencode-session.ts
- scripts/test-opencode-capture.ts
- scripts/test-trae-capture.ts
- scripts/test-chatgpt-import.ts
- .opencode/plugins/awb-capture.js
- .trae/hooks.json
- docs/provider-capture.md
- 03-docs/guides/provider-adapters.md
- AGENTS.md
- README.md
- package.json
