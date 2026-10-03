# First Import Guide

The first import should be understandable without knowing the internal model.

## Step 1. Choose Project Root

Pick the local project folder. For example:

```text
/home/ainfinit/Documents/ProjectNoChinese/backV8
```

This folder is a discovery source. It is not the long-term version truth.

## Step 2. Discover Assets

Scan for:

- Git repositories;
- design documents;
- guides and reports;
- conversation records;
- generated indexes and analysis.

## Step 3. Confirm Identity

For code, identity comes from Git remote URLs.

For documents and conversations, identity comes from path, source, version, and
manifest entries.

## Step 4. Freeze Version

Freeze a project-level WorkspaceVersion. It contains repository commits and an
asset manifest.

## Step 5. Generate Derived Assets

After Raw and manifest verification, generate file diff, CodeGraph, semantic
indexes, summaries, and cross-asset relations.

