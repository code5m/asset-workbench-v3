# Asset Workbench V3 Agent Rules

## Product Identity

This project is a Project Workspace asset workbench, not only a code import page.
It must help users understand, import, browse, version, and analyze long-lived
project assets.

## Required Information Architecture

Keep these top-level asset areas visible and meaningful:

- `00-introduction`: human-readable product introduction and onboarding copy.
- `01-code`: code workspace, repositories, Raw source, manifests, and diffs.
- `02-design`: architecture, product design, technical design, and decisions.
- `03-docs`: user-facing guides, requirements, reports, and reusable documents.
- `04-conversations`: ChatGPT, Codex, CodeBuddy, and human discussion records.
- `05-derived`: CodeGraph, semantic indexes, summaries, tags, and manifests.

### Asset Categories vs Expected Skeleton (mandatory)

The homepage "Asset Categories" block shows **exactly 5** categories:
`01-code`, `02-design`, `03-docs`, `04-conversations`, `05-derived`.

`00-introduction` is **NOT** an asset category. It belongs to the Expected
Skeleton (the standard project structure / guidance + meta layer), not to the
asset-type grid. Do not add `00-introduction` as a 6th asset category card, and do
not "fix" the 5-card grid into a 6-card grid. The two sets are intentionally
different:

- Asset Categories (5): what kinds of assets exist.
- Expected Skeleton (6, including `00-introduction`): what standard directories
  the project should have.

Every directory should have a `README.md` that explains what belongs there.
Every durable design decision should be written as a document, not only left in
chat.

## UX Rules

- Do not start the app on a dense technical console.
- The first screen must explain the system in human language.
- Internal terms such as `WorkspaceVersion`, `RepositoryRevision`, `Managed
  Mirror`, and `Raw` may appear after the user has a plain-language bridge.
- Every directory should feel enterable.
- Every file should fit a unified asset detail model: path, type, source,
  version, summary, related assets, and derived outputs.

## Version Model Rules

- `WorkspaceVersion` is a frozen project-level version.
- `RepositoryRevision` is one repository's resolved commit inside a
  `WorkspaceVersion`.
- Local directories are discovery inputs, not version truth.
- Git remote URLs are long-term repository identity.
- Managed mirrors are the only place future fetches should happen.
- Master commit is the Raw code fact.
- Release refs are observation evidence, not Raw source selectors.
- Dirty local working tree changes must be shown as excluded, not copied into
  Raw.

## Git Safety

Before any Git write in this project, confirm that `git rev-parse --show-toplevel`
returns `/home/ainfinit/Documents/Knowledge-Base/secondBrain/asset-workbench-v3`.
Never commit Asset Workbench V3 source from the parent `secondBrain` repository.

The workbench must not mutate a user's development checkout.

Do not implement or run these actions against the source workspace:

- `git push`
- `git merge`
- `git pull`
- creating release branches
- committing generated files into business repositories

Fetch/update work must happen in managed mirrors such as
`data/cache/git-mirrors/`.

## Real Asset Engine

The `03 资产空间` reads exclusively from the Local Asset Runtime (`server/`, a
Vite plugin under `/api`). There is no hardcoded sample tree and no silent
sample fallback: a scan failure must show a real error, never a fake success
tree. Component code must never import `fs` or `child_process`; all filesystem
access goes through `src/services/assetClient.ts` → the engine.

- Local directory is the discovery source; the scanned tree is the single source
  of truth.
- `projectRoot` is configurable and must never be hardcoded in components.
- The Git probe is read-only (`rev-parse` / `status` / `config`); it never
  mutates the user checkout.
- Expected Skeleton (`00-introduction` … `05-derived`) is shown as `FOUND` /
  `MISSING` / `PARTIAL` computed from disk; never fabricated.

## Implementation Rules

- Keep the React frontend product-first and readable.
- Use existing components and domain types before adding new abstractions.
- Update documentation when the model, navigation, or asset taxonomy changes.
- Run `npm run build` after code changes.
- Do not add fake readiness. Future pipeline features should be visible but
  clearly marked as not complete.
- Do not reintroduce sample/fake asset data as a runtime data source.

## Managed Knowledge Asset Persistence (anti-regression)

Conversation / Design / Decision are real, persisted project assets written by
`server/managedAssetService.ts` through business-semantic API endpoints
(`/api/managed/*`). They are discovered by the existing Scanner / Watcher and
surfaced in `03 资产空间`. Hard rules:

1. A **Conversation is not a Design**. A **Design is not a Decision**. They are
   three distinct semantic layers, never three directories sharing one format.
2. `04-conversations/**` holds **process evidence** (raw discussion / reasoning).
   Do not rewrite it into a conclusion; do not auto-summarize away the original.
3. `02-design/**` holds **formal design proposals** (Problem / Context / Goals /
   Proposed Design / Risks / Open Questions / Sources).
4. `02-design/decisions/**` holds **accepted rulings** the system should obey
   (Status / Context / Decision / Rationale / Consequences / Sources).
5. A Decision MUST keep **source traceability** (`sourceConversations` +
   `sourceDesigns` in its `metadata.json`). Never drop the chain when promoting.
6. The three **Asset Categories stay `01-code` … `05-derived`**. A Decision adds
   no 6th category; it is a `managedType` inside `02-design`.
7. `00-introduction` is **NOT** an asset category.
8. **External Git checkouts remain READ ONLY.** The workbench may only write the
   managed knowledge paths below; it must never mutate a development checkout.
9. **Write policy (reuse `server/pathGuard.ts`):** only `04-conversations/**`,
   `02-design/**`, `03-docs/**`, `05-derived/**` are writable. `src/**`,
   `server/**`, `package.json`, `.git/**`, `node_modules/**`, any `..` escape, and
   any absolute path are rejected by `server/managedPathPolicy.ts`.
10. **Single source of truth = the filesystem.** After a write the service
    re-scans; the React tree updates from the Watcher/SSE. Never push a hand-made
    node into React state to fake success. Relations live in the `metadata.json`
    sidecar, not in filenames and not in UI state.

Promotion chain: Conversation → [提升为设计] → Design → [创建决策] → Decision.
Decision numbering is `max(existing NNNN) + 1` (collision-checked), not
`count(files) + 1`. New decisions continue from the last existing number.

## Transcript vs Agent Work Record (dual evidence model)

A core semantic distinction. The two are **different asset kinds**, never one:

- **Transcript** (`managedType: conversation-transcript`) — the *original, raw*
  chat / interaction evidence from a platform (ChatGPT / Codex / CodeBuddy
  export, or a real programmatic capture). Stored verbatim in `transcript.md`.
- **Agent Work Record** (`managedType: agent-work-record`) — the Agent's own
  *structured* record of one task (Task / Context / Investigation / Findings /
  Changes / Verification / Outcome / Follow-up). Stored in `conversation.md`.

Hard rules (anti-regression):

1. **An Agent Work Record is NOT a full chat transcript.** Never label a Work
   Record `captureMode: full-transcript`.
2. Only content that genuinely came from a real platform transcript / export may
   be labeled `full-transcript` (or `imported-transcript` for user imports).
3. When no genuine transcript is available, the session MUST be marked
   `transcriptCaptureStatus: unavailable` and only a Work Record is produced.
   Codex / CodeBuddy / OpenCode may obtain real transcripts through the Provider
   Capture Kernel; ChatGPT remains explicit-import only; Trae remains limited by
   its real lifecycle support. Never infer availability from the Provider name alone.
4. Never reconstruct a "full transcript" from memory and label it `full-transcript`.
   Even text that looks like `User:` / `Assistant:` swaps is fabricated evidence.
5. A Work Record is still mandatory for substantive tasks; it is the structural
   audit record, preserved independently of any transcript.

`captureMode` values (do not mix): `full-transcript` | `imported-transcript` |
`agent-work-record` | `manual`. The Classifier (`server/assetClassifier.ts`
`resolveManagedType`) decides the concrete `managedType` from the asset's own
`metadata.json` — path alone is insufficient because both live under
`04-conversations`.

New transcripts are written under `04-conversations/transcripts/<source>/…`.
Import vs realtime capture is represented by `captureMode`, not by a special
directory. Agent Work Records are written under
`04-conversations/work-records/<source>/…`. Legacy layouts are migrated
explicitly with `npm run migrate:conversations-v2`; the project does not
permanently dual-write old and new layouts. An `AgentSession` can link BOTH a
`transcriptAssetId` and a `workRecordAssetId`, with bidirectional back-links in
each asset's `metadata.json`.

## Agent Knowledge Capture Protocol

The default Agent workflow is **automatic knowledge capture**. An Agent must
not finish a substantive task by only editing code in chat and leaving — if the
task produced knowledge worth keeping, it must be persisted before the task is
closed. Manual "新建资产" stays available but is the **supplementary** path, not
the Agent default.

Implementation (all Node-only CLIs, no browser / dev server required):

- `npm run agent:preflight` — confirm workspace, AGENTS.md, managed paths; open an `AgentSession`.
- `npm run agent:close` — perform the Knowledge Capture Closure (write real Conversation / Design / Decision assets via `server/managedAssetService.ts`).
- `npm run verify:knowledge` — the兜底 gate; exits non-zero until the capture is complete and consistent.

State lives under `.asset-workbench-data/agent-sessions/` (Scanner-ignored,
git-ignored), so sessions survive a dev-server restart and never pollute the
user's managed assets.

### Agent loading boundary (honest scope)

`AGENTS.md` is a **supported Agent behavior contract**, not a guarantee that
every runtime loads it. Confirmed / expected behavior:

- Codex, Claude Code, Cursor, and similar repo-aware Agents auto-read the
  project-root `AGENTS.md` (and, for those that support it, nested `AGENTS.md`).
- ChatGPT desktop, CodeBuddy, and some web/IDE surfaces do **not** reliably
  auto-load a repo `AGENTS.md`.

Consequence: **do not rely on AGENTS.md alone.** The Technical Gate
(`verify:knowledge`) is the real fallback. If an Agent cannot prove it loaded
this file, it must still run the three commands above; a task is only fully
closed when `verify:knowledge` returns PASS.

### Start-of-Task Protocol

Before substantive work, any Agent MUST:

1. Read the project-root `AGENTS.md`.
2. Identify the current Workspace (`asset-workbench`).
3. Identify the task goal.
4. Decide up front whether the task will likely produce Conversation evidence,
   a Design, and/or a Decision.

Run `npm run agent:preflight` to open the `AgentSession`.

### During-Task Protocol

- Investigation / analysis / reasoning = **Conversation** evidence.
- A formal, reusable, structured proposal = **Design**.
- A user-confirmed or formally adopted ruling = **Decision**.
- Never present raw Conversation as a Design.
- Never auto-promote a Design into a Decision.
- Never fabricate an asset just to satisfy the rule.

### End-of-Task Protocol (Knowledge Capture Closure)

Before leaving, run `npm run agent:close` and then `npm run verify:knowledge`.
The closure decides per semantic bar:

- **Transcript (optional, when genuinely obtainable)** — if the runtime can read
  a real platform transcript / export, persist it as a `conversation-transcript`
  asset (`captureMode: full-transcript` for real capture, `imported-transcript`
  for a user import). Stored in `transcripts/…/transcript.md`.
- **Agent Work Record** — created for **every** substantive task (default). It is
  the structured record (`conversation.md`) and is written even when no transcript
  exists (`captureMode: agent-work-record`). If the runtime cannot export a full
  chat transcript, the session is marked `transcriptCaptureStatus: unavailable`
  and only the Work Record is produced — never a faked transcript.
  `captureMode` is one of `full-transcript | imported-transcript |
  agent-work-record | manual`.
- **Design** — created only when a *formal design outcome* exists (architecture,
  IA, data model, API contract, version model, security policy, persistence,
  Agent Protocol). Code changes alone do not auto-generate a Design.
- **Decision** — created only with adopted/accepted evidence (user confirmed,
  project adopted, or an authority the Agent may execute and has executed).
  "I suggest using SQLite" is NOT a Decision.
- **Skip** — trivial changes (typo, one-line style, mechanical no-conclusion
  edit) set `captureConversation: false` with an explicit `skipReason`.

Allowed final states: Conversation only; Conversation + Design; Conversation +
Decision; Conversation + Design + Decision; or No capture (skipped).

### Agent Session

An `AgentSession` is one work-execution record (id, agentType, started/completed
times, task, captureMode, captureStatus, `transcriptAssetId`, `workRecordAssetId`,
`transcriptCaptureStatus`, resulting asset ids, affected paths, closureStatus). It
is **not** a Conversation. Sessions are stored under
`.asset-workbench-data/agent-sessions/` and never under `04-conversations/`. An
un-closed session found at next `preflight` is marked `interrupted`/`stale` and
reported — never silently overwritten.

### Definition of Done

A task is **not** fully closed until:

1. code / work is verified;
2. the knowledge-capture decision is made (captured or explicitly skipped);
3. required Conversation / Design / Decision assets are persisted;
4. relation verification passes;
5. the Knowledge Capture Gate (`verify:knowledge`) passes.

If `verify:knowledge` fails, the task is not done — fix the capture, do not
fake a PASS.

## Conversation Capture Kernel

The provider-neutral Capture Kernel is the only future real-time transcript
ingress. Provider adapters must send canonical events to the local Capture API;
they must never write `04-conversations/**` or managed metadata directly.

```text
Provider Adapter → Capture API → CaptureSession/Event Store → Transcript Materializer → Managed Transcript
```

- `CaptureSession` is one durable event stream, distinct from an `AgentSession`
  work-execution record.
- Runtime event data lives only in
  `.asset-workbench-data/capture/sessions/<captureSessionId>/`: `raw-events.jsonl`,
  `events.jsonl`, and `state.json`. It is scanner-ignored but restart-readable.
- Raw provider payload and normalized `CanonicalCaptureEvent` are both required.
  Event IDs deduplicate. Sequence gaps and out-of-order input must remain
  visible; a gapped transcript is `partial`, never `full`.
- Materialization uses the Managed Asset Service and preserves the Transcript /
  Work Record distinction. It may link an existing AgentSession but must not
  replace its independent Work Record.
- Codex has a project-level lifecycle-hook adapter in `.codex/hooks.json` and
  is runtime-verified for a complete user/assistant transcript. Do not claim
  that ChatGPT, CodeBuddy, Trae, OpenCode, CodeArts, ACP, A2A, or MCP is
  connected unless its own real adapter has been implemented and verified.

### Provider Adapter rules (anti-regression)

All providers must flow through the same boundary:
`Provider → Provider Adapter → Capture Kernel → Managed Transcript`. Never add a
second session store, never let an adapter write `04-conversations/` directly,
and never build a private capture path for one provider.

1. `runtimeVerified=true` requires a **real ended capture with a materialized
   transcript**. A config file, a compiling adapter, or a mocked test is never
   enough. Do not confuse "officially supported" with "verified here".
2. Providers are independent. A missing binary, missing login, missing API key,
   or unsupported version blocks **only that provider**: record the blocker with
   evidence, then continue to the next one. Never abort the whole task.
3. Never fabricate a lifecycle event. If a provider has no `SessionEnd`-like
   event, do not invent one — keep the session honestly open/partial instead.
4. Capture is **fail-open**. Capture failure must never block, slow, or alter the
   provider's own answer.
5. Identity comes from real stable provider fields (`provider` +
   `providerSessionId`, plus `providerMessageId` / `generation_id` /
   `toolCallId` where available). Never infer session identity from `cwd`,
   time windows, filenames, or prompt text alone.
6. Preserve raw provider payloads in `raw-events.jsonl`. Providers may re-emit
   content (resume, re-sent leading prompt); suppress only **exact** duplicates.

### Verified provider status (this machine)

Real statuses and evidence live in `docs/provider-capture.md`. Summary:
Codex = ENABLED (hooks, verified); CodeBuddy = ENABLED (official hooks + official
session transcript; realtime PASS, auto `SessionEnd` NOT_RUNTIME_VERIFIED);
OpenCode = ENABLED (official plugin + official export, E2E verified, 1.18.34);
Trae = LIMITED (official workspace hooks ARE supported and configured, but no real
Trae event observed yet — needs an interactive logged-in Trae IDE session; the
build has no `SessionEnd`, so finalization is LIMITED and never faked);
CodeArts = BLOCKED (no AK/SK credentials); ChatGPT = LIMITED (explicit import only;
no product realtime hook, and an OpenAI API Agent webhook is a different thing
that must never be reported as ChatGPT realtime capture).

Two permanent anti-regression facts:

- Provider secrets use the OS secure credential store only. They must never be
  persisted in definitions, project/runtime JSON, logs, events, transcripts, or
  API responses; callers receive only configured/not-configured status.

- Trae is an IDE product. **"No CLI" is not "no hooks"** — hooks are configured in
  `.trae/hooks.json` and must be judged by the installed build's real capability.
- OpenCode streams many `message.part.updated` events. One assistant answer must
  produce **one** canonical `assistant.message` (merge by `messageID`), and the
  role must come from `message.updated` → `properties.info.role`.
