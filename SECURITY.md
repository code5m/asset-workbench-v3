# Security Policy

Asset Workbench reads local project files and captures AI conversation evidence, so
filesystem and credential boundaries are security-critical.

## Supported branch

Security fixes target the current `main` branch.

## Reporting a vulnerability

Please do not post credentials, local filesystem contents, access keys, or exploit
details in a public issue. Contact the repository maintainers through GitHub's private
security reporting / security advisory channel when available.

Include:

- affected commit/version
- reproduction steps
- expected vs actual behavior
- whether local files, credentials, Provider commands, or Capture events are involved

## Security invariants

Contributions must preserve these rules:

- the Local Asset API accepts loopback connections only
- custom Provider definitions cannot execute arbitrary commands
- Provider credentials remain in the operating-system secure store
- managed writes cannot escape the project root through symlinks
- disabling a Provider must stop new events at the capture data plane
- Transcript evidence must never be fabricated
- the Asset Space must not recursively load an entire large repository into memory
- large file previews must be bounded
