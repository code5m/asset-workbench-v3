# Evidence-Driven Framework Evolution v1

Status: accepted design

## Problem

Asset Workbench is intended to improve through real project use. Without an explicit
governance model, however, one project's special case can leak into shared Core,
or an AI-generated improvement can be distributed before it has enough evidence,
compatibility analysis, migration planning, or rollback coverage.

## Goal

Create a repeatable path from real project practice to reusable framework
capability, while keeping project-specific behavior local until it proves itself.

## Model

```text
Real project practice
-> Conversation / Work Record / runtime evidence
-> Pattern discovery
-> Framework Candidate
-> Design
-> Decision
-> Implementation
-> Regression + representative-project verification
-> Versioned framework release
-> Controlled project adoption / migration
-> Feedback
-> next observation
```

## Promotion bars

### Project observation

A problem, idea, or improvement discovered in one managed project. It remains
project-local by default.

### Repeated pattern

The same concern appears across multiple projects, or there is unusually strong
evidence that the abstraction is reusable beyond the source project.

### Framework Candidate

A proposed shared capability with explicit:

- source projects/evidence;
- problem statement;
- intended scope;
- non-goals;
- compatibility impact;
- migration expectation;
- rollback expectation;
- verification plan.

A candidate is not yet Core.

### Framework capability

Only after Design/Decision, implementation, regression verification, and
representative real-project validation may the capability enter shared Framework
Core.

### Release and adoption

Projects adopt a versioned capability/schema/rule. Distribution is not performed
by copying the entire Workbench repository into each managed project.

## Controlled RSI

RSI is a higher-stage objective, not permission for ungated self-modification.

Allowed loop:

```text
Discover -> Propose -> Prove -> Promote -> Propagate -> Observe
```

Every transition remains subject to evidence, versioning, compatibility,
migration, rollback, and verification.

## Relationship to existing knowledge assets

- Conversation / Transcript = evidence of discussion.
- Work Record = execution record.
- Design = reusable proposal.
- Decision = accepted ruling.
- Framework release = validated implementation package/version.
- Project adoption = a managed project's explicit uptake of that release.

## Initial scope

This design establishes governance and explanatory UI only. It does not yet add:

- a Framework Candidate database;
- cross-project pattern mining;
- release/adoption automation;
- migration orchestration;
- capability version manifests;
- automatic RSI execution.

Those are future capabilities that must themselves pass through this model.
