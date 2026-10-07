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

