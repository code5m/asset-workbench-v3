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


## Independent V3 runtime (shared Framework)

A logical Instance can now be launched as its own local **process** (not a repository copy).
The central Creator uses typed `/api/creator/runtime/status|start|stop` actions.
Each spawned runtime binds to `127.0.0.1` on a dedicated ephemeral port and uses the
already-built shared V3 frontend and Vite preview backend. It is pinned via
`AWB_INSTANCE_PROJECT_ROOT` to the matching Instance Manifest, and the root-switch
API refuses to change its project. The UI provides Start, Stop, Status and Open.

- **Framework source:** one repository / one build; never copied into a business checkout.
- **Per-project knowledge and records:** each business root keeps its own 00–05 assets
  and `.asset-workbench-data` state (capture records, Provider preferences, Instance Manifest).
- **Secrets:** independent runtimes scope OS Keyring provider IDs using a stable
  SHA-256 project-root prefix; secrets are never copied into files or between projects.
- **Runtime inventory:** the central app stores local process/port records under
  `.asset-workbench-data/instance-runtimes`; a PID is not stopped unless its
  loopback API confirms the matching Instance identity.
- **Version handling:** Start requires Instance verification and matching current
  Framework identity. Existing upgrade plan/apply and Manifest rollback are preserved.
  To change the shared V3 code, update/build the central Framework and then use
  explicit per-Instance upgrade plans before starting outdated instances.
- **Isolation scope:** separate OS processes, project roots and local ports, not
  containers or OS sandboxing. The same logged-in OS account and Framework build
  are trusted. This is not an internet-facing multi-tenant service.
- **Performance:** UI dist is shared, but each running Instance uses an additional
  lightweight local Vite preview process. Stop unused instances to release memory.

**Lifecycle:** create a logical Instance → build the central V3 (`npm run build`)
→ inspect the Instance → start → open the independent URL → stop.
This implementation does not create autonomous remote servers or copy the business
code, and does not rewrite a business repository on upgrade.


## Immutable standalone Framework release (architecture decision, October 2026)

Central Framework keeps one source repository, but the end-user runtime is not a
Vite Preview service. Central release publishing now creates a content-addressed
`framework-releases/rel-<digest>` directory containing a frozen React `ui/`,
standalone bundled Node `server.mjs`, and `release.json` with SHA-256 hashes
of each deliverable. Publishing first runs the real build, verifies the frozen
release, and changes the current release pointer only after the release is
complete. If the directory exists, its contents must verify before it can be used.
There is no per-instance `npm ci` / `npm run build`.

Runtime manager checks the release and Instance Manifest before launching Node
against its published `server.mjs`. Every Instance has a separate local port,
process, captured project root, session and assets directory. Only loopback
requests with the expected Host header are accepted. Private token-gated health
check confirms PID, Instance identity, project identity, and immutable release
identity; an unrelated PID must never be killed.

User actions: **Publish runtime** (central only), **Start**, **Status**, **Open**,
**Stop**. The application runs locally; the scheme is not multi-tenant public
hosting or an isolated operating-system security sandbox.

### Boundaries and remaining work

The published release is immutable and verified with checksums; this is a local
build integrity check, not cryptographic code-signing or an official GitHub
Release package. The central source and Node executable remain prerequisites
for publishing / launching, though instances no longer need Vite Preview.
Cross-platform installation packages, remote distribution, automatic GitHub
Release downloading, and code-signed installer delivery remain future work.
A local runtime may now pin a verified published release, adopt a second release
and health-check the new process. Failure to start a new release triggers
reinstatement of the prior version and a restart attempt. **Rollback app release**
is a separate action from Creator's existing **Rollback Manifest**. Both
read from separate records. Application-level rollback is covered by a real
build-switch test that changes the served HTML and checks restoration.
This is a local-runtime A/B version path, not an OS package installer or a
guarantee of restoration from hardware failure.

Safety: one shared source, no copying code to business repositories; runtime
state remains in the user-selected project. Verify behavior with real end-to-end
tests, not documentation-only assertions.

## Workbench startup UX: one daily action, explicit advanced lifecycle (2026-10-10)

**Product rule:** a business user chooses the project directory once, then creates/starts the Workbench, then opens it. The everyday action must never silently adopt a new runtime build or change business source files.

| Scenario | Normal user action | System behavior |
| --- | --- | --- |
| New business project with no Instance | Create or start Workbench | Create Manifest, publish shared Framework release only if none exists, start pinned runtime; show Open link |
| Existing stopped Instance | Start Workbench | Read existing Manifest, reuse the pinned release and start without publishing or adopting a newer release |
| Existing running Instance | Open Workbench | Open its local URL in a new tab without a second launch |
| No published central release | First-time start | Publish and verify a release automatically, then start |
| Framework source changed | Advanced: Publish Framework release | Produce a new immutable central release; running Instances are not automatically changed |
| Intentional upgrade | Advanced: Adopt latest release | Explicitly switch selected Instance, verify health and preserve rollback evidence |
| Recovery | Advanced: Rollback app release | Switch only when an actual previous release is recorded |

**UI information architecture:** list existing Workbenches first; one guided project path → prepare/start → Open sequence; optional Instance name and 00–05 knowledge initialization collapsed; advanced lifecycle controls and CLI collapsed separately. The standalone sandbox self-test remains separate from real-project actions.

**Precise terminology:** `Publish Framework release` builds a shared application release, `Create Instance` writes only the Instance identity, `Start Workbench` launches a process without navigating the browser, and `Open Workbench` navigates to the running Instance. For nontechnical users, only the guided Create/Start and Open steps are the primary call to action.

**Acceptance requirement:** frontend static checks plus the existing real independent-process E2E. Screenshot/browser usability checks should be recorded separately; automated CI is not a substitute for manual GUI evidence.
