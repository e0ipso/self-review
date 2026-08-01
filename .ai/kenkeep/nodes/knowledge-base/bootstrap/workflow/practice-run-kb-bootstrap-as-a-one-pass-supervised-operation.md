---
type: practice
title: 'Run kb-bootstrap as a one-pass, supervised operation'
description: >-
  Bootstrap is a one-time, supervised pass — work judgmentally by sampling and
  following cross-references, not exhaustively.
tags:
  - knowledge-base
  - bootstrap
  - workflow
kk_schema_version: 3
kk_id: practice-run-kb-bootstrap-as-a-one-pass-supervised-operation
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The user invokes kb-bootstrap in their normal session and watches in-flight, so they can correct course as you go. Survey existing markdown documentation, extract candidate knowledge nodes, and write them as new node files directly under `nodes/`.

Work judgmentally: explore, sample, and follow cross-references rather than reading every file end-to-end. The user reviews everything with `git diff` and accepts or rejects each node with `git commit` or `git restore <path>`.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
