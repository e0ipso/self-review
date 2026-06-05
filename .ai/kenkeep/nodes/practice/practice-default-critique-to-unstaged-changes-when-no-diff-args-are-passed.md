---
schema_version: 1
id: practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed
title: Default critique to unstaged changes when no diff args are passed
kind: practice
tags:
  - self-review
  - critique
  - cli
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  If $ARGUMENTS is empty, run plain `git diff` (unstaged) rather than erroring
  or prompting.
---
The critique skill parses `$ARGUMENTS` and passes it through to `git diff`. When the argument string is empty, it defaults to plain `git diff` (unstaged changes). The argument grammar matches the self-review CLI: `--staged`, `HEAD~3`, `main..feature-branch`, `-- path/to/file`, etc.

If the resulting diff is empty, report "No changes to review." and stop without writing an output file.
