---
type: practice
title: Load the reviewed source before applying feedback
description: >-
  Reconstruct local git, directory or remote review context from the recorded
  source.
tags:
  - self-review
  - git-diff
  - context
kk_schema_version: 3
kk_id: practice-load-the-original-diff-context-before-applying-review-feedback
kk_derived_from:
  - .agents/skills/self-review-apply/SKILL.md
kk_relates_to:
  - map-self-review-apply-skill
kk_depends_on: []
kk_confidence: high
---
For git reviews, read git-diff-args and repository and recreate that diff. For directory reviews, resolve each commented path under source-path. For remote reviews, follow the apply skill materialization recipe using remote-url and the recorded provenance, reusing a matching clone when available. Read comment ranges with enough surrounding context before editing.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-apply/SKILL.md](../../../../../.agents/skills/self-review-apply/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-apply-skill](map-self-review-apply-skill.md)
<!-- kk:related:end -->
