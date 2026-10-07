# Decision: Adopt evidence-driven framework evolution

Status: accepted

## Context

Asset Workbench is expected to evolve while managing real projects. Ideas and
problems will be discovered through project work and through user/AI discussion.
The framework should learn from those projects and distribute validated
improvements back to applicable projects.

Without governance, this creates two risks:

1. project-specific exceptions contaminate shared Core;
2. self-improvement becomes unverified self-modification.

## Decision

Adopt **Evidence-Driven Framework Evolution** as the framework's long-term
evolution model.

A shared framework change must move through:

```text
Project observation
-> Evidence
-> Pattern
-> Framework Candidate
-> Design + Decision
-> Implementation
-> Verification
-> Versioned release
-> Controlled project adoption
-> Feedback
```

A one-project special case remains project-local by default.

Framework improvements are distributed as versioned capabilities, schemas, rules,
or migrations — not by copying the full Asset Workbench repository into every
managed business project.

Long-term RSI is governed by:

```text
Discover -> Propose -> Prove -> Promote -> Propagate -> Observe
```

AI may participate in every step, but may not bypass evidence, regression tests,
compatibility analysis, migration/rollback planning, or representative project
verification.

## Rationale

- Keep Core general instead of accumulating project exceptions.
- Make real project experience the source of framework learning.
- Preserve traceability from source project to shared capability.
- Support future multi-project distribution and upgrades.
- Make RSI compatible with engineering safety rather than opposed to it.

## Consequences

- Project-local issues are not automatically framework issues.
- Framework Candidates need explicit reusable evidence and scope.
- Shared changes need regression tests and representative project verification.
- Future distribution features should be version/capability based.
- Original project evidence remains linked after generalization.
- The advanced framework page may explain this loop, but it should stay secondary
  to the beginner workflow.

## Sources

- Conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot
- Design: 02-design/framework-evolution/evidence-driven-framework-evolution-v1.md

## Related assets

- AGENTS.md
- src/components/FrameworkPage.tsx
- 02-design/framework-evolution/evidence-driven-framework-evolution-v1.md
