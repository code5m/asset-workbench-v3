# Provider Adapter Boundary and Codex Hook Capture

- Type: design
- Created: 2026-10-03T03:29:38.162Z
- ID: design_f2adac95-f21e-4b47-b14d-b59313cfc74a

## Context

## Goals

## Proposed Design

Problem: the Capture Kernel accepted canonical events but no platform delivered real conversations. Design: adapters map provider lifecycle payloads to canonical events and only the Capture Kernel materializes transcripts. Codex uses trusted project Hooks for session start, user prompts, tool completions, final assistant responses, and session end. A durable per-provider-session mapping prevents split streams from concurrent hooks. Limits: CodeBuddy and CodeArts have CLI capability evidence but no configured live subscriber; ChatGPT, Trae, and OpenCode have no verified automatic feed. Therefore UI status remains explicit and non-deceptive.

## Sources

- Conversation: conv_47715d3e-bc8f-4622-8fb4-860a8f357852

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
