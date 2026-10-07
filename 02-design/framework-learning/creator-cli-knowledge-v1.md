# Creator CLI / Knowledge v1

Status: implemented design

## Goal

Turn the existing Knowledge Init capability into the first real Creator capability that
can be operated from the visual UI, invoked from automation/CLI, and independently
verified without duplicating filesystem logic.

The beginner-facing product model is:

```text
Visual UI
   |
   +----> Creator API ----+
   |                      |
Agent / automation        v
   |               Creator Knowledge Core
   +----> Creator CLI ----+
                          |
                          v
                 create -> verify -> result
```

## Naming model

"Creator" is the capability family.

The first implemented sub-capability is:

```text
Creator
└── Knowledge
    ├── create
    └── verify
```

This deliberately does **not** claim that a full Workbench Instance Creator exists.

Future expansion may add:

```text
Creator
├── Knowledge   ✅ implemented
└── Instance    ◌ planned
```

## Shared core

`packages/starter/src/index.ts` remains the compatibility package, but its runtime
responsibility is now clearer:

- `createStarter()` — backward-compatible skeleton writer;
- `verifyKnowledge()` — read-only validation of the canonical knowledge structure;
- `createKnowledge()` — create then verify, returning one structured result.

UI, Local API, CLI, and tests reuse those functions rather than invoking shell
commands from React or reimplementing filesystem behavior.

## CLI

Repository-local executable interface:

```bash
npm run creator -- knowledge create --target <directory> [--name <project-name>]
npm run creator -- knowledge verify --target <directory>
```

The intended future packaged shape is:

```bash
asset-workbench creator knowledge create ...
asset-workbench creator knowledge verify ...
```

The repository-local command is real today; the packaged executable is not claimed
as shipped yet.

## Local API

The UI uses:

- `POST /api/creator/knowledge/create`
- `POST /api/creator/knowledge/verify`

The historical `POST /api/starter/create` route remains as a compatibility alias
and delegates to the same Creator Knowledge core.

## Visual management

The Knowledge Creator UI:

1. accepts a target directory and optional project name;
2. creates the canonical 00–05 knowledge skeleton;
3. immediately verifies every required file/directory;
4. shows per-entry PASS/FAIL in the page;
5. can re-run verification without modifying the target;
6. can bind a newly created target as the current business project.

The Framework Learning "Instance / CLI" tab embeds this real operation instead of
showing only conceptual future commands.

## Safety

- create requires an absent or empty target;
- verify is read-only;
- the UI never executes arbitrary shell text;
- CLI and UI call the same typed core;
- no Provider configuration, Transcript evidence, E2E evidence, Instance Manifest,
  upgrade state, migration, or rollback state is fabricated.

## Verification

Automated coverage includes:

- direct Creator Knowledge core create/verify;
- deliberate missing-directory failure;
- real repository-local CLI create then verify in a temporary directory;
- UI -> client -> Local API -> core wiring regression;
- current vs future CLI wording and bilingual copy.

## Non-goals

This version does not implement:

- full Workbench Instance Creator;
- Instance Manifest;
- packaged global `asset-workbench` executable;
- Framework version pinning;
- upgrade/migration/rollback orchestration;
- arbitrary command execution from the browser.
