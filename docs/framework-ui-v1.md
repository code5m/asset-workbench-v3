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
