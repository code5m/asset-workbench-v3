# Creator Instance Lifecycle v1

Status: implemented design

## Goal

Complete the Creator capability family without changing the one-instance / one-business-system mental model:

```text
Creator
├── Knowledge
│   ├── create
│   └── verify
└── Instance
    ├── create
    ├── status
    ├── verify
    ├── upgrade-plan
    ├── upgrade-apply
    └── rollback
```

The UI remains the normal user entry. CLI and Agent automation call the same core.

## What an Instance is

An Instance is a **logical, version-aware Workbench identity bound to one external business project**.

It is not a copy of the Asset Workbench source repository.

Creating an Instance writes only Workbench runtime/lifecycle state below:

```text
<business-project>/
└── .asset-workbench-data/
    └── instance/
        ├── manifest.json
        ├── plans/
        │   └── <planId>.json
        ├── migrations/
        │   └── <migrationId>.json
        └── backups/
            └── <migrationId>/
                └── manifest.json
```

The directory is already Scanner-ignored / git-ignored runtime state.

## Instance Manifest

The Manifest records:

- schema version;
- stable Instance id;
- business project root + name;
- created / updated time;
- generation;
- Framework version;
- Framework Git revision;
- Creator capability versions;
- Knowledge status;
- last migration id.

The current capability versions are explicit and independent:

- Knowledge
- Instance
- Upgrade
- Migration

This is the basis for later capability-specific migrations.

## Create

Instance creation:

1. resolves and validates the target directory;
2. rejects Framework Self as a target;
3. rejects duplicate Instance creation;
4. optionally initializes Knowledge only when the target is empty apart from Workbench runtime state;
5. writes an atomic Manifest;
6. can then bind the project as the current Business Project from the UI.

Existing business code is never generated, copied, or rewritten.

## Verify

Verification checks:

- Manifest schema;
- Manifest project root identity;
- Instance state;
- Framework version/revision presence;
- every required capability version;
- real Knowledge filesystem state when the Manifest claims Knowledge is verified;
- current Framework vs Instance version identity.

Verification distinguishes:

- `ok`: the Instance structure is valid;
- `upToDate`: the valid Instance matches the current Framework identity.

## Upgrade plan

Upgrade is two-phase.

### Plan

Compare the current Instance Manifest to the current Framework identity and produce an immutable plan with:

- source Manifest digest;
- Framework version changes;
- Framework revision changes;
- capability version changes;
- status `noop | ready | applied`.

The plan is written before any apply.

A stale plan is rejected if the Manifest changes after planning.

### Apply

Apply:

1. re-reads the plan and current Manifest;
2. verifies Instance ownership and source digest;
3. computes the next Manifest/generation;
4. writes the old Manifest to a migration backup;
5. writes a prepared migration record;
6. atomically writes the new Manifest;
7. marks migration and plan applied.

This v1 migrates **Workbench Instance lifecycle metadata/version identity**.
It does not rewrite business code.

## Migration evidence

Each applied upgrade records:

- migration id;
- plan id;
- Instance id;
- before / after digests;
- exact upgrade actions;
- full before / after Manifest;
- backup path;
- applied time;
- rollback status/time.

This gives an auditable chain without pretending a business-code migration occurred.

## Rollback

Rollback is deliberately conservative:

- only a migration in `applied` state can roll back;
- it must belong to the current Instance;
- only the current Manifest's latest migration can roll back;
- current Manifest digest must still match the migration result;
- rollback restores the exact pre-upgrade Manifest;
- migration is then marked `rolled-back`.

After rollback, a new upgrade plan can be generated.

## UI

Creator Workbench now presents all four lifecycle capabilities as available:

- Knowledge Creator
- Instance Creator
- Upgrade
- Migration / Rollback

The Instance lifecycle panel provides:

- target business project;
- optional name;
- optional Knowledge initialization;
- create;
- load status;
- verify;
- plan upgrade;
- apply upgrade;
- rollback latest migration;
- real Manifest/version/capability state;
- real verification results;
- real plan actions;
- migration evidence.

The browser still never executes arbitrary shell commands.

## CLI

Repository-local commands:

```bash
npm run creator -- instance create --project <directory> [--name <name>] [--init-knowledge]
npm run creator -- instance status --project <directory>
npm run creator -- instance verify --project <directory>
npm run creator -- instance upgrade-plan --project <directory>
npm run creator -- instance upgrade-apply --project <directory> --plan <plan-id>
npm run creator -- instance rollback --project <directory> [--migration <migration-id>]
```

Framework version/revision overrides exist only for explicit test/automation scenarios.

## Safety / non-goals

v1 explicitly does not:

- copy `src/server/packages` into business projects;
- expose arbitrary shell from React;
- automatically edit business source code;
- automatically execute database/schema migrations;
- aggregate multiple business projects into one Instance;
- implement autonomous RSI.

Future business-code or schema migrations must be separate versioned capabilities with
their own preconditions, backups, verification, and rollback evidence.

## Verification

Automated tests cover:

- real Manifest creation;
- Framework Self rejection;
- preservation of existing business files;
- no-op upgrade;
- version + capability upgrade planning;
- apply + migration evidence + backup;
- up-to-date verification;
- rollback;
- CLI create -> plan -> apply -> verify -> rollback E2E;
- UI/API/Core wiring;
- no arbitrary shell in browser UI.


## Self Test acceptance surface

Creator Workbench exposes a one-click **Instance Lifecycle Self Test**.

The browser does not execute shell commands. The button calls the typed Local API,
which invokes `runInstanceLifecycleSelfTest()` in Creator Core.

The self test creates an isolated OS temporary business project and automatically
checks:

1. Instance create with deliberately old Framework identity;
2. pre-upgrade verify is valid but `upToDate=false`;
3. Upgrade Plan contains real version/revision differences;
4. Upgrade Apply moves generation 1 -> 2;
5. migration evidence contains before/after digests;
6. Manifest backup exists;
7. post-upgrade verify becomes `upToDate=true`;
8. rollback restores generation 1 and the old Framework identity;
9. post-rollback verify returns `upToDate=false`;
10. a sentinel business file is unchanged;
11. the configured Framework Self root is rejected as an Instance target;
12. all temporary project/lifecycle state is removed.

The UI renders every step as PASS/FAIL and emits `SELF_TEST_PASS` only when all
required steps pass.

The same Core is available for automation through:

```bash
npm run creator -- instance self-test
```

The self test never binds or mutates the user's current real business project.

## Capability-status truth

The four Version & Upgrade teaching cards now describe already implemented v1
behavior and therefore render as **available**:

- discover version differences;
- create upgrade plan;
- verify lifecycle state;
- rollback latest applied migration.

The following remain explicitly planned and must not be represented as implemented:

- automatic business-code migration;
- database Schema migration;
- automatic cross-version source rewriting.
