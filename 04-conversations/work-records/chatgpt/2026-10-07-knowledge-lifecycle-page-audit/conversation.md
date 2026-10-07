# Knowledge lifecycle page audit

- Source: chatgpt
- Capture Mode: agent-work-record
- Related conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot

## Task

Audit all existing product pages after making substantive conversation discoveries a first-class project asset. Determine whether a new page is needed or whether existing pages should be adjusted.

## Investigation

Reviewed the six navigation sections and their actual responsibilities:

- Intro
- Guide
- Asset Space
- Console
- AI Connect
- Framework & Starter

Also reviewed Create Asset behavior, Transcript / Work Record rendering, Provider onboarding, and the newly adopted conversation-persistence decisions.

## Findings

1. A seventh “Knowledge” page would duplicate Asset Space and increase cognitive load.
2. Intro did not yet explain the full Conversation → Work Record → Design → Decision lifecycle.
3. Guide stopped at project connection and did not explain what happens to knowledge afterwards.
4. Asset Space already contains the actual create/promote mechanics, so it should be the knowledge review/promotion home.
5. AI Connect explained capture mechanics but did not clearly state that successful capture is evidence, not an automatic Design/Decision.
6. Console and Framework already have clear, separate responsibilities and should not absorb this lifecycle.

## Changes

- Added a reusable KnowledgeLifecycle explainer.
- Added the lifecycle to Intro.
- Added post-connection knowledge guidance to Guide.
- Added knowledge review/promotion guidance to Asset Space.
- Added the “capture ≠ decision” boundary to AI Connect.
- Kept Console and Framework unchanged.
- Kept navigation at six pages.
- Surfaced Decision 0004 in Intro key documents.
- Updated Conversation category copy to distinguish evidence from conclusions.

## Verification

- Full repository CI required before merge.
- Regression tests verify all four page integrations.
- Tests verify no new knowledge/decision navigation page was added.
- zh-CN and en coverage is required for all new copy.

## Outcome

The knowledge lifecycle is now visible across the existing product journey without creating a duplicate page. Asset Space remains the single review/promotion home for project knowledge.
