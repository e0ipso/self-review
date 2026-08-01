---
type: practice
title: Default critique to unstaged changes when no diff args are passed
description: >-
  If $ARGUMENTS is empty, run plain `git diff` (unstaged) rather than erroring
  or prompting.
tags:
  - self-review
  - critique
  - cli
kk_schema_version: 3
kk_id: practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The critique skill parses `$ARGUMENTS` and passes it through to `git diff`. When the argument string is empty, it defaults to plain `git diff` (unstaged changes). The argument grammar matches the self-review CLI: `--staged`, `HEAD~3`, `main..feature-branch`, `-- path/to/file`, etc.

If the resulting diff is empty, report "No changes to review." and stop without writing an output file.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
