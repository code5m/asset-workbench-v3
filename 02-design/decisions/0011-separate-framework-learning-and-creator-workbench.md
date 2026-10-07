# Decision: Separate Framework Learning from Creator execution

Status: accepted

## Context

Framework Learning had grown into a mixed teaching and operations page. The same
Knowledge Creator appeared both inside the learning console and again later on the
page, while the existing Workbench did not own Creator operations.

This caused two problems:

1. beginners had to scan a long page containing learning, reference, and execution;
2. the product boundary between "understand the framework" and "operate the
   framework" was unclear.

## Decision

Keep **Framework Learning** focused on understanding.

Make the existing **Workbench** the operational home for Creator capabilities.

Workbench has two views:

```text
Project status
Creator
```

Creator currently exposes Knowledge create/verify as the only executable capability.
Instance Creator, Upgrade, and Migration / Rollback remain planned and have no fake
buttons.

Framework Learning may show real CLI examples and capability status, but executable
forms live only in Creator Workbench.

Technical/reference content uses progressive disclosure to reduce the default page
length.

## Consequences

- learning and execution have separate primary surfaces;
- no new left-nav section is required;
- Knowledge Creator still reuses the same core/API/CLI;
- the previous duplicate Creator form is removed;
- future Creator capabilities have a stable operational home;
- arbitrary shell execution remains out of scope.

## Related decisions

- Decision 0008 — Visual-first framework management.
- Decision 0009 — Visual Framework Learning Console.
- Decision 0010 — Creator as the shared UI/CLI execution boundary.
