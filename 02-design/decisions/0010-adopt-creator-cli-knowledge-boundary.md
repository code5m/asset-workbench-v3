# Decision: Use Creator as the shared UI/CLI execution boundary and Knowledge as its first capability

Status: accepted

## Context

The visual Framework Learning Console already established that UI is the primary
beginner control surface and CLI is the automation layer underneath.

The existing Knowledge Init feature was real but fragmented in how it was
understood:

- the UI could initialize a target;
- `npm run starter:create` could initialize a target;
- tests could exercise `createStarter()`;
- the Framework console still described CLI mostly as a future concept.

The user asked whether CLI could be understood as "Creator CLI Knowledge" and
whether page buttons could execute the capability, create real directories/files,
and automatically verify the result.

## Decision

Adopt **Creator** as the shared execution capability family.

Implement **Knowledge** as its first real sub-capability:

```text
Creator
└── Knowledge
    ├── create
    └── verify
```

UI, Local API, CLI, Agent automation, and tests must reuse the same core functions.

The browser UI must not execute arbitrary shell commands. It calls the Local API,
which calls the Creator Knowledge core. The CLI calls the same core directly.

Keep full **Creator Instance** explicitly planned until Instance Manifest, version
identity, and lifecycle semantics are genuinely implemented.

## Consequences

- Knowledge create and verify are real executable capabilities now.
- The UI can show actual execution and verification results.
- The repository has a real Creator CLI surface without pretending a packaged
  global binary exists.
- `packages/starter` remains for compatibility; product terminology can prefer
  Knowledge Creator / Knowledge Init.
- Future Instance creation should extend the Creator family rather than invent a
  separate unrelated CLI architecture.
- Arbitrary shell execution is not exposed to the frontend.

## Related decisions

- Decision 0003 — Asset Core is the canonical 00–05 source of truth.
- Decision 0008 — Visual-first framework management.
- Decision 0009 — Visual Framework Learning Console.

## Related assets

- 02-design/framework-learning/creator-cli-knowledge-v1.md
- packages/starter/src/index.ts
- scripts/creator-cli.ts
- server/assetPlugin.ts
- src/services/assetClient.ts
- src/components/StarterCreator.tsx
- src/components/FrameworkLearningConsole.tsx
- scripts/test-framework-starter-v1.ts
- scripts/test-framework-ui-v1.ts
