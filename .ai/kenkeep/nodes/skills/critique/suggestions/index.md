# kenkeep Index: skills / critique / suggestions

↑ Parent: [critique](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Attach a suggestion block whenever a concrete fix is possible**](practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) to learn about: For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually. #self-review #critique #suggestions
- Open [**Copy original-code verbatim from the source file**](practice-copy-original-code-verbatim-from-the-source-file.md) to learn about: The <original-code> in a suggestion must match the file content exactly; the applying agent locates the replacement target via text matching. #self-review #suggestions #xml
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) to learn about: For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually. #self-review #suggestions #critique

## Components (what exists)
_None yet._

## By topic

### #self-review
- Open [**Set viewed="true" on every file in critique output**](../output/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
### #suggestions
- Open [**Attach a suggestion block whenever a concrete fix is possible**](practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
- Open [**Apply review suggestions bottom-to-top by line number**](../../apply/practice-apply-review-suggestions-bottom-to-top-by-line-number.md) — Sort suggestions by line number descending before applying so earlier edits don't invalidate later line references.
### #critique
- Open [**Default critique categories**](../configuration/map-default-critique-categories.md) — Six built-in comment categories used when .self-review.yaml is absent: question, bug, security, style, task, nit.
- Open [**Read categories from .self-review.yaml before generating critique**](../configuration/practice-read-categories-from-self-review-yaml-before-generating-critique.md) — If .self-review.yaml exists, use only its declared categories; otherwise fall back to the six built-in defaults.
- Open [**Use categories from .self-review.yaml when present**](../configuration/practice-use-categories-from-self-review-yaml-when-present.md) — If \`.self-review.yaml\` exists with a \`categories\` array, use only those category names. Otherwise, fall back to the documented defaults.
### #xml
- Open [**review.xml format and XSD**](../../../review-xml/schema/map-review-xml-format-and-xsd.md) — v3 XML review documents contain files, comments, suggestions, attachments, and ordered flat reply threads.
- Open [**self-review XML v3 schema**](../../../review-xml/schema/map-self-review-xml-v1-schema.md) — The canonical v3 XSD defines files, comments, suggestions, attachments, and ordered reply threads.
- Open [**Pair line-number attributes correctly in review comments**](../../../review-xml/line-anchors/practice-pair-line-number-attributes-correctly-in-review-comments.md) — Use exactly one complete new-line or old-line pair on line comments; omit both pairs for file-level comments.