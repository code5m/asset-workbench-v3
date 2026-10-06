# Framework & Starter Architecture

Asset Workbench is organized as a reusable framework plus a reference Workbench application.

## Stable framework layers

```text
packages/
├── protocol/        shared provider/capture/asset contracts
├── provider-sdk/    Provider Definition + adapter authoring helpers
├── language-core/   Java / JS-Node / TypeScript / Python / Rust detection registry
├── asset-core/      canonical 00–05 project asset skeleton
└── starter/         starter project generator

providers/
└── examples/        reference third-party Provider definitions
```

The existing `src/`, `server/`, and `scripts/` directories are the reference application/runtime. They consume these packages without changing the current runtime semantics.

## Provider SDK

A Provider is an integration definition, not an executable command bundle. Built-in definitions can contain trusted verification commands controlled by this repository. User/custom definitions cannot contain arbitrary executable commands.

Third-party adapters may be implemented in Node.js, Python, Rust, Java, Go, or another language. The language boundary is the provider-neutral Capture API / canonical event contract, not the implementation language of Asset Workbench itself.

Minimal TypeScript definition:

```ts
import { defineProvider } from '../packages/provider-sdk/src/index.ts';

export const provider = defineProvider({
  schemaVersion: 1,
  version: '1.0.0',
  id: 'my-agent',
  displayName: 'My Agent',
  description: 'Example integration',
  providerType: 'coding-agent',
  discovery: { configPaths: ['.my-agent/hooks.json'] },
  auth: { type: 'external' },
  eventSource: { type: 'hooks', projectConfigPath: '.my-agent/hooks.json' },
  events: {
    UserPromptSubmit: { canonical: 'user.message', contentPath: 'prompt' },
    Stop: { canonical: 'assistant.message', contentPath: 'last_assistant_message' },
    SessionEnd: { canonical: 'session.ended' },
  },
  finalization: { strategy: 'explicit-event', event: 'SessionEnd' },
  verification: { required: ['user.message', 'assistant.message'], requireTranscript: true },
}, { allowExecutableCommands: false });
```

See `providers/examples/basic-hooks.ts`.

## Starter

Create a new Asset Workbench-compatible project skeleton:

```bash
npm run starter:create -- --target /path/to/new-project --name my-project
```

The target must be empty or absent. The generator creates the real 00–05 directories and introductory README/AGENTS files. It does **not** create fake Provider verification evidence or silently install Provider hooks.

## Language-neutral project support

`packages/language-core` currently declares first-class project detection for:

- Java
- JavaScript / Node.js
- TypeScript
- Python
- Rust

This means the Asset Engine recognizes source extensions, ecosystem manifests, and generated/cache directories. It does not imply that the Asset Workbench server itself is reimplemented in five languages.

## Compatibility rule

The current app remains backward compatible:

- `src/domain/asset.ts` remains the compatibility facade used by existing UI/server code.
- common contracts are re-exported from `packages/protocol`;
- Provider Manager uses definitions from `packages/provider-sdk`;
- scanner/classifier uses `packages/language-core`;
- existing Codex / CodeBuddy / OpenCode / Trae behavior remains unchanged.

This phase establishes package boundaries without forcing a monorepo/package-manager migration.
