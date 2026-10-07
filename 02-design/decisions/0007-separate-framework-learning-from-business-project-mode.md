# Decision: Separate framework learning from business project mode

Status: accepted

## Context

The user uses Asset Workbench not only to operate on projects, but also to learn
how the framework itself works so they can understand, optimize, and evolve it.

A screenshot of the Workspace Console showed `asset-workbench-v3` itself as the
active scanned project and Git repository. That presentation blurred two distinct
roles:

- framework source used for self-learning and framework iteration;
- real business project used for study and knowledge work.

The same discussion also clarified that the current `Starter` terminology is
misleading: its implementation initializes knowledge structure only and is not
Spring Boot Starter or a full Workbench instance generator.

## Decision

Adopt an explicit two-mode product model:

1. **Framework Self Mode** — the Asset Workbench source repository is available
   for learning, self-checking, and framework improvement.
2. **Business Project Mode** — one Workbench instance is bound to one external
   real business system.

At the current stage, one Workbench instance should bind one business system.

The Framework page is a first-class visual learning surface. Its primary model is:

```text
Framework
-> Instance / CLI
-> One Project Binding
-> Knowledge
<-> Provider
-> Evolution
```

Technical package names are secondary implementation details.

The current `packages/starter` capability is presented as **Project Knowledge
Initialization / Knowledge Init**. A complete Workbench instance CLI/scaffold is a
future capability and must not be implied as already implemented.

## Rationale

- The user must understand the framework visually before they can safely improve it.
- One business system per instance keeps project knowledge comprehensible.
- Framework source remains useful for dogfooding without contaminating the
  business-project mental model.
- Honest Starter semantics avoid Java/Spring/Maven conceptual confusion.
- The separation creates a clean foundation for future framework distribution,
  migrations, and governed RSI.

## Consequences

- Runtime config exposes `framework-self` vs `business-project`.
- Console does not show framework Git/repository facts as business project facts.
- Asset Space labels framework-self assets explicitly.
- Guide makes one-instance-one-business-system explicit.
- Framework page prioritizes six product roles and collapses package-level detail.
- Existing package names remain stable for compatibility.
- Future full instance/CLI work must be separately designed and implemented.

## Sources

- Conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot
- Design: 02-design/workbench-instance-model/framework-learning-and-one-project-instance-v1.md

## Related assets

- server/config.ts
- src/components/WorkspaceConsole.tsx
- src/components/AssetExplorer.tsx
- src/components/GuidePage.tsx
- src/components/FrameworkPage.tsx
- src/components/StarterCreator.tsx
