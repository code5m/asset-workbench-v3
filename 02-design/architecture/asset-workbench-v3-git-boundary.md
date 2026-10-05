# Asset Workbench V3 Git Boundary

- Type: design
- Created: 2026-10-05T04:14:20.279Z
- ID: design_c53f5b0c-eec3-4e92-bf7e-6b754524228e

## Context

## Goals

## Proposed Design

## Problem\nAsset Workbench V3 must retain its own commit and rollback boundary without altering the dirty parent repository.\n\n## Decision\nUse the existing nested repository as the sole Git boundary. Runtime state and local agent configuration stay ignored. The parent repository is not modified while it has unrelated user changes.\n\n## Consequences\nProject commits, tags, and rollback references are scoped to this directory. Parent visibility of this nested project remains documented as PARENT_REPO_BOUNDARY_DEBT.

## Sources

- Conversation: conv_86ad734a-70c4-47ff-9f32-001d17936f70

## Related Assets

- .gitignore
- AGENTS.md
- README.md
- docs/git-history-boundary.md
