# Provider Integration Platform

## Purpose

`AI 接入` is the product entry for Agent conversation capture. Its onboarding
page explains Provider, Hook, Plugin, ACP, Transcript, Work Record and Runtime
Verification in plain language. Provider Manager remains the control plane;
Capture Kernel remains the data plane.

## Extension protocol

Built-in definitions live in `server/providerPlatformService.ts`; custom
definitions are stored separately under the ignored local runtime data folder.
Definitions describe authentication, event source, mappings, finalization and verification. They never contain secrets or arbitrary executable commands. A custom Definition is configuration only; it is not considered a working realtime integration until a trusted Adapter/event mapping exists and real evidence is verified.

Use generic mapping for ordinary hook, CLI JSON, import, or plugin events. A
built-in transformer remains available for semantic providers such as OpenCode,
where streamed parts must merge by message ID before becoming one assistant
message.

## Credential boundary

CodeArts AK/SK are persisted through the operating system's Secret Service
(GNOME Keyring/libsecret on this machine), not through a project file, JSON,
SQLite, or browser storage. The small native bridge accepts a secret only on
standard input; it is never placed in a command-line argument. At use time the
runtime reads it just long enough to inject `CODEARTS_CLI_AK` and
`CODEARTS_CLI_SK` into the verification child-process environment, then lets
that process exit. API responses return only configured field names/statuses,
never prior values. Update and delete are explicit actions.

The automated platform check proves cross-process availability, deletion, and
redaction without using a real user credential. It also removes its generated
test credential in a `finally` block.

## Operator workflow

1. Open **AI 接入 → 入门说明** if Provider / Hook / Plugin / ACP terminology is unfamiliar.
2. Open **Provider 管理** and select a provider.
3. Review installation, authentication, event source and finalization in human-readable labels.
4. Choose **运行验证** to recompute Discovery → Authentication → Integration → Real Event → Transcript from real evidence.
5. For CodeArts, save masked AK/SK then choose **测试连接**.
6. Enable or disable capture without deleting previous transcripts. Disabled Providers are rejected by the capture data plane, not only hidden in the UI.
7. Add a custom Provider Definition only for declarative configuration; a trusted Adapter is still required before realtime capture can become ENABLED.

`runtimeVerified` is evidence-only: it is true only after a real ended session
has materialized a transcript. UI controls and fixtures never set it true.
