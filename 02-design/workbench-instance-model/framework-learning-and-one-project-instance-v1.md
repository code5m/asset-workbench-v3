# Framework Learning and One-Project Instance Model v1

Status: accepted design

## Problem

Asset Workbench currently serves two very different purposes:

1. helping the user **learn and improve the framework itself**;
2. helping the user **study a real company or personal business system**.

When the framework repository is loaded into the business Workspace Console, the
UI makes these roles look identical. This causes a major cognitive problem: the
user cannot tell whether they are inspecting the framework or studying a business
project.

The existing five technical package cards also expose implementation names before
the user has a stable product mental model. In particular, `Starter` is easily
confused with Spring Boot Starter or Maven concepts even though the current code
only initializes the 00–05 knowledge structure.

## Product principle

The explanatory pages are part of the product itself.

They exist so the user can visually learn:

- what the framework is;
- how its directories and runtime are divided;
- how AI connects;
- how one real business project is bound;
- how knowledge is captured;
- how the framework may evolve later.

Do not reduce these pages to developer documentation.

## Primary model

```text
Central Asset Workbench Framework
        |
        v
Workbench Instance / CLI / Scaffold
(full capability is future)
        |
        v
One Business Project Binding
        |
        +--> Project Knowledge
        |
        +--> Provider / Capture
        |
        v
Framework Evolution / Distribution
```

## Runtime modes

### Framework self mode

The running project root equals the Asset Workbench application root.

Purpose:

- learn the framework;
- inspect framework files;
- inspect framework knowledge assets;
- iterate and test the framework.

The framework may still be scanned so Asset Space can explain its real files.
However, business workflow pages must not present the framework repository as if
it were a managed business system.

### Business project mode

The project root points to an external real project.

Purpose:

- study one business system;
- inspect its code and Git facts;
- capture AI work around that system;
- preserve conversations, designs, decisions, and derived knowledge;
- later freeze versions and derive models/graphs.

At the current stage, one Workbench instance should bind one business system.

## Six top-level concepts

1. **Framework** — the central Workbench implementation.
2. **Instance / CLI** — future full capability that creates a Workbench instance.
3. **One Project Binding** — the current instance binds one business system.
4. **Knowledge** — code/docs/conversations/designs/decisions/derived assets.
5. **Provider** — AI ingress and capture.
6. **Evolution** — validated improvements return to the central framework and may
   later be distributed to other instances.

Technical packages are implementation details under this model.

## Starter correction

Current `packages/starter` behavior:

- creates 00–05;
- creates README / AGENTS;
- creates Transcript / Work Record / Decisions structure;
- requires a missing or empty target.

It does **not**:

- generate Java / Node / Python business code;
- behave like Spring Boot Starter;
- act like Maven POM;
- create a full independent Workbench runtime instance.

UI wording therefore calls this capability **Knowledge Init / 项目知识初始化器**.
The code package name remains `starter` for compatibility.

## Future full instance creation

A future CLI/scaffold may create a full Workbench instance bound to one business
project. It should include framework version identity, migration state, Provider
configuration boundary, and future upgrade compatibility.

This design intentionally does not implement that full generator yet.

## UX rules

- Framework page is a visual learning manual first.
- The six-role model appears before package names.
- Technical package cards are collapsed secondary detail.
- Console hides business metrics/repository flow in framework-self mode and shows
  an explicit explanation instead.
- Asset Space may show framework files in self mode but must label them as
  framework learning/self-check assets.
- Guide states one-instance-one-business-system and does not prefill the framework
  source path as though it were a business project.

## RSI boundary

RSI remains a long-term goal. This model prepares the distinction between central
framework, instances, project evidence, and future distribution, but does not
claim autonomous RSI.
