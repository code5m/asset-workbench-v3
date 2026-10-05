# Asset Workbench V3

Asset Workbench V3 is a product-first skeleton for a reusable project asset
space. It is intentionally separate from V2.

V2 remains the prototype and evidence source. V3 starts from the user workflow
and adds a human-readable entry layer before the technical console:

1. understand what the product does;
2. follow a first-import guide;
3. browse project assets by directory and file;
4. define a workspace;
5. discover repositories and other asset folders;
6. freeze a `WorkspaceVersion`;
7. import raw source artifacts and validate manifests;
8. expose future steps for diff, modules, IR, graph, and retrieval.

The product rule is simple:

> The page is the entry point, `WorkspaceVersion + RepositoryRevision` is the
> version fact, and every derived result must be traceable back to verified Raw
> source artifacts.

## Conversation Capture Kernel

The workbench has a provider-neutral Capture Kernel and verified provider
adapters for **Codex**, **CodeBuddy** and **OpenCode**, plus a configured hook
integration for **Trae**. The CodeBuddy adapter
consumes the official hook payload (`session_id`, `hook_event_name`, `prompt`,
`tool_*`, `last_assistant_message`, `generation_id`, model/agent provenance) and
can also import the official session transcript published via the hook payload's
`transcript_path`. Ending a captured session materializes a managed Transcript.
Other providers are honestly capability-gated (BLOCKED / NOT_INSTALLED /
UNSUPPORTED / LIMITED); see `docs/provider-capture.md` for real evidence.

```text
Provider Adapter → Asset Workbench Capture API → Capture Event Kernel
  → append-only event store → Transcript Materializer → 04-conversations
```

- `CaptureSession` represents one event stream; it is related to, but distinct
  from, an `AgentSession` (one work task).
- `CanonicalCaptureEvent` is stored alongside the provider's raw input in
  `.asset-workbench-data/capture/sessions/<id>/events.jsonl` and
  `raw-events.jsonl`. `state.json` records lifecycle, sequence gaps, and
  ordering warnings.
- `POST /api/capture/v1/sessions`, `POST /api/capture/v1/events`,
  `GET /api/capture/v1/sessions/:id`, and
  `POST /api/capture/v1/sessions/:id/end` are localhost-only APIs. Callers
  cannot select output paths.
- Ending a session materializes a real `conversation-transcript` through the
  existing Managed Asset Service. A sequence gap or a stream without any
  message makes its completeness `partial`; the event stream remains the
  capture source of truth.
- A Transcript is original interaction evidence. An Agent Work Record remains
  a separate structured task summary; capture never replaces it.

## Architecture Decisions

V3 now treats the top level as a Project Workspace, not only a code workspace:

- `01-code/`: source code, Git repositories, Raw, versions, and diffs.
- `02-design/`: architecture, product plans, technical designs, and decisions.
- `03-docs/`: README files, manuals, requirements, reports, and drafts.
- `04-conversations/`: ChatGPT, Codex, CodeBuddy, and human discussion records.
- `05-derived/`: CodeGraph, semantic indexes, summaries, tags, and knowledge graphs.

Every directory must be enterable. Every file should use one asset-detail model:
content, source, version, path, related assets, and derived outputs.

## Repository Skeleton

```text
asset-workbench-v3/
├── AGENTS.md
├── 00-introduction/
├── 01-code/
├── 02-design/
│   ├── architecture/
│   ├── product/
│   └── decisions/
├── 03-docs/
│   ├── guides/
│   └── reports/
├── 04-conversations/
│   ├── chatgpt/
│   └── codex/
├── 05-derived/
│   ├── codegraph/
│   ├── semantic-index/
│   └── manifests/
├── docs/
└── src/
```

`AGENTS.md` is the local Agent rule file. It records the product identity,
required information architecture, UX rules, version model rules, and Git safety
constraints for future implementation passes.

For code import, V3 follows the reviewed backV8 scheme:

- Local directory is only the first discovery entry and object reuse source.
- Git remote URL is the long-term repository identity.
- Managed mirror under `data/cache/git-mirrors/` owns future fetches.
- `origin/master` resolved commit is the Raw source fact.
- Release refs are release-window observation evidence, not Raw content input.
- Dirty local working tree changes are shown as `DIRTY_EXCLUDED`; Raw is always
  materialized from a resolved commit, never copied from the working tree.
- Raw storage preserves the original backV8 relative directory layout; repository
  boundaries live in the manifest.
- File/repository diff can be generated before CodeGraph. Symbol/graph diff is
  derived later.
- The workbench never performs `git push`, `git merge`, `git pull`, commit, or
  release branch creation.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

`npm run build` includes the full TypeScript gate for `src/**`, `server/**`, `scripts/**`, and `vite.config.ts`. `npm run check` runs that build plus the complete regression suite used by GitHub Actions.

## Current Scope

The `03 资产空间` (Asset Space) is a **Real Asset Engine**, not a prototype
backed by sample data. The page reads exclusively from a Local Asset Runtime
(Vite dev middleware under `server/`). There is no hardcoded directory tree and
no silent sample fallback: if the engine is unavailable the UI shows a real
error, never a fake success tree.

The engine includes:

- recursive real filesystem scan with a centralized ignore policy
  (`.git`, `node_modules`, `dist`, `build`, `coverage`, `target`, `.cache`, the
  workbench's own `.asset-workbench-data`, system temp files …);
- a strict path guard: every read is resolved and symlink-checked to stay inside
  `projectRoot` (`../../etc/passwd` is rejected);
- a read-only Git probe (`rev-parse` / `status` / `config`) that records
  repository identity and version evidence, never mutating the checkout;
- a filesystem watcher that re-scans on add / addDir / change / unlink /
  unlinkDir and pushes the change to the UI over SSE, so the page updates
  without a reload;
- a logical asset classifier (introduction / code / design / document /
  conversation / derived / other) derived from path and extension — it never
  fabricates a physical path.

Distinguish three concepts the UI now makes explicit:

- **Expected Skeleton** — the product's desired top-level layout
  (`00-introduction` … `05-derived`). Shown as `FOUND` / `MISSING` / `PARTIAL`
  computed from disk; never fabricated.
- **Discovered Assets** — the real tree scanned from the filesystem. This is the
  single source of truth for directories, files, sizes, and modification times.
- **Derived Assets** — future generated data (CodeGraph, indexes, summaries).
  Not yet produced; the model keeps them separate from raw files.

## Local Asset Runtime

The runtime is mounted by `server/assetPlugin.ts` (a Vite plugin) and exposes:

- `GET  /api/workspace` — workspace identity + last scan time
- `GET  /api/workspace/tree?path=<rel>` — children of a directory (lazy)
- `GET  /api/assets/content?id=<rel>` — real file content (1 MB text cap)
- `GET  /api/repositories` — discovered Git repositories
- `GET  /api/workspace/skeleton` — expected-skeleton FOUND/MISSING status
- `GET  /api/workspace/events` — SSE change stream
- `POST /api/workspace/scan` — force re-scan
- `POST /api/workspace/root` — change `projectRoot` (persisted, re-scanned)

### Capture API

The localhost Capture API is deliberately provider-neutral. It accepts only a
known provider name, provider session id, capture source, and canonical events;
it never accepts a filesystem output path.

- `POST /api/capture/v1/sessions` — create a `CaptureSession`
- `POST /api/capture/v1/events` — append one or more events; returns accepted,
  duplicate, and ordering-warning ids
- `GET /api/capture/v1/sessions/:id` — read durable session state after restart
- `POST /api/capture/v1/sessions/:id/end` — materialize the transcript and link
  it to its optional `AgentSession`
- `GET /api/providers` — detect current local provider capability and show the
  exact connection status used by the welcome screen

See [provider adapter guide](03-docs/guides/provider-adapters.md) for the
capability matrix, real Codex setup, limits, and safe history import.

Provider Manager is the control plane for installation detection, authentication,
event-source configuration, verification evidence, and enable/disable state.
See [Provider Integration Platform](docs/provider-integration-platform.md).

### Managed Knowledge Asset Persistence

Conversation / Design / Decision are real, persisted project assets — not UI
state. They are written to disk by a business-semantic API, then discovered by
the existing Scanner / Watcher and surfaced in the `03 资产空间`.

- `POST /api/managed/conversation` — create an Agent Work Record (structured record)
- `POST /api/managed/transcript` — create a Transcript (raw original chat)
- `GET  /api/managed/asset?path=<rel>` — read an asset's metadata sidecar
- `POST /api/managed/design` — create a design (formal proposal)
- `POST /api/managed/decision` — create a decision (accepted ruling)
- `POST /api/managed/conversation/:id/promote/design` — conversation → design
- `POST /api/managed/design/:id/promote/decision` — design → decision

Semantics (strictly distinct layers, never three directories with the same
format):

- **Conversation** is now split into two distinct `managedType`s (the dual
  evidence model):
  - **Agent Work Record** (`agent-work-record`) = the Agent's structured record of
    one task. Lives under `04-conversations/{source}/<date>-<slug>/conversation.md`
    + `metadata.json`. Always produced for substantive tasks.
  - **Transcript** (`conversation-transcript`) = the *original* raw chat when
    genuinely obtainable. Lives under `04-conversations/transcripts/{source|imported}/<date>-<slug>/transcript.md`
    + `metadata.json`. Sources: chatgpt / codex / codebuddy / manual / other;
    imports go under `transcripts/imported/`.
  The Classifier (`server/assetClassifier.ts` `resolveManagedType`) decides the
  concrete type from each asset's `metadata.json` — path alone is insufficient.
- **Design** = a formal design proposal. Lives under `02-design/<area>/<slug>.md`
  + `<slug>.metadata.json`. If promoted from a conversation, keeps `sourceConversations`.
- **Decision** = an accepted ruling the system should obey. Lives under
  `02-design/decisions/NNNN-<slug>.md` + `<slug>.metadata.json`. Numbering is
  `max(existing NNNN) + 1` (never `count + 1`), collision-checked. Carries
  `status` (Accepted / Proposed / Superseded / Deprecated) and traces
  `sourceConversations` + `sourceDesigns`.

Relations are stored once, as a `metadata.json` sidecar next to each Markdown
file (the single source of truth for the promotion chain). Markdown bodies
include human-readable `Sources` links; metadata carries the machine relations:

- `conversation.promotedTo: [{ type: 'design', id }]`
- `design.sourceConversations: [...]`, `design.promotedToDecisions: [...]`
- `decision.sourceConversations: [...]`, `decision.sourceDesigns: [...]`

**Write policy (reuse of `server/pathGuard.ts`):** only `04-conversations/**`,
`02-design/**`, `03-docs/**`, `05-derived/**` are writable. `src/**`, `server/**`,
`package.json`, `.git/**`, `node_modules/**`, any `..` escape, and any absolute
path are rejected. External Git checkouts remain READ ONLY.

**Atomicity:** single files use temp file → `fsync`/close → `rename` → directory `fsync`. Conversation/Transcript directories are staged and renamed as a unit. Design/Decision Markdown + metadata use a crash-recoverable two-file transaction: both staged files and the transaction marker are fsynced before commit, and any interrupted commit is rolled forward before the next filesystem scan. After
a write the service re-scans so the Watcher / tree reflects it immediately
(filesystem remains the single source of truth — no second copy in React state).

The `03 资产空间` top bar exposes **[新建资产]** (新建聊天记录 / 新建设计文档 /
新建决策). Selecting a conversation shows **[提升为设计]** + **[创建决策]**; a
design shows **[创建决策]**; a decision shows only its relations.

`projectRoot` defaults to the current workspace (so the app verifies itself)
and can be changed from the `02 引导` page or the `ASSET_WORKBENCH_ROOT`
override. It is never hardcoded in components.

The React layer (`src/services/assetClient.ts`) is the only filesystem boundary;
no `fs` / `child_process` code lives in any component.

## Agent Workflow

The default Agent path is **automatic knowledge capture**. An Agent opens a
session, does the work, then persists the knowledge it produced before leaving.
Manual "新建资产" in the UI stays available for human notes, external ChatGPT
chats, and historical补录 — but it is the supplementary path, not the Agent
default.

```bash
# 1. Start of task: open an AgentSession (confirms workspace + AGENTS.md + managed paths)
npm run agent:preflight -- --agent codex --title "My Task"

# 2. Agent performs the task ...

# 3. End of task: write the real assets (Conversation / Design / Decision)
npm run agent:close -- --input .asset-workbench-data/current-session/closure.json

# 4. The兜底 gate — must PASS before the task is fully closed
npm run verify:knowledge
```

`agent:close` accepts a structured `closure.json` (task title, investigation,
findings, changes, verification, outcome, optional `transcript` content, and
optional `design` / `decision` blocks). It first attempts to capture a real
**Transcript** (`captureMode: full-transcript`); if the runtime cannot export a
genuine one, the session is marked `transcriptCaptureStatus: unavailable` and
only an **Agent Work Record** (`captureMode: agent-work-record`) is produced. It
never fabricates a full chat transcript. Trivial changes pass
`captureConversation: false` with an explicit `skipReason`.

If `verify:knowledge` exits non-zero, the task is not done — fix the capture,
do not fake a PASS. See `AGENTS.md` > *Agent Knowledge Capture Protocol* for the
full rules and the Definition of Done.

Agent sessions live under `.asset-workbench-data/agent-sessions/` (Scanner-
ignored, git-ignored) and survive a dev-server restart. External Git checkouts
remain READ ONLY.

## Git history boundary

Asset Workbench V3 uses its own Git repository. Its standalone history begins
from the Provider Platform v1 baseline; earlier development occurred under an
unmanaged parent-repository boundary. Runtime data, local Agent configuration,
and operating-system credentials are deliberately excluded from Git.
