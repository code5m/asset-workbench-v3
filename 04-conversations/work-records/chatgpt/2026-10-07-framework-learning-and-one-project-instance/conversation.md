# Framework learning and one-project instance model

- Source: chatgpt
- Capture Mode: agent-work-record
- Related conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot

## Task

Implement the clarified product boundary: explanatory pages are a primary visual
learning surface for understanding and improving Asset Workbench, while normal
business operation should bind one Workbench instance to one external business
system.

## Context

The user showed the Workspace Console displaying `asset-workbench-v3` itself as
the active project and repository. They clarified that the framework repository
is useful for learning and improving the framework, but the more important normal
use is studying a company or personal business project.

They also clarified that one Workbench instance should currently focus on one
business system; multi-project aggregation is beyond the user's current cognitive
and product scope.

## Findings

1. Framework source and business project had been presented as the same kind of
   Workspace.
2. The explanatory pages are essential to the user's learning loop and must be
   strengthened, not removed.
3. The five package cards expose implementation terminology too early.
4. The current Starter is only a knowledge-structure initializer and its name
   strongly suggests incorrect Spring Boot / Maven semantics.
5. A future full Instance / CLI / Scaffold is a different capability and should
   remain explicitly future until implemented.
6. The correct current mental model is:
   Framework -> Instance/CLI -> One Project Binding -> Knowledge <-> Provider ->
   Evolution.

## Changes

- Added runtime mode detection: `framework-self` vs `business-project`.
- Workspace Console no longer presents framework Git/repository facts as a
  business-project workflow when in framework-self mode.
- Asset Space clearly labels framework files as learning/self-check assets.
- Guide makes one-instance-one-business-system explicit.
- Framework page now starts from a six-role visual model and explains why the
  page exists as a learning manual.
- Package-level technical cards are moved into a collapsed secondary section.
- Starter-facing wording is corrected to Project Knowledge Initialization /
  Knowledge Init while the code package name remains stable.
- Added design and Decision 0007.
- Appended the real discussion to partial ChatGPT conversation evidence.

## Verification

- Full repository CI required before merge.
- Regression tests cover runtime modes, Framework learning UI, Starter semantics,
  and bilingual copy.
- No full Workbench instance generator, migration engine, distribution system, or
  RSI executor is claimed as implemented.

## Outcome

The product now distinguishes framework self-learning from business-project work
without losing the framework's own explanatory and dogfooding value.

## Follow-up

After reviewing the real page effect, the next iteration can refine:

- the six-role visual layout;
- the future full Instance / CLI design;
- business-project binding UX;
- framework version identity and future upgrade state.
