# Visual runtime identity

- Source: chatgpt
- Capture Mode: agent-work-record
- Related conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot

## Task

Make the running Workbench identity visible enough that the user can manage the
framework without reading Git or terminal output.

## Trigger

The user reported that the page did not appear to change after the previous
GitHub implementation and clarified that their current skill level requires
visual management.

## Finding

The GitHub main branch had changed, but the browser at `127.0.0.1:5173` was
running from a local checkout. GitHub merge alone does not update that local
process.

This revealed a product gap: the interface did not show which framework revision
was actually running.

## Changes

- Runtime config exposes framework version and short Git revision.
- Left navigation shows a persistent "current runtime" card.
- The card shows:
  - Framework Self / Business Project mode;
  - current business project or "not bound";
  - framework version and running revision.
- Added bilingual labels and regression coverage.

## Scope

This round does not implement automatic GitHub-to-local synchronization or an
in-app self-updater. It makes the running state visible so stale local UI is no
longer silent.

## Relationship to Decision 0007

This is a UX enforcement of the accepted framework-self vs business-project
boundary. It does not create a new architecture decision.
