---
schema_version: 1
id: practice-load-the-original-diff-context-before-applying-review-feedback
title: Load the original diff context before applying review feedback
kind: practice
tags:
  - self-review
  - git-diff
  - context
derived_from:
  - .opencode/skills/self-review-apply/SKILL.md
relates_to: []
confidence: high
summary: >-
  Reconstruct the reviewer's view via git diff (git mode) or by reading source
  files (directory mode) before editing.
---
Self-review XML records two modes via root-element attributes: git mode (`git-diff-args` + `repository`) and directory mode (`source-path`). In git mode, re-run `git diff <git-diff-args>` from the repository path to recreate the diff the reviewer saw. In directory mode, read each commented file from `source-path` (file `path` attributes are relative to it).

Without this context you are working blind. For large diffs or files, narrow the read to the line ranges referenced by comments plus surrounding context.
