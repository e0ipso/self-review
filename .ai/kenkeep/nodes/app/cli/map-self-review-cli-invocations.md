---
type: map
title: self-review CLI invocations
description: >-
  CLI accepts git-diff-style arguments plus `--staged`, `--resume-from`, and
  bare invocation for working-tree review.
tags:
  - cli
  - flags
kk_schema_version: 3
kk_id: map-self-review-cli-invocations
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Documented invocations:
- `self-review --staged` — review staged changes
- `self-review main` — review changes between branches
- `self-review HEAD^` — review the last commit
- `self-review` — review current changes (or, in non-repo directories, treat all files as new)
- `self-review --staged --resume-from review.xml` — resume a prior review

Arguments are passed through to `git diff`. Default output is `./review.xml`, configurable via `output-file`.

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
