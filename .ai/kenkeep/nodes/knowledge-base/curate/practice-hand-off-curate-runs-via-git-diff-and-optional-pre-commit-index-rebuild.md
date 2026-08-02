---
type: practice
title: Hand off curate runs via git diff and optional pre-commit index rebuild
description: >-
  Tell the user to review with `git diff .ai/knowledge-base/`; the curator
  already regenerated INDEX/GRAPH at end-of-run.
tags:
  - kb-curate
  - handoff
  - index
kk_schema_version: 3
kk_id: >-
  practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild
kk_derived_from:
  - .cursor/skills/kb-curate/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: medium
---
After resolution, instruct the user to review changed nodes and conflict files with `git diff .ai/knowledge-base/` and commit when satisfied. The curator regenerated `INDEX.md`/`GRAPH.md` at end-of-run. For subsequent hand edits, a pre-commit hook running `npx @e0ipso/ai-knowledge-base index rebuild --harness "$HARNESS" --stage` keeps them aligned.

**Why:** Keeps the reviewer as the final gate while ensuring index files do not drift from `nodes/` on manual edits.

**How to apply:** Do not re-run the index rebuild inside the curate flow itself — only mention it for the hand-edit case.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-curate/SKILL.md](.cursor/skills/kb-curate/SKILL.md)
<!-- kk:citations:end -->
