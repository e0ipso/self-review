---
type: practice
title: Copy original-code verbatim from the source file
description: >-
  The <original-code> in a suggestion must match the file content exactly; the
  applying agent locates the replacement target via text matching.
tags:
  - self-review
  - suggestions
  - xml
kk_schema_version: 3
kk_id: practice-copy-original-code-verbatim-from-the-source-file
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Inside `<suggestion>`, the `<original-code>` element must be the exact text at the referenced lines, copied verbatim from the file (including leading whitespace).

**Why:** The [[self-review-apply-skill]] uses text matching to find the replacement target. Any deviation (re-indented, normalized whitespace, paraphrased) will cause the apply step to fail to locate the code.

**How to apply:** When constructing suggestions in [[self-review-critique-skill]], read the actual file content and copy the target lines literally rather than reconstructing them from the diff.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
