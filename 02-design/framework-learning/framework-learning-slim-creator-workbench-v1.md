# Framework Learning Slim + Creator Workbench v1

Status: implemented design

## Goal

Separate learning from execution.

Before this change, Framework Learning accumulated:
- framework mental models;
- directory and key-file teaching;
- Instance / CLI concepts;
- real Knowledge Creator forms;
- language ecosystem reference;
- Provider reference implementations;
- 00–05 skeleton reference.

That made the page useful but increasingly long and cognitively mixed.

The new information architecture is:

```text
Framework Learning
├── understand the model
├── inspect directories and key files
├── understand Instance / CLI / versions
└── open deeper reference sections on demand

Workbench
├── Project status
└── Creator
    ├── Knowledge       available
    ├── Instance        planned
    ├── Upgrade         planned
    └── Migration       planned
```

## Learning page rules

Framework Learning remains a product capability, not disposable documentation.

It keeps:
- the beginner mental model;
- directory map;
- key-file explanations;
- runtime / version explanations;
- implemented-vs-planned truth.

It no longer embeds the executable Knowledge Creator form.

Language ecosystems, Provider reference implementations, package internals, and the
00–05 reference are progressively disclosed instead of all being expanded by default.

## Creator Workbench

The existing Workbench gets two top-level views:

- Project status
- Creator

Creator Workbench is the operational surface.

Knowledge Creator remains the first implemented capability and reuses the existing
`StarterCreator`, Local API, Creator Core, and CLI.

Planned capabilities are shown as status cards only. They do not expose fake action
buttons.

## Navigation

Framework Learning links directly into Creator Workbench.

Existing framework deep-link focus `starter` also routes to Creator Workbench
instead of scrolling to a duplicate form.

No extra left-navigation item is added.

## Security boundary

The browser still does not expose arbitrary shell execution.

Operational actions remain typed Capability actions:

```text
UI -> Creator API -> Creator Core
CLI -------------> Creator Core
```

## Verification

Regression tests enforce:
- no `StarterCreator` in Framework Learning;
- Creator Workbench owns executable Knowledge Creator;
- app can deep-link from Framework to Creator Workbench;
- no child_process / exec / spawn in Creator Workbench;
- planned capabilities remain visibly planned;
- technical/reference sections use progressive disclosure.
