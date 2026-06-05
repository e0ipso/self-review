---
schema_version: 1
id: >-
  practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild
title: Hand off curate runs via git diff and optional pre-commit index rebuild
kind: practice
tags:
  - kb-curate
  - handoff
  - index
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: medium
summary: >-
  Tell the user to review with `git diff .ai/knowledge-base/`; the curator
  already regenerated INDEX/GRAPH at end-of-run.
---
After resolution, instruct the user to review changed nodes and conflict files with `git diff .ai/knowledge-base/` and commit when satisfied. The curator regenerated `INDEX.md`/`GRAPH.md` at end-of-run. For subsequent hand edits, a pre-commit hook running `npx @e0ipso/ai-knowledge-base index rebuild --harness "$HARNESS" --stage` keeps them aligned.

**Why:** Keeps the reviewer as the final gate while ensuring index files do not drift from `nodes/` on manual edits.

**How to apply:** Do not re-run the index rebuild inside the curate flow itself — only mention it for the hand-edit case.
