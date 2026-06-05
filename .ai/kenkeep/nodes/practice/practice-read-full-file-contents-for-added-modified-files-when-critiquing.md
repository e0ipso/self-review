---
schema_version: 1
id: practice-read-full-file-contents-for-added-modified-files-when-critiquing
title: Read full file contents for added/modified files when critiquing
kind: practice
tags:
  - self-review
  - critique
  - context
derived_from:
  - .opencode/skills/self-review-critique/SKILL.md
relates_to: []
confidence: medium
summary: >-
  Read the current file (not just the diff hunks) to understand surrounding
  code; skip reading for deleted or binary files.
---
For added and modified files, read the full current file content so the critique has context beyond the changed lines. For renamed files, read at the new path. Skip reading deleted files (the diff has everything) and binary files entirely.

When the diff touches many files (>15), prioritize reading files with the largest diffs first. For very large files, read only ~50 lines of context around each changed region.
