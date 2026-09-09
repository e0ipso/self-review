---
type: practice
title: Review knowledge-base changes via git diff before committing
description: >-
  Curator and bootstrap writes land directly in nodes/; accept with git commit,
  reject with git restore.
tags:
  - knowledge-base
  - git
  - review
kk_schema_version: 3
kk_id: practice-review-knowledge-base-changes-via-git-diff-before-committing
kk_derived_from:
  - .ai/kenkeep/README.md
kk_relates_to:
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
All knowledge-base mutations (curate, bootstrap, manual add) write directly to `.ai/kenkeep/nodes/` and surface as normal file changes in `git status`. The human-in-the-loop step is git itself: inspect with `git diff`, accept by committing, reject with `git restore <file>`.

This applies to curator decisions (`add` creates new files, `modify` rewrites in place), contradictions written under `conflicts/`, and any node produced via `/kk-add` or `npx kenkeep node add`.

<!-- kk:citations:start -->
# Citations

[1] [.ai/kenkeep/README.md](../../../README.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-directory](map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
