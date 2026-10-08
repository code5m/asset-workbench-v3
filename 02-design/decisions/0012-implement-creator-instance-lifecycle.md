# Decision: Implement version-aware Creator Instance lifecycle

Status: accepted

## Context

Decision 0010 established Creator as the shared UI / CLI / Agent execution boundary,
with Knowledge as the first implemented capability. Decision 0011 made the Workbench
the operational surface.

The remaining lifecycle capabilities were intentionally kept planned until Instance
identity, versioning, migration evidence, verification, and rollback could be implemented
as one coherent safety boundary.

The user explicitly asked to implement Instance Creator, Upgrade, and Migration /
Rollback together in unattended mode.

## Decision

Implement the full **Creator Instance lifecycle v1** as a logical, version-aware
Workbench Instance bound to one external business project.

Adopt these persistent objects:

1. **Instance Manifest** — current Instance/Framework/capability identity.
2. **Upgrade Plan** — immutable comparison from one Manifest state to a target
   Framework identity.
3. **Migration Record** — before/after evidence plus backup and rollback state.

Persist them only under the business project's ignored runtime state:

`.asset-workbench-data/instance/`.

Keep UI-first / CLI-underlying.

Keep one Instance = one external Business Project.

Do not copy Framework source into business projects.

Do not expose arbitrary browser shell execution.

Do not claim that lifecycle metadata migration is automatic business-code migration.

## Rollback policy

Rollback is latest-applied-migration only and requires the current Manifest digest
to match the migration's expected after-state.

This conservative rule is preferred over a flexible but unsafe arbitrary-history
rollback.

## Consequences

- Instance Creator / Manifest / Upgrade / Migration evidence / Rollback are now
  real available capabilities.
- Framework Git revision changes can produce upgrade plans even when semantic
  Framework version remains unchanged.
- Capability versions are explicit and can evolve independently.
- Existing business source files remain untouched by lifecycle operations.
- Future code/schema migrations can be added as explicit capabilities without
  weakening the current rollback boundary.

## Supersedes capability status only

This Decision supersedes the **planned/current status statements** in Decisions 0010
and 0011. Their architectural boundaries remain accepted:

- Creator is shared by UI/CLI/Agent.
- Framework Learning explains; Creator Workbench executes.
