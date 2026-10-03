# Code Version Model

The code asset model is:

```text
Workspace
└── WorkspaceVersion
    ├── RepositoryRevision: phantom-payment@commit
    ├── RepositoryRevision: phantom-operation@commit
    └── RepositoryRevision: ...
```

Rules:

- local directory is discovery only;
- Git remote URL is repository identity;
- managed mirror is the refresh source;
- master commit is the Raw code fact;
- release refs are observation evidence;
- dirty local changes are excluded from Raw.

