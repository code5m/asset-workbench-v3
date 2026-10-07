# Creator CLI / Knowledge implementation

- Source: ChatGPT
- Capture mode: agent-work-record
- Conversation evidence: current ChatGPT discussion, partial
- Date: 2026-10-08

## Trigger

The user asked whether the CLI could be modeled as "Creator CLI Knowledge" and
whether the visual page could directly execute the capability, generate real
directories/files, and automatically verify the output.

## Investigation

Confirmed from main before implementation:

- `createStarter()` already generated the canonical 00–05 skeleton;
- `StarterCreator` already called a Local API endpoint;
- `npm run starter:create` already exposed a narrow command-line path;
- the existing starter regression created real temporary directories;
- full Workbench Instance Creator / Manifest / upgrade / migration / rollback were
  still planned.

## Implemented direction

Established the capability family:

```text
Creator
└── Knowledge
    ├── create
    └── verify
```

Implemented:

- shared `createKnowledge()` and `verifyKnowledge()` core;
- repository-local Creator CLI;
- Creator Knowledge Local API create/verify endpoints;
- backward-compatible starter API delegation;
- typed frontend Creator client;
- visual create + verify controls;
- automatic per-file/per-directory PASS/FAIL results;
- real Creator console embedded in Framework Learning;
- real current CLI examples plus clearly separate planned Instance command;
- bilingual UI copy and responsive styles;
- core, CLI E2E, and UI/API regression tests;
- Design and Decision 0010.

## Safety boundary

No arbitrary shell execution was added to React. The UI invokes typed Local API
actions only. Verification is read-only. Full Instance creation remains planned.

## Verification target

- `npm run test:framework-starter-v1`
- `npm run test:framework-ui-v1`
- `npm run build`
- `npm run check`
- branch CI
- PR CI
- merge main
- main CI
