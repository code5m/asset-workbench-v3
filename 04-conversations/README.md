# 04 Conversations

This directory uses a strict dual-evidence model. The first directory level
answers **what kind of evidence this is** before it answers which AI produced it.

```text
04-conversations/
├── transcripts/                 # original conversation evidence
│   ├── codex/
│   ├── codebuddy/
│   ├── opencode/
│   ├── trae/
│   ├── chatgpt/
│   ├── codearts/
│   ├── workbuddy/
│   └── other/
└── work-records/                # Agent-authored task summaries
    ├── codex/
    ├── codebuddy/
    ├── opencode/
    ├── trae/
    ├── chatgpt/
    ├── codearts/
    ├── workbuddy/
    ├── manual/
    └── other/
```

## Transcript

A Transcript is the original user/assistant conversation when it can genuinely
be obtained. It is stored as `transcript.md` with `metadata.json`.

Provider identity and capture method are separate dimensions. For example a
ChatGPT transcript imported by the user is still stored under
`transcripts/chatgpt/`; metadata records `captureMode: imported-transcript`.

## Agent Work Record

A Work Record is a structured summary of one Agent task: investigation, changes,
verification and outcome. It is stored as `conversation.md` with
`metadata.json`. It is useful evidence, but it is **not** presented as the
original chat.

Conversation evidence is not final product truth. Durable conclusions should be
promoted into `02-design/decisions` or maintained product/architecture docs.

## Migration

Legacy layouts such as `04-conversations/codex/` are migrated explicitly with:

```bash
npm run migrate:conversations-v2
```

The migration is idempotent, preserves asset IDs and metadata, rewrites related
paths where needed, and does not maintain a permanent dual-write compatibility
layout.


## Substantive discussion as project evidence

Keep a conversation when it changes what the project knows: for example when a
question exposes a hidden assumption, misleading terminology, duplicated source
of truth, an architectural trade-off, or an accepted decision.

For ChatGPT, a manually persisted active-chat excerpt is allowed only when it is
honest about its limits:

- use `captureMode: manual`;
- mark it `completeness: partial`;
- include only excerpts genuinely present in the active conversation;
- never label reconstructed text as a full transcript;
- keep the Agent Work Record separately;
- promote accepted conclusions into `02-design/decisions`.

The point is not to archive every chat message. The point is to preserve the
reasoning trail when the discussion itself produced reusable project knowledge.
