# Decision: Adopt a visual Framework Learning Console

Status: accepted

## Context

The user understands the six high-level roles, but still needs a concrete answer
to two questions:

1. where and how the central Framework is represented;
2. how Instance / CLI should be understood and eventually operated.

The user also explicitly asked whether a beginner needs a management page,
directory explanations, and file explanations.

Because the user's learning and management loop is visual-first, leaving those
answers in source code or Markdown would repeat the same product failure already
captured by Decision 0008.

## Decision

Extend `06 框架学习` into a **Visual Framework Learning Console**.

The page will keep the six-role model and add four interactive views:

1. Directory Map;
2. Key Files;
3. Instance / CLI;
4. Versions & Upgrades.

Directory explanations are required for architecture-significant top-level areas.

File explanations are selective rather than exhaustive. Only architecture-bearing
files are surfaced, and each answers responsibility, consumers, dependencies,
impact, and learning depth.

Instance / CLI is UI-first:

- the user operates visual controls;
- CLI is the underlying execution/automation interface;
- implemented capabilities and planned capabilities must be visibly distinct.

The Version view must keep three identities separate:

- Central Framework;
- Workbench Instance;
- Business Project.

Current runtime facts are read from the real Local API. Unimplemented Instance
Manifest, upgrade, migration, and rollback functionality remains explicitly
planned.

## Rationale

- The user can understand and improve the framework only when architecture is
  visible and navigable.
- Directory structure is the bridge between product concepts and source code.
- Selective key-file guidance teaches impact without drowning the user in every
  implementation file.
- UI-first Instance management matches the user's operating style while still
  allowing a future CLI for automation.
- Honest capability status prevents planned architecture from being confused with
  implemented behavior.

## Consequences

- `src/data/frameworkLearning.ts` becomes the visual learning metadata source.
- `FrameworkLearningConsole` becomes a first-class part of Framework Learning.
- Framework UI regression tests protect directory, file, Instance, and version
  explanations.
- Future Instance Creator / upgrade work should extend this surface rather than
  introducing a hidden CLI-only workflow.
- Precise docs remain the specification/archive layer.

## Sources

- Conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot
- Design: 02-design/framework-learning/visual-framework-console-v1.md

## Related assets

- src/components/FrameworkLearningConsole.tsx
- src/data/frameworkLearning.ts
- src/components/FrameworkPage.tsx
- src/i18n/translations.ts
- src/styles.css
- scripts/test-framework-ui-v1.ts
