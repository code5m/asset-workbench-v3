# Visual Framework Console v1

Status: implemented design

## Goal

Turn the Framework Learning page from a collection of explanations into a visual
learning and management console that lets a beginner answer:

- where the central framework lives;
- what each top-level directory is for;
- which files are architecture-critical;
- how a Workbench Instance / CLI should be understood;
- what is implemented today vs merely planned;
- how Framework, Instance, and Business Project versions relate;
- where future upgrades, migration, rollback, and governed evolution fit.

The console is part of the product, not a replacement for precise documentation.

## User model

The user learns primarily through visible UI. Therefore the page must support:

```text
See
-> click
-> understand one layer
-> inspect impact
-> return to whole model
```

It must not require reading source code or CLI output before the framework becomes
understandable.

## Information architecture

The existing six-role model remains the first layer:

```text
Framework
-> Instance / CLI
-> One Project Binding
-> Knowledge
<-> Provider
-> Evolution
```

A new Visual Framework Console sits underneath with four tabs.

### 1. Directory Map

Top-level learning targets:

- `src` — frontend and visual management surface;
- `server` — Node/TypeScript local backend;
- `packages` — shared foundation/core;
- `providers` — Provider extension examples;
- `scripts` — tests, gates, migrations, Agent automation;
- `00–05` — framework self-knowledge assets;
- `docs` — precise long-term specifications.

Every directory explanation answers:

1. what it does;
2. why it exists;
3. how a beginner should learn it;
4. when it is edited;
5. important child areas;
6. selected key files.

### 2. Key Files

Do not document every file.

Only architecture-bearing files are surfaced, for example:

- `src/App.tsx`;
- `src/components/FrameworkPage.tsx`;
- `src/services/assetClient.ts`;
- `server/config.ts`;
- `server/assetPlugin.ts`;
- `server/assetService.ts`;
- `server/captureService.ts`;
- `server/providerPlatformService.ts`;
- `packages/asset-core/src/index.ts`;
- `packages/protocol/src/index.ts`;
- `packages/starter/src/index.ts`;
- `AGENTS.md`;
- `package.json`.

Each answers:

- responsibility;
- who uses it;
- dependencies;
- change impact;
- learning recommendation.

### 3. Instance / CLI

The UI is the primary control surface; CLI is the execution/automation layer.

Implemented today:

- Framework Self mode;
- one external business-project binding;
- Knowledge Init.

Planned, shown honestly as planned:

- full Workbench Instance Creator / CLI / Scaffold;
- Instance Manifest / framework-version pin;
- upgrade applicability;
- Migration / Rollback.

The page shows the live runtime identity from `/api/config` and links current
binding/switching work to Guide.

A sample future CLI may be shown only as a target interface and must be labeled
non-runnable until implemented.

### 4. Versions & Upgrades

The visual model is:

```text
Central Framework version
        |
        v
Workbench Instance adoption/version
        |
        v
Business Project identity
(Git / language / business code)
```

The business project is never copied into `src/server/packages`.

Future upgrade workflow:

```text
discover
-> applicability
-> migration if required
-> verify
-> rollback if required
```

All currently unimplemented stages are shown as planned.

## Progressive disclosure

- six-role model first;
- visual console second;
- technical package cards remain collapsed;
- precise docs remain the archive/specification layer.

## Runtime truth

The console uses the existing Local API runtime identity:

- `mode`;
- `frameworkVersion`;
- `frameworkRevision`;
- `projectRoot`.

No fake instance version or upgrade state is generated.

## Non-goals

This design does not implement:

- actual full Instance Creator;
- an installable `asset-workbench` CLI;
- Instance Manifest persistence;
- automated upgrade distribution;
- Migration orchestration;
- Rollback execution;
- autonomous RSI.

## Verification

Regression tests must ensure:

- all four visual-console tabs exist;
- directory and key-file learning metadata remain present;
- runtime identity is read from the Local API;
- planned capabilities remain visibly planned;
- zh-CN and en copy stays complete;
- the Framework page still keeps package detail secondary.
