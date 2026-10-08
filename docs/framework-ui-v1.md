# Framework UI v1

This UI pass exposes the framework/scaffold capabilities without disrupting the existing product workflow.

## Information architecture

The application remains task-oriented:

1. Intro
2. Guide
3. Assets
4. Console
5. AI Connect
6. Framework & Starter

The new Framework page is the developer/open-source entry. It does not replace the normal user path.

## Page responsibilities

- **Intro**: adds one compact framework capability card only.
- **Guide**: supports both an existing-project path and a Starter path. Existing project root configuration remains unchanged.
- **Assets**: unchanged; continues to show the real filesystem and 00–05 skeleton.
- **Console**: unchanged; remains focused on source/version workflow.
- **AI Connect**: adds a developer link to the Provider SDK but keeps Provider onboarding/management in place.
- **Framework & Starter**: centralizes Protocol, Provider SDK, Language Core, Asset Core, built-in Provider references, language ecosystem support, and real Starter creation.


## Asset Space root architecture

Asset Space continues to show the real repository root. It does not introduce virtual folders or move files.

The root presentation now explains five architectural roles:

```text
Tooling & Provider Configuration
  .codex / .codebuddy / .opencode / .trae / .github / ...

Project Asset Skeleton
  00-introduction ... 05-derived

Framework Skeleton
  packages / providers

Workbench Application
  src / server / scripts

Project & Engineering Files
  docs / README.md / package.json / tsconfig* / vite.config.ts / ...
```

These are visual headings only. Every row keeps its original relative path, deep links continue to use real paths, and Provider hooks/configuration remain untouched.



## Beginner mental model

The Framework page now closes the beginner-understanding loop before users move on to connecting real projects.

It teaches four things explicitly:

1. **Runtime flow** — how `src` (frontend), `server` (local backend), `packages` (shared foundations), Provider integration, Capture, and 00–05 assets connect.
2. **Framework project vs managed project** — `asset-workbench-v3` is the tool itself; an imported Java/Python/Rust/Node project is the business project being managed. Connected projects do not need Workbench's own `src/server/packages` structure.
3. **Recommended learning order** — Asset Core → Starter → Language Core → Protocol → Provider SDK.
4. **Beginner scope** — normal users should learn project selection, Provider management, Asset Space, Transcript vs Work Record, and 00–05 first. Protocol internals, Provider SDK implementation, server internals, scripts, and CI can wait until framework extension work is needed.

This is intentionally a progressive-disclosure layer. It does not alter runtime architecture or project filesystem semantics.

## Starter UI contract

The browser never writes the filesystem directly.

```text
StarterCreator
  -> assetClient.createStarter()
  -> POST /api/starter/create
  -> packages/starter/createStarter()
```

The target must be missing or empty. The API does not auto-enable Providers, install hooks, or fabricate runtime verification evidence.

After creation the user may explicitly switch the new directory to the current workspace through the existing `setRoot` API.

## Language scope

The Framework page reads `LANGUAGE_DESCRIPTORS` directly from `packages/language-core` so the UI does not maintain a second list. Current first-class ecosystems are Java, JavaScript/Node.js, TypeScript, Python, and Rust.

## Provider scope

The Framework page reads `BUILTIN_PROVIDER_DEFINITIONS` from `packages/provider-sdk`. Existing built-in Provider definitions therefore remain the source of truth for the developer view.

Provider Adapter implementation language is intentionally separate from Workbench runtime implementation language. The Workbench runtime remains TypeScript/Node.js.


## Beginner-first framework package cards

The five framework package cards now follow the same learning order used elsewhere in the page:

1. Asset Core
2. Starter
3. Language Core
4. Protocol
5. Provider SDK

The card title is now plain language first, with the technical package name shown second. Each card also tells the user whether it is something to learn now or only when extending the framework/Provider platform.

This preserves the real `packages/*` paths and package responsibilities while reducing beginner-facing terminology.



## Asset Core vs Starter

Asset Core is **not** a future-only scaffold. It is the canonical definition of the
current 00–05 project knowledge structure.

```text
packages/asset-core
  DEFAULT_ASSET_SKELETON
        |
        +--> server/assetService   checks the current workspace
        +--> Framework UI         explains/displays the structure
        +--> packages/starter     creates a new project from the same structure
```

Starter is the creator; Asset Core is the definition. The server must not keep a
second hard-coded copy of the 00–05 list.



## Advanced: evidence-driven framework evolution

The Framework page includes a collapsed advanced section for the long-term
multi-project learning model:

```text
Real project practice
-> Evidence
-> Pattern
-> Framework Candidate
-> Design / Decision / Verification
-> Versioned framework release
-> Controlled project adoption
-> Feedback
```

This is intentionally secondary to the beginner workflow.

Hard product rule: a one-project special case stays project-local by default.
Shared Core changes need reusable evidence, explicit abstraction, regression
tests, and representative project verification.

Long-term RSI is governed, not autonomous by default:

```text
Discover -> Propose -> Prove -> Promote -> Propagate -> Observe
```

The current implementation documents and governs the model; it does not yet claim
automatic cross-project pattern mining, release distribution, migration
orchestration, or RSI execution.


## Framework learning surface and one-project instance model

The Framework page is a first-class **visual learning surface**. It is not only
developer documentation and it should not be reduced to package names.

Primary mental model:

```text
Central Framework
-> Instance / CLI (available v1)
-> One Business Project Binding
-> Knowledge
<-> Provider / Capture
-> Framework Evolution
```

The current implementation exposes two runtime modes:

- `framework-self`: the Workbench source repository is available for learning,
  self-checking, and framework iteration.
- `business-project`: the Workbench is bound to one external real business
  system.

In framework-self mode, Asset Space may show framework files for learning, but the
business Console must not present the framework repository as a normal managed
business project.

### Current Starter semantics

`packages/starter` currently initializes the **project knowledge structure**
(00–05, README, AGENTS, Transcript / Work Record, Decisions). It does not generate
business code and it is not equivalent to Spring Boot Starter, Maven POM, or a
full Workbench instance generator.

A Workbench Instance / CLI lifecycle is implemented as a version-aware logical
instance bound to one external business project. It writes lifecycle state under
`.asset-workbench-data/instance/`; it does not copy the Framework repository into
the business project and it does not generate business code.


## Visual Framework Console

Framework Learning now includes a visual console between the six-role mental model
and deep technical package detail.

It has four views:

1. **Directory Map** — explains architecture-significant top-level areas and their
   important children.
2. **Key Files** — explains only architecture-bearing files through
   responsibility / consumers / dependencies / impact / learning depth.
3. **Instance / CLI** — shows current runtime identity and the real Creator
   lifecycle commands/capabilities.
4. **Versions & Upgrades** — keeps Central Framework, Workbench Instance, and
   Business Project identities separate and reads real Instance Manifest state.

### Honesty boundary

The UI must not fabricate capabilities.

Available now:

- Framework Self mode;
- one external business-project binding;
- Knowledge Init;
- Instance Creator / CLI v1;
- Instance Manifest with Framework version, revision, capability versions, and generation;
- upgrade plan / apply;
- migration evidence + Manifest backup;
- verification;
- rollback of the latest applied migration.

Still not implemented:

- automatic business-code/schema migration;
- arbitrary shell execution from the browser;
- multi-project aggregation as the default model;
- autonomous RSI.

The UI must distinguish lifecycle metadata migration from any future business-code
migration. Upgrade/apply must never imply that business code was rewritten.

### Learning metadata

`src/data/frameworkLearning.ts` is the UI learning metadata source. It does not
replace real runtime facts or precise docs.

Directory guidance answers:

- what;
- why;
- learning depth;
- edit conditions.

Key-file guidance is selective and answers:

- responsibility;
- users;
- dependencies;
- change impact;
- learning recommendation.

This progressive disclosure prevents the Framework page from becoming either a
source-code browser or a shallow marketing diagram.
