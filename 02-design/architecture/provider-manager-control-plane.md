# Provider Manager Control Plane

- Type: design
- Created: 2026-10-05T03:14:39.405Z
- ID: design_dd1decff-0330-4805-b6be-d6d4eaaec2dd

## Context

## Goals

## Proposed Design

Problem: each new provider duplicated discovery, status, configuration, and verification work. Design: Provider Definitions describe provider capability while Provider Runtime manages discovery, authentication, finalization, verification, enablement, and UI status. Capture Kernel stays unchanged as the data plane. Generic mapping covers ordinary providers; builtin custom transformers remain for semantic streaming providers. Credentials are process-memory only and injected only into verification commands. Migration is incremental so existing adapters remain active.

## Sources

- Conversation: conv_2e8ebbd1-5a08-4fdb-b16b-f75a6f6eab63

## Related Assets

- server/providerPlatformService.ts
- server/assetPlugin.ts
- src/components/ProviderManager.tsx
- src/services/assetClient.ts
- src/domain/workspace.ts
- src/data/navigation.ts
- src/App.tsx
- src/styles.css
- scripts/test-provider-platform.ts
- docs/provider-integration-platform.md
- README.md
- package.json
