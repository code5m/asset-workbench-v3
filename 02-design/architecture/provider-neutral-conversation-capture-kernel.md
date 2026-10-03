# Provider-neutral conversation capture kernel

- Type: design
- Created: 2026-09-30T07:28:16.409Z
- ID: design_abc5f60b-02d2-4205-8172-d5544817efb4

## Context

## Goals

## Proposed Design

## Problem\n\nFuture providers must not write conversation assets directly.\n\n## Context\n\nManaged Transcript and Agent Work Record are already distinct persisted assets.\n\n## Goals\n\nPreserve raw provider events, normalize a stable event contract, expose sequence quality, and materialize only through Managed Asset Service.\n\n## Proposed Design\n\nA CaptureSession owns append-only raw-events.jsonl, events.jsonl, and state.json. The Capture API accepts only provider-neutral data. On end, TranscriptMaterializer produces a managed transcript and optionally links the AgentSession.\n\n## Risks\n\nNo provider adapter is included; provider delivery guarantees are deferred.\n\n## Sources\n\nUser-approved Capture Kernel implementation task.

## Sources

- Conversation: conv_720b146e-2843-4e68-ad7a-c3f889ffcd05

## Related Assets

- server/captureService.ts
- server/assetPlugin.ts
- src/domain/asset.ts
- src/components/AssetExplorer.tsx
- README.md
- docs/product-skeleton.md
- AGENTS.md
- scripts/test-capture-kernel.ts
- package.json
