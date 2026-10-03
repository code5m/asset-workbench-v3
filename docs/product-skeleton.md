# Asset Workbench V3 Product Skeleton

## Positioning

Asset Workbench V3 is a reusable project asset workbench. It should help a user
onboard a business project through plain-language introduction, guided import,
asset browsing, and a deeper technical console.

The product must not start by showing internal terms such as
`RepositoryRevision`. It should first explain the user's job:

- find project materials;
- confirm where they came from;
- freeze a version;
- generate searchable assets.

## Boundary

- Workspace is the system boundary.
- Repository is a member of the workspace.
- WorkspaceVersion is the immutable workspace-level fact record.
- RepositoryRevision is the immutable repository-level fact record.
- Raw source artifact is the verified storage unit.
- Diff, module discovery, code model, graph, and retrieval are derived results.

## Project Asset Space

The top-level model is Project Workspace. Code is only one asset family.

```text
Project Workspace
├── 01-code
├── 02-design
├── 03-docs
├── 04-conversations
└── 05-derived
```

Asset family meanings:

- `01-code`: source code, Git repositories, Raw, versions, and file diffs.
- `02-design`: architecture blueprints, product plans, technical designs, ADRs.
- `03-docs`: README, manuals, requirement documents, reports, and drafts.
- `04-conversations`: ChatGPT, Codex, CodeBuddy, and human discussion records.
- `05-derived`: CodeGraph, semantic indexes, summaries, tags, and knowledge graph.

### Managed Knowledge Assets: Conversation / Design / Decision

`04-conversations`, `02-design`, and `02-design/decisions` are writable managed
knowledge areas. The three types are distinct semantic layers, NOT three
directories with the same format:

- **Conversation** is split into two distinct `managedType`s (the dual evidence
  model), classified by each asset's `metadata.json` (not by path alone):
  - **Agent Work Record** (`agent-work-record`, `conversation.md` +
    `metadata.json` under `04-conversations/{source}/<date>-<slug>/`) = the
    Agent's structured record of one task. Always produced for substantive tasks.
  - **Transcript** (`conversation-transcript`, `transcript.md` +
    `metadata.json` under
    `04-conversations/transcripts/{source|imported}/<date>-<slug>/`) = the
    *original* raw chat, only when genuinely obtainable. `source` ∈
    `chatgpt | codex | codebuddy | manual | other`; imports go under
    `transcripts/imported/`.
  An Agent Work Record is **not** a full transcript; never label it
  `captureMode: full-transcript`. When no programmatic transcript exists, the
  session is marked `transcriptCaptureStatus: unavailable` and only a Work Record
  is produced (an honest, supported state).
- **Design** (`02-design/<area>/<slug>.md` + `<slug>.metadata.json`) = a formal
  design proposal (Problem / Context / Goals / Proposed Design / Risks / Open
  Questions / Sources). If promoted from a conversation, it keeps
  `sourceConversations`.
- **Decision** (`02-design/decisions/NNNN-<slug>.md` + `<slug>.metadata.json`) =
  an accepted ruling the system should obey (Status / Context / Decision /
  Rationale / Consequences / Sources). `status` ∈
  `Accepted | Proposed | Superseded | Deprecated`. Numbering is
  `max(existing NNNN) + 1`, collision-checked; new decisions continue from the
  last existing number and never reset.

Promotion chain (preserves traceability):

```text
Conversation ──[提升为设计]──▶ Design ──[创建决策]──▶ Decision
```

### Conversation Capture Kernel

The Capture Kernel is the provider-neutral path for future real-time chat
capture. A Provider Adapter sends a `CanonicalCaptureEvent` to the local Asset
Workbench Capture API; it never writes `04-conversations` itself.

```text
Provider Adapter → Capture API → CaptureSession + append-only Event Store
                 → Transcript Materializer → Managed Transcript
```

Each capture session has an isolated runtime directory under
`.asset-workbench-data/capture/sessions/<captureSessionId>/` containing
`raw-events.jsonl`, normalized `events.jsonl`, and `state.json`. Raw provider
payloads are preserved so later adapters can re-interpret them. Event IDs are
deduplicated; sequence gaps and out-of-order input are visible in session state.
At session end, the materializer creates a managed Transcript. A gap makes that
Transcript `partial`, never falsely `full`. CaptureSession and AgentSession are
separate models: an AgentSession may link to one or more future capture streams,
while its Work Record remains a separate structured asset.

This kernel is ready for adapters, not a claim of support for any named Agent
provider. ACP, A2A, MCP, hooks, and provider APIs remain integration work.

Relations are stored once in the `metadata.json` sidecar (single source of
truth for the chain); Markdown bodies carry human-readable `Sources` links:

- `conversation.promotedTo: [{ type: 'design', id }]`
- `design.sourceConversations: [...]`, `design.promotedToDecisions: [...]`
- `decision.sourceConversations: [...]`, `decision.sourceDesigns: [...]`

A Decision is the chain endpoint; it exposes no "promote" action. External Git
checkouts stay READ ONLY. Writes are limited to `04-conversations/**`,
`02-design/**`, `03-docs/**`, `05-derived/**` via `server/pathGuard.ts`; `src/**`,
`server/**`, `package.json`, `.git/**`, absolute paths, and `..` escapes are
rejected by `server/managedPathPolicy.ts`. After a write the service re-scans so
the Scanner / Watcher reflects the new file immediately — filesystem remains the
single source of truth, and no asset is ever persisted only in React state.

## Agent Knowledge Capture Protocol (default Agent workflow)

An Agent does not finish a substantive task by only editing code in chat. It
auto-captures knowledge through a small, Node-only CLI chain that reuses the
Managed Asset Service above:

```text
Agent
  └─ reads AGENTS.md  (behavior contract; not guaranteed auto-loaded by every runtime)
       └─ agent:preflight  → opens AgentSession (under .asset-workbench-data/agent-sessions/)
            └─ Agent performs the task
                 └─ agent:close  → Knowledge Capture Closure
                      ├─ attempts Transcript capture (full-transcript when genuinely available)
                      ├─ always writes Agent Work Record (agent-work-record)
                      ├─ writes Design  (only if a formal design outcome exists)
                      └─ writes Decision (only with adopted/accepted evidence)
                           └─ Managed Asset Service (Transcript / WorkRecord / Design / Decision + promotion chain)
                                └─ Scanner / Watcher re-scan → 03 资产空间
       └─ verify:knowledge  → Technical Gate (must PASS; exits non-zero otherwise)
```

- `AgentSession` is a work-execution record, distinct from a Conversation. It
  lives in runtime data, never in `04-conversations/`.
- The closure decides per semantic bar: Conversation (default) / Design /
  Decision / or explicit `skip`. It never fabricates a full transcript.
- `verify:knowledge` is the final兜底 gate: it checks closure status, asset
  existence, `schemaVersion`, bidirectional relation consistency, source
  traceability, and absence of temp write residue. On failure the task is not
  done.
- Manual "新建资产" in the UI remains the supplementary path for human work,
  external chats, and historical补录.

Every directory must be enterable. A directory detail page should show children,
asset counts, sources, versions, index status, and relations.

Every file must use a unified Asset Detail page. Different asset types may render
different content, but the frame is shared:

- name;
- type;
- path;
- source;
- WorkspaceVersion or asset version;
- updated time;
- content preview;
- history;
- related assets;
- references;
- derived results.

## Real Asset Engine (Phase 1)

Phase 1 turns the asset space into a **Real Asset Engine**. The `03 资产空间`
page reads exclusively from a Local Asset Runtime (`server/`, mounted as a Vite
plugin) and has no hardcoded sample tree and no silent sample fallback. If the
engine is unavailable the UI shows a real error, never a fake success tree.

Engine facts:

- Local directory is the **discovery source**; the scanned tree is the single
  source of truth for directories, files, sizes, and modification times.
- Git Remote (`origin` URL, branch, HEAD, dirty count) is **repository identity
  and version evidence**; the probe is strictly read-only (`rev-parse` /
  `status` / `config`) and never mutates the user checkout.
- Expected Skeleton (`00-introduction` … `05-derived`) is a product expectation
  shown as `FOUND` / `MISSING` / `PARTIAL` computed from disk — never fabricated.
- Derived Assets (CodeGraph, semantic index, summaries) are a separate model and
  are not yet produced in Phase 1.
- A filesystem watcher re-scans on add / change / unlink and streams the change
  to the UI over SSE, so the page updates without a reload.
- `projectRoot` is configurable (default = the current workspace) and never
  hardcoded in components.

## Reviewed Import Scheme

The scheme is not "local directory or Git URL". The layers are different:

- Local directory: first discovery entry for backV8 and a way to reuse existing
  Git objects.
- Git Remote: long-term repository identity.
- Managed Mirror: later refresh entry under `data/cache/git-mirrors/`.
- Master Commit: Raw code fact for each repository.
- Release Ref: release-window observation evidence.

The workbench must discover repositories from the local backV8 root, normalize
each origin URL, create or update managed mirrors, resolve `origin/master` to an
immutable commit, and freeze those commits into one WorkspaceVersion.

Release refs can be fetched and recorded for comparison, but they cannot decide
Raw content. A release/master difference is a report item, not an instruction to
rewrite the WorkspaceVersion.

Dirty local working trees must not block import if the system materializes Raw
from a resolved commit. The UI should show `DIRTY_EXCLUDED` and make clear that
uncommitted local changes are excluded from the version.

The system must never mutate the user's original local checkout. No fetch, pull,
merge, push, commit, or release branch creation runs against the source backV8
directory. Future fetches happen only in the managed mirror cache.

## First Delivery

The first delivery should be useful before the backend is complete:

- an intro page that explains the product in human language;
- a first-import guide;
- an asset explorer where directories and files can be opened, backed by the
  real Local Asset Runtime (no sample data);
- a guided console that shows the full import route;
- a workspace profile panel;
- repository discovery review;
- WorkspaceVersion freezing summary;
- raw import and manifest verification status;
- clear future steps with disabled states rather than fake readiness.

## V2 Relationship

V2 is kept as reference material. Its inventory and module discovery ideas can be
reused, but V3 must not inherit the mixed-read issue where a selected commit is
recorded while modules are scanned from the current checkout.

Raw output must preserve the original backV8 relative directory structure.
Repository boundaries, remotes, fact commits, tree hashes, release observations,
and local dirty status belong in the manifest.

## Acceptance

- The interface communicates that WorkspaceVersion identity is based on
  RepositoryRevision facts, not on a label alone.
- The UI distinguishes local discovery, Git identity, managed mirror, master
  facts, and release observation.
- The product includes an introduction and guide page before the technical
  console.
- The asset explorer shows code, design, documents, conversations, and derived
  outputs as first-class assets.
- Directories and files have enterable detail surfaces.
- A release ref never appears as the Raw source selector.
- The import flow can be copied for another workspace by changing profile data.
- Future steps are visible but cannot be mistaken for finished work.

## Implementation Prompt

Use this as the implementation contract for the next agent pass:

```text
Implement Asset Workbench V3 as a Project Workspace asset console.

The first screen must be an introduction page, not the technical import table.
Explain the product in user language: find project materials, confirm source,
freeze a version, and generate searchable assets.

Add a first-import guide that walks through selecting a project root, discovering
repositories and asset folders, opening directory/file detail pages, confirming
the version, and generating analysis.

Add an asset explorer. It must show these first-class asset groups:
01-code, 02-design, 03-docs, 04-conversations, 05-derived.
Every directory is enterable. Every file has a unified Asset Detail page with
type, path, source, version, updated time, preview, related assets, and derived
outputs.

The first supported workspace is backV8:
/home/ainfinit/Documents/ProjectNoChinese/backV8

Do not ask the user to manually enter every repository URL during normal first
import. Start from the local backV8 root, discover child Git repositories, read
and normalize each origin remote, and only require manual review for missing,
conflicting, or inaccessible remotes.

Use these semantics:
- WorkspaceVersion: one frozen workspace version.
- RepositoryRevision: one repository's resolved master commit inside that
  WorkspaceVersion.
- Local directory: first discovery entry and optional object reuse source.
- Git Remote URL: long-term repository identity.
- Managed Mirror: future refresh source under data/cache/git-mirrors.
- Master Commit: Raw source fact.
- Release Ref: release observation evidence only.

Never copy the working tree as Raw. If the local checkout is dirty, show
DIRTY_EXCLUDED and materialize Raw from the resolved commit. Never mutate the
user's source checkout. Do not run push, merge, pull, commit, or release branch
creation. Fetch only in managed mirrors.

Raw storage must preserve the original backV8 relative layout. Store repository
boundaries, remotes, resolved commits, tree hashes, local state, release refs,
and manifest hashes in the manifest.

After Raw verification, WorkspaceVersion is already trusted. Code Model and
CodeGraph are derived products with independent statuses. Generate repository
and file diff as soon as two WorkspaceVersions have verified Raw; add Symbol
Diff and Graph Diff after CodeGraph is available.
```
