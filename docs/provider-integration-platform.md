# Provider Integration Platform

## Purpose

Provider Manager is the control plane for Agent conversation capture. Capture
Kernel remains the data plane: adapters/runtime submit canonical events and only
the existing materializer creates managed transcripts.

## Extension protocol

Built-in definitions live in `server/providerPlatformService.ts`; custom
definitions are stored separately under the ignored local runtime data folder.
Definitions describe discovery, required authentication fields, event source,
generic mappings, finalization, and verification. They never contain secrets.

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

1. Open **Provider 管理**.
2. Select a provider and review installation, integration, authentication, and
   real verification evidence.
3. For CodeArts, save masked AK/SK then choose **测试连接**.
4. Enable or disable capture without deleting previous transcripts.
5. Add a custom provider when generic mapping is sufficient; use a custom
   transformer only when its event semantics cannot be expressed safely.

`runtimeVerified` is evidence-only: it is true only after a real ended session
has materialized a transcript. UI controls and fixtures never set it true.
