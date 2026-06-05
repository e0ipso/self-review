---
schema_version: 1
id: map-self-review-cli-invocations
title: self-review CLI invocations
kind: map
tags:
  - cli
  - flags
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  CLI accepts git-diff-style arguments plus `--staged`, `--resume-from`, and
  bare invocation for working-tree review.
---
Documented invocations:
- `self-review --staged` — review staged changes
- `self-review main` — review changes between branches
- `self-review HEAD^` — review the last commit
- `self-review` — review current changes (or, in non-repo directories, treat all files as new)
- `self-review --staged --resume-from review.xml` — resume a prior review

Arguments are passed through to `git diff`. Default output is `./review.xml`, configurable via `output-file`.
