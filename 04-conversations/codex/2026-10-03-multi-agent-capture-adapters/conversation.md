# Multi-Agent Capture Adapters

- Source: codex
- Captured: 2026-10-03T03:29:38.146Z
- ID: conv_47715d3e-bc8f-4622-8fb4-860a8f357852
- Capture Mode: agent-work-record

## Content

## Task

Multi-Agent Capture Adapters

## Context

Delivered a provider-neutral adapter layer and a verified Codex automatic capture path.

## Investigation

Checked installed CLI capabilities, official Codex hook events, local runtime state, and real Hook payloads. Verified CodeBuddy ACP and stream JSON options, CodeArts ACP and export options, and the absence of reliable local feeds for ChatGPT, Trae, and OpenCode.

## Findings

Codex lifecycle Hooks expose session, user-prompt, tool, and final-assistant events. Concurrent start and prompt hooks require a per-provider-session lock. A transcript with no message events must be partial.

## Changes

- Added provider adapter service and status API
- Added trusted-project Codex Hook configuration and fail-open runner
- Added safe Codex JSONL importer with ordinal deduplication
- Added welcome-page provider status and operator guide
- Added adapter, kernel, build, HTTP, and live Codex verification

## Verification

- npm run test:providers PASS
- npm run test:capture PASS
- npm run build PASS
- GET /api/providers shows Codex ENABLED and runtimeVerified true
- Real Codex session materialized a full user/assistant transcript with raw Hook payloads

## Outcome

Codex is ENABLED and runtime verified. Other providers are accurately reported as LIMITED or NOT_INSTALLED until a real authenticated live feed is configured.

## Follow-up

(Captured by Agent Knowledge Capture Protocol; outstanding follow-up is tracked in the AgentSession.)
## Related Assets

- .codex/hooks.json
- server/providerAdapterService.ts
- server/captureService.ts
- server/assetPlugin.ts
- scripts/capture-provider-event.ts
- scripts/import-codex-history.ts
- scripts/test-provider-adapters.ts
- src/components/WelcomePage.tsx
- src/services/assetClient.ts
- 03-docs/guides/provider-adapters.md
- README.md
- AGENTS.md
