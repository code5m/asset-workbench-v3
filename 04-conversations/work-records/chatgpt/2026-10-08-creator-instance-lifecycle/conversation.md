# Creator Instance Lifecycle v1 implementation

- Source: ChatGPT
- Capture mode: agent-work-record
- Conversation evidence: current ChatGPT discussion, partial
- Date: 2026-10-08

## Trigger

The user saw Instance Creator, Upgrade, and Migration / Rollback still marked planned
in Creator Workbench and requested that all three be implemented together in unattended
mode.

## Investigation

Confirmed on main:

- Knowledge Creator create/verify was real;
- Creator Workbench was already the operational surface;
- Instance / Manifest / Upgrade / Migration / Rollback were still explicitly planned;
- runtime already enforced Framework Self vs one external Business Project;
- `.asset-workbench-data` is Scanner-ignored runtime state;
- existing UI never executes arbitrary shell.

## Implemented

- new `packages/creator-core/src/index.ts`;
- Instance Manifest + capability versions + generation;
- Framework Self rejection;
- Instance create/status/verify;
- Upgrade plan with source digest and no-op detection;
- Upgrade apply with atomic Manifest write;
- migration evidence;
- Manifest backup;
- latest-applied-migration rollback;
- Knowledge truth re-verification when Manifest claims verified;
- Local API endpoints;
- typed frontend client;
- Creator CLI lifecycle commands;
- Creator Workbench Instance lifecycle panel;
- Framework Learning real status and Manifest version visualization;
- Creator Core directory/key-file learning;
- bilingual UI and responsive styles;
- Core + CLI E2E and UI/API regression gates;
- AGENTS / docs / Decision current truth.

## Explicit boundary

The lifecycle migrates Workbench Instance metadata/version identity only.
It does not automatically rewrite Java/Node/Python/Rust business code or database
schemas. Those remain future explicit, versioned migration capabilities.

## Verification target

- npm run test:creator-instance-v1
- npm run test:framework-ui-v1
- npm run check
- branch CI
- PR merge
- main CI
