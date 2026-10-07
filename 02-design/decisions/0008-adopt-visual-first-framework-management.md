# Decision: Adopt visual-first framework management

Status: accepted

## Context

The user explicitly clarified that they can only reliably understand, manage, and
improve the framework through visible UI state. A code change, document, or hidden
runtime rule is not enough if the running page does not make the result obvious.

The previous framework-learning work was structurally correct, but the user
reported that they could not see the change in the page they were currently
looking at. This exposed a product requirement stronger than "good documentation":
the running application itself must continuously show the framework/runtime
identity needed to reason about the system.

## Decision

Adopt **Visual-First Framework Management** as a product rule.

Important framework state should be visible in the UI before the user is expected
to infer it from Git, source code, configuration files, logs, or command-line
output.

At minimum, the persistent navigation should show:

- current runtime mode;
- current framework version;
- current framework revision;
- current bound business project, or an explicit "not bound" state.

The Framework page remains the visual learning manual for deeper architecture and
evolution concepts.

## Rationale

- The user's learning loop depends on seeing the system, not remembering hidden
  implementation details.
- Persistent visible state prevents confusion about whether the application is
  running old code, framework-self mode, or a bound business project.
- A visible revision gives a direct way to compare the running UI with the merged
  GitHub revision.
- Visual management is especially important as AI increasingly performs
  implementation work that the user did not manually type line by line.

## Consequences

- Runtime identity becomes part of the Local API contract.
- Navigation becomes a persistent runtime-status surface, not only a page switcher.
- Future framework version/adoption/migration state should prefer visual status
  cards, matrices, diagrams, and explicit badges over hidden configuration.
- Documentation remains useful for precision and history, but the primary
  management experience should be visible in the product.
