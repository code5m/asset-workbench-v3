# Git History Boundary

Asset Workbench V3 is an independent Git repository rooted at this directory.
The Provider Platform v1 stable baseline is tagged `provider-platform-v1`.

The parent `secondBrain` repository is intentionally not changed by this
project's Git workflow. It contains unrelated user work and may show this
directory as untracked; that is recorded as `PARENT_REPO_BOUNDARY_DEBT`, not
treated as a reason to stage, reset, or otherwise mutate the parent repository.

Only project source, tests, documentation, managed knowledge assets, and safe
provider configuration are versioned. The following are excluded:

- `.asset-workbench-data/` runtime state and capture caches;
- OS-keyring credentials and all credential material;
- local CodeArts/OpenCode agent state;
- dependencies, build output, logs, and local overrides.

No remote is configured for this repository. Future remotes must be added and
validated separately; this baseline performs no push.
