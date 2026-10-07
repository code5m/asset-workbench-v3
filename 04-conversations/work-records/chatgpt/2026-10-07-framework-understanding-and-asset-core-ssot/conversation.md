# Framework understanding and Asset Core single-source-of-truth

- Source: chatgpt
- Capture Mode: agent-work-record
- Conversation Evidence: transcript_chatgpt_20261007_framework_asset_core_ssot

## Task

Improve beginner understanding of the Asset Workbench framework, then implement the architectural correction discovered through the discussion.

## Context

A sequence of beginner questions about `packages`, `src`, `server`, Provider integration, and the meaning of the 00–05 structure exposed both UX ambiguity and a real architecture debt.

## Investigation

- Reviewed the Framework page and Asset Space explanations.
- Verified `packages/asset-core/src/index.ts` exports `DEFAULT_ASSET_SKELETON`.
- Verified `packages/starter` and Framework UI already consume that source.
- Verified `server/assetService.ts` still contained its own hard-coded `EXPECTED_SKELETON`.
- Reviewed Conversation / Work Record / Decision persistence rules.

## Findings

1. “项目资产骨架” was easy to misread as “future project scaffolding only”.
2. Asset Core actually defines the knowledge structure already used by the current Workbench.
3. Starter is a consumer/creator, not the owner of the standard.
4. The server-side duplicate skeleton violated the intended single source of truth.
5. The conversation itself was valuable evidence because the defect was found through clarification and reflection rather than a pre-planned code audit.

## Changes

- Server now consumes `DEFAULT_ASSET_SKELETON` from Asset Core.
- Duplicate `EXPECTED_SKELETON` is removed.
- Beginner UI copy distinguishes “Asset Core defines” from “Starter creates”.
- Regression tests lock the single-source-of-truth boundary.
- This conversation evidence, work record, and accepted decisions are persisted in the repository.

## Verification

- Full project CI required before merge.
- Regression test asserts Starter, Server, and Framework UI consume the same Asset Core definition.
- UI test asserts the current-use vs new-project wording.

## Outcome

Asset Core becomes the real canonical owner of the 00–05 project knowledge structure, and substantive chat discoveries are treated as durable project evidence rather than being left only in ChatGPT history.

## Follow-up

Future substantive conversations should continue to persist:
- evidence in `04-conversations`;
- reusable proposals in `02-design`;
- accepted conclusions in `02-design/decisions`.
