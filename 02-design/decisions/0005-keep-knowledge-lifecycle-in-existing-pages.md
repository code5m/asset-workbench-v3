# Decision: Keep the knowledge lifecycle in existing product pages

Status: accepted

## Context

After adopting substantive conversation discoveries as project assets, the product needed a UI audit to determine whether a new knowledge-management page was required.

The existing navigation already contains:

1. Intro
2. Guide
3. Asset Space
4. Console
5. AI Connect
6. Framework & Starter

Asset Space already supports managed Conversation, Transcript, Work Record, Design, and Decision assets, including promotion actions.

## Decision

Do **not** add a seventh Knowledge or Decisions page.

Instead, expose the knowledge lifecycle across the existing journey:

- **Intro** explains the overall Conversation → Work Record → Design → Decision model.
- **Guide** explains what happens to project knowledge after setup.
- **Asset Space** is the primary place to review evidence, inspect relations, and promote Work Records into Design / Decision assets.
- **AI Connect** owns capture/integration and explicitly states that capture evidence does not automatically become a formal decision.
- **Console** remains focused on workspace/version facts.
- **Framework & Starter** remains focused on framework architecture and extension.

## Rationale

- Avoid duplicate navigation and overlapping ownership.
- Keep the beginner journey understandable.
- Put explanation where the user naturally encounters the concept.
- Preserve Asset Space as the single real-filesystem view and knowledge promotion surface.
- Keep AI Connect responsible for ingress, not governance conclusions.

## Consequences

- The navigation remains six sections.
- A reusable KnowledgeLifecycle explainer may appear in multiple existing pages.
- Future knowledge-management capabilities should first be integrated into Asset Space before introducing a new page.
- A new page is justified only if a future workflow develops a distinct responsibility that Asset Space cannot reasonably own.

## Sources

- Conversation evidence: transcript_chatgpt_20261007_framework_asset_core_ssot
- Work Record: conv_chatgpt_20261007_knowledge_lifecycle_page_audit

## Related Assets

- src/components/KnowledgeLifecycle.tsx
- src/components/WelcomePage.tsx
- src/components/GuidePage.tsx
- src/components/AssetExplorer.tsx
- src/components/ProviderManager.tsx
- src/data/navigation.ts
