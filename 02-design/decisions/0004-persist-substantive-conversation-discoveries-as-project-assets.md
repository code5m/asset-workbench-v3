# Decision: Persist substantive conversation discoveries as project assets

Status: accepted

## Context

A beginner-focused ChatGPT discussion exposed a real architecture defect: the server duplicated the 00–05 skeleton even though Asset Core already owned the intended canonical definition.

The value was not only the final code change. The sequence of questions, misunderstandings, corrections, and rationale is useful material for later review and reflection.

## Decision

Substantive user/assistant conversations that materially affect the project must be persisted as project knowledge when they reveal or change one or more of:

- product intent;
- architecture assumptions;
- terminology or mental-model problems;
- hidden duplication or technical debt;
- trade-offs and rejected alternatives;
- accepted design or implementation decisions.

Persistence must preserve evidence and conclusions as different layers:

1. Conversation evidence goes to `04-conversations`.
2. Agent execution summary goes to `04-conversations/work-records`.
3. Formal proposals go to `02-design` when needed.
4. Accepted conclusions go to `02-design/decisions`.

For ChatGPT, do not fabricate a “full transcript”. If a platform export is unavailable, persist only the real excerpts available in the active conversation and mark the record honestly as partial/manual.

## Rationale

- Important discoveries often happen through clarification rather than planned design work.
- Keeping only the final code loses the reasoning that explains why the code changed.
- Later retrospectives need both the evidence trail and the final ruling.
- This follows the existing Transcript vs Work Record distinction rather than collapsing them.

## Consequences

- Agents should capture substantive chat-derived knowledge before closing a task.
- Partial/manual ChatGPT evidence must be labeled as such.
- Decisions must retain source traceability to conversation evidence/work records.
- Trivial chat and mechanical edits do not need durable capture.

## Sources

- Conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot
- Work Record: conv_chatgpt_20261007_framework_asset_core_ssot

## Related Assets

- 04-conversations/README.md
- AGENTS.md
- 02-design/README.md
