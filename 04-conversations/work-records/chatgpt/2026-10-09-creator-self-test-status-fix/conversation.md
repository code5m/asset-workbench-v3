# Creator lifecycle status fix + one-click self test

- Source: ChatGPT
- Capture mode: agent-work-record
- Conversation evidence: user supplied external AI acceptance report, partial
- Date: 2026-10-09

## Trigger

External acceptance testing proved the real Instance lifecycle works end to end but
found one UI truth defect: the four Version & Upgrade cards still rendered
"planned" even though their described lifecycle behavior was implemented.

The same acceptance report recommended turning the proven manual test flow into a
one-click visual Self Test.

## Implemented

- changed all four implemented Version & Upgrade cards from planned -> available;
- clarified that only business-code migration, database Schema migration, and
  automatic source rewriting remain planned;
- added `runInstanceLifecycleSelfTest()` to Creator Core;
- Self Test uses an isolated OS temporary project;
- validates create -> old verify -> plan -> apply -> migration evidence -> backup ->
  current verify -> rollback -> old verify;
- validates sentinel business file unchanged;
- validates configured Framework Self isolation;
- always attempts temporary cleanup;
- added typed Local API and frontend client;
- added Creator Workbench one-click button and per-step PASS/FAIL output;
- added `npm run creator -- instance self-test`;
- added regression gates for status truth, no browser shell, Core/API/UI/CLI sharing,
  cleanup, and Self Test semantics.

## Safety boundary

The browser still has no arbitrary shell execution. Self Test does not use the
current Business Project and cleans its isolated temporary directory after the run.

## Verification target

- npm run test:creator-instance-v1
- npm run test:framework-ui-v1
- npm run check
- branch CI
- PR merge
- main CI
