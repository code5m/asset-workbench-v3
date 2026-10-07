# Visual Framework Console

- Source: chatgpt
- Capture Mode: agent-work-record
- Related conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot

## Task

Design and implement, in one unattended round, a visual framework learning and
management console that makes the central framework, repository structure,
Instance / CLI model, and future version/upgrades understandable to a beginner.

## Trigger

The user understood the six product roles but still could not concretely map:

- Central Framework -> real directories/files;
- Instance / CLI -> visible product operation;
- current vs planned capabilities;
- Framework -> Instance -> Business Project version relationships.

The user explicitly prefers visual operation and asked for a complete
unattended implementation.

## Investigation

- Reviewed current Framework page and six-role model.
- Reviewed existing Visual-First Framework Management Decision 0008.
- Reviewed runtime identity API and persistent navigation state.
- Reviewed Starter / Knowledge Init semantics.
- Reviewed framework self vs business-project mode.
- Selected architecture-significant directories and files instead of trying to
  explain every source file.

## Implementation plan executed

1. Add visual learning metadata for top-level framework directories.
2. Add selective architecture-bearing key-file explanations.
3. Add an interactive Framework Learning Console with four tabs:
   Directory Map, Key Files, Instance / CLI, Versions & Upgrades.
4. Connect Instance / Version views to real runtime config.
5. Keep one-instance-one-business-system explicit.
6. Show Knowledge Init as available now.
7. Show full Instance Creator, Instance Manifest, upgrade, migration, and rollback
   as planned only.
8. Keep CLI as future underlying execution; UI remains beginner control surface.
9. Add bilingual copy and responsive styles.
10. Add regression tests.
11. Add Design and Decision 0009.
12. Persist this Work Record and conversation evidence.
13. Run branch CI, PR CI, merge, and main CI.

## Key product decisions

- Directory explanations answer what/why/how-to-learn/when-to-edit.
- File explanations answer responsibility/users/dependencies/impact/learning depth.
- File explanations are selective; documenting every file would increase cognitive
  load and become stale.
- The version view never invents an Instance Manifest or upgrade state.
- A target future CLI example is visibly labeled non-runnable.

## Outcome

The Framework page now acts as a real visual learning console instead of requiring
the user to translate six abstract roles into repository structure and lifecycle
concepts mentally.

## Follow-up

Future implementation may replace the planned Instance / Upgrade cards with real
operations while preserving the same visual IA and honesty rules.
