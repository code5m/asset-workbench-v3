# Provider Adapter capture contract and honest status model

- Type: design
- Created: 2026-10-04T18:14:05.709Z
- ID: design_566cb679-8e45-4f01-9887-f6f6cd162474

## Context

## Goals

## Proposed Design

# Provider Adapter capture contract and honest status model

## Problem
Provider status was hardcoded and could not distinguish "officially supported" from
"verified on this machine". CodeBuddy had no adapter, and providers that could not be
connected had no honest representation.

## Context
The project already has a provider-neutral Capture Kernel (raw-events.jsonl /
events.jsonl / state.json) plus a verified Codex lifecycle-hook adapter. The constraint
is to attach real per-provider data lines without refactoring the kernel or creating a
second session store.

## Goals
- Every provider reaches an explicit terminal state backed by evidence.
- runtimeVerified=true only from a real ended capture with a materialized transcript.
- One providerSessionId maps to exactly one CaptureSession.
- Capture never blocks the provider (fail-open).
- Provider-specific logic stays in the adapter; the kernel stays provider-neutral.

## Proposed Design
Keep the single boundary Provider -> Provider Adapter -> Capture Kernel -> Managed Transcript:
1. One provider-aware hook entry point that forwards provenance fields.
2. Deterministic canonical identities from real stable provider fields (retries dedupe,
   distinct tool invocations in one generation stay distinct).
3. Subagent lifecycle produces no main-transcript event.
4. Official-transcript importer for providers publishing their session transcript path
   (CodeBuddy hook payload transcript_path), guarded to the official root, idempotent,
   with exact-duplicate suppression.
5. Provider status derived from real evidence (executable, version, credentials, hook
   config, ended captures with transcripts).

## Risks
- CodeBuddy official transcript layout (index.json + messages/*.json) is version dependent;
  the importer is restricted to the official history root and fails closed on unknown shape.
- Headless session creation needs interactive login, so unattended fabrication is impossible.
- CodeArts stays blocked until the user provisions AK/SK credentials.

## Open Questions
- Should ChatGPT get a dedicated importer for user-supplied export files?
- If OpenCode is installed later, its plugin/SDK event stream is the next candidate.

## Sources
- docs/provider-capture.md
- 03-docs/guides/provider-adapters.md
- AGENTS.md


## Sources

- Conversation: conv_d20d8a09-7585-4896-9700-9b88fcf4fd35
