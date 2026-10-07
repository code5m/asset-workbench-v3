# Visual-first framework management

- Source: chatgpt
- Capture Mode: agent-work-record
- Related conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot

## Task

Make the framework/runtime identity visible enough that the user can manage and
understand the system without relying on source code, Git commands, or hidden
configuration.

## Trigger

The user reported that they could not see the prior page changes and stated that
their current management and learning ability depends on visual UI.

## Finding

The previous structural change was valid, but the active page did not give a
persistent visual proof of:

- whether the Workbench was in framework-self or business-project mode;
- which framework revision was actually running;
- whether a business project was bound.

That gap made it impossible for the user to distinguish "the code is updated" from
"the page I am looking at is still the old runtime."

## Changes

- Local runtime config now exposes framework version and short Git revision.
- Left navigation now always shows:
  - current runtime mode;
  - framework version + revision;
  - current business project or explicit unbound state.
- Added bilingual labels and visual status styling.
- Added regression coverage.
- Added Decision 0008: Visual-First Framework Management.

## Outcome

The user can now visually verify the runtime identity from any page.

## Follow-up

Future framework versioning, instance upgrades, migration status, Provider
readiness, and framework evolution should continue this visual-first rule.
