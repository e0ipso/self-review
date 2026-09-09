---
type: map
title: self-review-critique skill
description: >-
  Generate a guide and evidence-based review XML for local or remote diffs.
tags:
  - self-review
  - skills
  - critique
kk_schema_version: 3
kk_id: map-self-review-critique-skill
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to:
  - map-default-critique-categories
  - practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed
  - practice-read-categories-from-self-review-yaml-before-generating-critique
  - practice-use-categories-from-self-review-yaml-when-present
  - practice-set-author-to-your-model-name-on-every-generated-comment
  - practice-set-the-comment-author-attribute-to-the-model-name
  - practice-set-viewed-true-on-every-file-in-ai-generated-review-xml
  - practice-set-viewed-true-on-every-file-in-critique-output
  - practice-validate-generated-review-xml-against-the-xsd-before-finishing
  - practice-validate-generated-review-xml-against-the-xsd-with-xmllint
  - practice-prioritize-the-largest-diffs-when-reviewing-many-files
  - practice-read-full-file-contents-for-added-modified-files-when-critiquing
  - practice-skip-files-that-look-correct-do-not-force-comments-on-every-file
  - practice-skip-files-that-look-correct-rather-than-forcing-comments
  - practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible
  - practice-copy-original-code-verbatim-from-the-source-file
  - practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed
  - map-self-review-apply-skill
kk_depends_on: []
kk_confidence: high
---
The skill at `.agents/skills/self-review-critique/SKILL.md` first invokes self-review-guide with the same source. It reads local diff context or a materialized remote PR/MR, applies its evidence bar, and emits review.xml with comments and suggestions. It uses configured categories and output paths. Load the result using self-review <args> --resume-from review.xml.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](../../../../../../.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-default-critique-categories](map-default-critique-categories.md)
- Related: [practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed](practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed.md)
- Related: [practice-read-categories-from-self-review-yaml-before-generating-critique](practice-read-categories-from-self-review-yaml-before-generating-critique.md)
- Related: [practice-use-categories-from-self-review-yaml-when-present](practice-use-categories-from-self-review-yaml-when-present.md)
- Related: [practice-set-author-to-your-model-name-on-every-generated-comment](../output/practice-set-author-to-your-model-name-on-every-generated-comment.md)
- Related: [practice-set-the-comment-author-attribute-to-the-model-name](../output/practice-set-the-comment-author-attribute-to-the-model-name.md)
- Related: [practice-set-viewed-true-on-every-file-in-ai-generated-review-xml](../output/practice-set-viewed-true-on-every-file-in-ai-generated-review-xml.md)
- Related: [practice-set-viewed-true-on-every-file-in-critique-output](../output/practice-set-viewed-true-on-every-file-in-critique-output.md)
- Related: [practice-validate-generated-review-xml-against-the-xsd-before-finishing](../output/practice-validate-generated-review-xml-against-the-xsd-before-finishing.md)
- Related: [practice-validate-generated-review-xml-against-the-xsd-with-xmllint](../output/practice-validate-generated-review-xml-against-the-xsd-with-xmllint.md)
- Related: [practice-prioritize-the-largest-diffs-when-reviewing-many-files](../review-strategy/practice-prioritize-the-largest-diffs-when-reviewing-many-files.md)
- Related: [practice-read-full-file-contents-for-added-modified-files-when-critiquing](../review-strategy/practice-read-full-file-contents-for-added-modified-files-when-critiquing.md)
- Related: [practice-skip-files-that-look-correct-do-not-force-comments-on-every-file](../review-strategy/practice-skip-files-that-look-correct-do-not-force-comments-on-every-file.md)
- Related: [practice-skip-files-that-look-correct-rather-than-forcing-comments](../review-strategy/practice-skip-files-that-look-correct-rather-than-forcing-comments.md)
- Related: [practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible](../suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md)
- Related: [practice-copy-original-code-verbatim-from-the-source-file](../suggestions/practice-copy-original-code-verbatim-from-the-source-file.md)
- Related: [practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed](../suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md)
- Related: [map-self-review-apply-skill](../../apply/map-self-review-apply-skill.md)
<!-- kk:related:end -->
