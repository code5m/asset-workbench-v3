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

## Beginner-First Real Directory Learning (mandatory)

**Product principle: 所见即是全部，所点即是真实，所学皆有依据。**
The actual project directory tree is the beginner's first learning map, not
implementation clutter to be hidden behind a separate, invented navigation
structure. Preserve all five rules below in product, architecture, and UI work:

1. **真实目录是第一事实。** 页面展示必须来自实际文件系统，不能用虚拟目录伪装真实目录，也不能因为设计分类而随意改变实际路径。
2. **所有有意义的顶层目录默认可见。** 不要求用户先理解菜单、切换模式或打开多个页面，才能知道项目有哪些组成部分。技术性排除目录也应该说明原因。
3. **解释附着在目录上，而不是替代目录。** 保留 `src`、`server`、`00-introduction` 等原名，同时给出中文含义、用途和学习建议。
4. **任何知识都可以追溯到实际位置。** 点击架构图中的模块，应能定位源码；点击一个设计决策，应能找到关联文档和代码版本。
5. **循序渐进地理解，不隐藏项目复杂度。** 新手可以先阅读介绍和简单功能，进阶后继续学习架构，但看到的始终是同一个真实项目。

Implementation and acceptance rules:

- In **Framework self mode**, show both the `00-introduction` … `05-derived`
  knowledge-asset directories **and** implementation directories such as
  `src/`, `server/`, `packages/`, `providers/`, `scripts/`, and `docs/`
  when they actually exist. Explain their differing responsibilities without
  splitting, renaming, moving, duplicating, or hiding the real directory tree.
  In **Business project mode**, show the real bound project's tree; do not
  misrepresent the framework repository as the business project.
- Derive the visible tree from the Local Asset Runtime's actual filesystem
  scan. Show eligible top-level entries by default; deeper levels may load
  lazily for performance. The Expected Skeleton is an explicitly labeled
  comparison, **not** a fabricated filesystem tree. Preserve the separate
  five-category Asset Categories rule above.
- Explanations, learning depth, related assets, and diagrams are annotations
  attached to real paths, not replacements for those paths. Make source links
  navigable to real files; preserve repository/ref or commit and source
  evidence for versioned relations. Mark unresolved, missing, or planned links
  explicitly rather than inventing targets.
- If technical, ignored, sensitive, or unsafe directories are excluded by
  policy, explain the exclusion reason in the UI without exposing protected
  contents or weakening existing ignore, path-guard, or write-boundary rules.
- Teach progressively **within the same truthful project structure**. Beginner
  guidance may explain or focus content but must not silently remove real
  project components or replace them with a simplified fake tree.

### Shared beginner UI intent: decisions and non-goals (mandatory)

This subsection resolves ambiguities found during the product discussion. **UI is
the primary learning medium**, not an optional technical appendix. Make a change
only if a complete beginner can still see the actual project and understand it
without being taught the internal architecture first.

1. **一棵树，不是两棵树。** 项目知识资产（实际存在的 \`00-introduction\` ~ \`05-derived\`）
   与 Workbench 程序源码（实际存在的 \`src\`、\`server\`、\`packages\` 等）
   原本是同一项目根目录下的同级条目。首页和资产空间必须如实展示；
   不创建 \`knowledge/\`、\`implementation/\` 等虚拟父目录，也不把目录移动进去。
   Visual grouping is allowed only as decoration that cannot be mistaken for a
   real path or parent/child relationship.
2. **不额外编号。** \`00–05\` 已有的数字是资产规范名称，不是整个项目的学习步骤。
   不得擅自改成 \`06-src\`、\`07-server\`；学习顺序由说明或引导表达，
   不通过重命名目录表达。
3. **分类说人话。** UI 使用“项目资料 / 工作台程序 / 工具与设置”
   （英文：Project knowledge / Workbench software / Tools & settings）
   来解释用途。不要直接把“实现”“底层基础设施”“Provider Adapter”
   等术语扔给第一次接触编程的用户。第一层先说明“这里有什么、能做什么”，
   第二层再教“前端 / 后端 / Provider / 模块”等专业名词。
   Class labels are **annotations**, not extra asset categories or folders.
4. **原名、图标、中文同屏。** 保留 \`src\`、\`server\` 等真实名称；
   辅以克制的语义图标、至多三种概念色、一句通俗解释。
   Ordinary nested folders keep standard folder styling. Accessibility must
   not depend on color alone, and clickable directories need keyboard support.
5. **明确解开两组最容易混淆的名称：**
   - \`01-code\`: 代码来源、仓库版本、代码知识资产；\`src\`: Workbench 自己
     真正运行的前端源码。**绝不是同一份代码的两个副本。**
   - \`03-docs\`: 项目知识资产中的文档；\`docs\`: Workbench 自身的工程技术说明。
   Their real paths stay separate; teaching must explicitly compare them.
6. **首页可见、原位学习。** 默认首页在介绍之后直接显示扫描器返回的全部
   允许浏览的真实顶层目录和文件；点击真实条目可定位资产空间中的原位置。
   在资产空间点击一个真实目录，右侧就地回答“这是什么／为什么需要／
   如何开始”，不强迫用户切到另一个页面才能获得基础解释。
   Keep advanced framework-learning views available for deeper study.
7. **存在性与能力要真实。** 静态说明不能生成目录节点。
   推荐文件、架构图跳转和关联路径，在提供可点击链接之前必须查验真实路径；
   不存在、无法确认、尚未生成应明确显示。不能把未来能力画成已完成。
   Scanner/Watcher remains the filesystem discovery authority; deep folders
   may lazy-load for performance.
8. **显示边界要诚实。** \`.git\`、运行私有数据、生成目录等仍按统一忽略与
   安全策略处理；页面要解释存在排除规则及原因，但**不得**泄露受保护内容、
   穿透路径保护或暗示每个被忽略的目录必然存在。
9. **Framework Self 与业务项目分清。** 只有 Framework Self 可以显示
   Workbench 专属的 \`src = React 前端\` 等解释。业务实例必须显示其实际绑定
   项目的真实目录，不得将同名的业务 \`src\` 错误解释成 Workbench React 源码。
   当前仍为“一实例绑定一个业务系统”，不要默认引入多项目聚合。
10. **保留现有产品价值。** 保留已有整体视觉语言、五种 Asset Categories
    卡片、六目录 Expected Skeleton、框架学习和知识证据模型；
    增强展示与理解即可，不做无根据的物理目录重构、大规模基础设施迁移，
    不修改业务仓库，也不允许伪造扫描成功。

**UI acceptance contract:**

- Homepage renders real root entries fetched from \`assetClient.tree('')\`;
  no static list is ever rendered as the filesystem tree, including under errors.
- Framework Self renders the *actual* \`00–05\` paths and \`src/server/packages\`
  at their real sibling level when present. Business mode never uses
  framework-specific descriptions for unrelated \`src\` paths.
- Path click opens the same path in Asset Space. An annotated "start here" or
  comparison link is actionable only after real path existence is verified.
- Directory explanation uses plain language before a technical label, and
  the visual labels do not alter the five Asset Categories taxonomy.
- Scan failures show an error rather than a fabricated success; ignored-path
  policy, safe writes, Git provenance, and lazy directory loading still hold.
- Add or update UI tests for the above; run typecheck/build and focused tests
  before claiming completion.

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

## Conversation-derived knowledge is a first-class asset

Substantive user/assistant discussion is not disposable when it materially changes
understanding of the project. Capture it when the conversation reveals or changes:

- product intent or scope;
- architecture assumptions or boundaries;
- terminology/mental-model problems;
- hidden duplication, technical debt, or a previously missed defect;
- trade-offs, rejected alternatives, or accepted decisions.

The evidence and the conclusion remain separate:

- real conversation evidence -> `04-conversations/transcripts/<source>/...`;
- Agent execution summary -> `04-conversations/work-records/<source>/...`;
- reusable proposal -> `02-design/**`;
- accepted ruling -> `02-design/decisions/**`.

For ChatGPT specifically, never reconstruct or claim a full transcript when a real
platform export is unavailable. If the active conversation itself is available,
persist only real excerpts that are actually present, mark the evidence
`captureMode: manual` and `completeness: partial`, and keep a separate Work
Record. The resulting Decision may cite both.

A conversation that discovers a defect is valuable project evidence even when the
final code change is small. Trivial chat, typo fixes, and mechanical edits can
still be skipped with an explicit reason.

## Visual-First Framework Management

Important framework/runtime state must be visible in the product before the user
is expected to infer it from source code, Git, logs, configuration, or CLI output.

At minimum, keep the following visible in the normal UI:

- current runtime mode;
- current framework version;
- current framework revision;
- current bound business project, or an explicit unbound state.

Use diagrams, status cards, badges, matrices, and visible relationships for
framework learning, upgrade/adoption state, Provider readiness, and evolution
history whenever those visuals reduce cognitive load.

Documentation remains the precision/archive layer; the UI is the primary
management and learning layer.

## Visual Framework Learning Console

The Framework learning surface must explain the framework at progressively deeper
visual layers instead of forcing the user to infer architecture from source code.

Required layers:

1. six-role product model;
2. directory map;
3. selected key-file explanations;
4. Instance / CLI capability status;
5. Framework -> Instance -> Business Project version relationship;
6. governed framework evolution.

Directory explanations answer: what it is, why it exists, how deeply a beginner
should learn it, and when it is edited.

Key-file explanations are intentionally selective. Do **not** document every file.
Only architecture-bearing files should answer:

- responsibility;
- who uses it;
- dependencies;
- change impact;
- recommended learning depth.

Instance / CLI remains **UI-first**. The product may show target CLI examples for
future automation, but any unimplemented command or capability must be visibly
marked planned and must never be presented as runnable.

The current capability truth is:

- Framework Self mode: available;
- one external business-project binding: available;
- Knowledge Init: available;
- full Workbench Instance Creator / CLI: available (v1);
- independent per-business-project local runtime: available (shared Framework build, dedicated loopback process and URL);
- Instance Manifest / framework-version + revision + capability identity: available;
- upgrade plan/apply + migration evidence + latest-migration rollback: available;
- automatic business-code migration: not implemented; any future code/schema migration must be an explicit versioned capability.

## Framework Learning vs Business Project Mode

Asset Workbench has two explicit meanings of "project" and they must never be
collapsed in the UI or implementation:

1. **Framework self mode** — the `asset-workbench-v3` repository is being viewed
   to learn, inspect, test, and improve the framework itself.
2. **Business project mode** — one Workbench instance is bound to one external
   real business system that the user wants to study.

Hard rules:

- The framework repository may be scanned for self-learning / self-check assets,
  but business workflow pages must not present it as though it were the managed
  business project.
- At the current product stage, one Workbench instance should bind **one business
  system**. Do not introduce multi-project aggregation UI as the default model.
- Framework-learning pages are first-class product surfaces. Their explanatory
  diagrams, plain-language architecture, and teaching copy are not disposable
  documentation clutter; they are how the user understands and improves the
  framework.
- Technical package names (Asset Core, Language Core, protocol, Provider SDK,
  starter) are second-layer implementation details. Beginner understanding starts
  from product roles: Framework -> Instance/CLI -> One Project Binding ->
  Knowledge -> Provider -> Evolution.
- The current `packages/starter` capability remains a **project knowledge structure
  initializer**. It is not Spring Boot Starter, Maven POM, or a business-code generator.
- Independent runtime management lives in `server/instanceRuntimeManager.ts`: starts only a verified project-locked Instance, reuses the central V3 build and does not copy source; source/framework update is separate from Manifest metadata migration. The instance must not change its project root or launch nested runtimes. Per-instance Provider OS Keyring IDs must not cross project boundaries.
- Full Instance lifecycle now lives in `packages/creator-core`: one external business
  project -> one Instance Manifest -> version-aware upgrade plan/apply -> migration
  evidence/Manifest backup -> verify -> latest-migration rollback.
- Instance creation is forbidden on Framework Self. Lifecycle upgrades never rewrite
  business code automatically. Future business-code/schema migrations must be explicit,
  versioned capabilities with their own verification and rollback evidence.
- Long-term RSI remains an advanced objective; current UI may explain and prepare
  the boundaries, but must never claim autonomous RSI is implemented.

## Evidence-Driven Framework Evolution (governance)

Asset Workbench evolves from real project practice, but **project-specific behavior
must never jump directly into framework Core**.

Required promotion funnel for reusable framework change:

```text
Project observation
-> Evidence (Conversation / Work Record / runtime facts)
-> Repeated pattern across projects or strong reusable proof
-> Framework candidate
-> Design + Decision
-> Implementation
-> Verification (tests + representative real projects)
-> Framework release/version
-> Controlled project adoption/migration
-> Feedback
```

Hard rules:

1. A one-project special case remains project-local by default.
2. Repetition is evidence, not automatic permission to change Core.
3. A Framework Candidate must state scope, affected projects, compatibility,
   migration, and rollback expectations.
4. Shared Core changes require reusable evidence and regression tests.
5. Distribution to managed projects happens by versioned capability/schema/rule
   adoption, **not by copying the entire Workbench repository into each project**.
6. The framework may propose and implement improvements automatically only inside
   existing safety/verification gates; it must not self-promote unverified changes.
7. Long-term RSI is a governed objective: Discover -> Propose -> Prove -> Promote
   -> Propagate -> Observe. Evidence, versioning, migration, and rollback remain
   mandatory.
8. Preserve project-local evidence even when a generalized framework capability is
   later created; the original source project remains part of traceability.

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
