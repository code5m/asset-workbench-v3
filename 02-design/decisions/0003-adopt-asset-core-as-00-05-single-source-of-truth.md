# Decision: Adopt Asset Core as the 00–05 single source of truth

Status: accepted

## Context

The repository already defined the standard 00–05 project knowledge structure in `packages/asset-core/src/index.ts` as `DEFAULT_ASSET_SKELETON`. Starter and Framework UI consumed it, but `server/assetService.ts` kept a second hard-coded `EXPECTED_SKELETON`.

The duplication was discovered during a beginner-oriented conversation about whether the “skeleton” was only for future projects.

## Decision

`packages/asset-core::DEFAULT_ASSET_SKELETON` is the canonical source of truth for the standard 00–05 project knowledge structure.

Consumers include:

- current-workspace skeleton checks in `server/assetService.ts`;
- Framework UI explanation/display;
- Starter project creation.

No consumer may maintain a second hard-coded 00–05 list.

Asset Core **defines the standard**. Starter **creates a new project from that standard**.

## Rationale

- Prevent semantic drift between server, UI, and Starter.
- Make the package boundary real rather than documentary.
- Match the beginner mental model with the actual architecture.
- Ensure future structure changes happen in one place.

## Consequences

- Server imports `DEFAULT_ASSET_SKELETON`.
- The duplicate `EXPECTED_SKELETON` constant is removed.
- Tests must fail if the server reintroduces a local hard-coded skeleton.
- Beginner UI should describe Asset Core as the current project knowledge structure, not a future-only scaffold.

## Sources

- Conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot
- Work Record: conv_chatgpt_20261007_framework_asset_core_ssot

## Related Assets

- packages/asset-core/src/index.ts
- packages/starter/src/index.ts
- server/assetService.ts
- src/components/FrameworkPage.tsx
- src/i18n/translations.ts
