---
schema_version: 1
id: practice-run-kb-bootstrap-as-a-one-pass-supervised-operation
title: 'Run kb-bootstrap as a one-pass, supervised operation'
kind: practice
tags:
  - knowledge-base
  - bootstrap
  - workflow
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Bootstrap is a one-time, supervised pass — work judgmentally by sampling and
  following cross-references, not exhaustively.
---
The user invokes kb-bootstrap in their normal session and watches in-flight, so they can correct course as you go. Survey existing markdown documentation, extract candidate knowledge nodes, and write them as new node files directly under `nodes/`.

Work judgmentally: explore, sample, and follow cross-references rather than reading every file end-to-end. The user reviews everything with `git diff` and accepts or rejects each node with `git commit` or `git restore <path>`.
