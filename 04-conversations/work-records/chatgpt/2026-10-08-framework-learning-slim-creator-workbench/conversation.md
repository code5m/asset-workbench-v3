# Framework Learning Slim + Creator Workbench implementation

- Source: ChatGPT
- Capture mode: agent-work-record
- Conversation evidence: current ChatGPT discussion, partial
- Date: 2026-10-08

## Trigger

The user observed that Framework Learning had become too content-heavy and asked
whether it should be reorganized, whether CLI was complete, and whether the page had
a real command console/workbench.

After verifying main, the implementation separated:
- learning;
- project status;
- Creator execution.

## Implemented

- added Creator Workbench;
- added Project status / Creator switch inside existing Workbench;
- moved executable Knowledge Creator out of Framework Learning;
- added direct Framework -> Creator Workbench navigation;
- kept current Creator Knowledge CLI intact;
- showed Knowledge as available and Instance/Upgrade/Migration as planned;
- kept arbitrary shell execution unavailable;
- collapsed language, Provider reference, package internals, and 00–05 reference;
- removed duplicate Knowledge Creator from Framework page;
- added bilingual copy, responsive layout, and regression coverage.

## Verification target

- npm run build
- npm run test:framework-ui-v1
- npm run check
- branch CI
- PR merge
- main CI
