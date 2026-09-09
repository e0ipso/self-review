# kenkeep Index: skills / critique / configuration

↑ Parent: [critique](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Default critique to unstaged changes when no diff args are passed**](practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed.md) to learn about: If $ARGUMENTS is empty, run plain \`git diff\` (unstaged) rather than erroring or prompting. #self-review #critique #cli
- Open [**Read categories from .self-review.yaml before generating critique**](practice-read-categories-from-self-review-yaml-before-generating-critique.md) to learn about: If .self-review.yaml exists, use only its declared categories; otherwise fall back to the six built-in defaults. #self-review #critique #categories
- Open [**Use categories from .self-review.yaml when present**](practice-use-categories-from-self-review-yaml-when-present.md) to learn about: If \`.self-review.yaml\` exists with a \`categories\` array, use only those category names. Otherwise, fall back to the documented defaults. #self-review #critique #categories

## Components (what exists)
- Open [**self-review-critique skill**](map-self-review-critique-skill.md) to learn about: Generate a guide and evidence-based review XML for local or remote diffs. #self-review #skills #critique
- Open [**Default critique categories**](map-default-critique-categories.md) to learn about: Six built-in comment categories used when .self-review.yaml is absent: question, bug, security, style, task, nit. #self-review #categories #critique

## By topic

### #critique
- Open [**Default critique categories**](map-default-critique-categories.md) — Six built-in comment categories used when .self-review.yaml is absent: question, bug, security, style, task, nit.
- Open [**Read categories from .self-review.yaml before generating critique**](practice-read-categories-from-self-review-yaml-before-generating-critique.md) — If .self-review.yaml exists, use only its declared categories; otherwise fall back to the six built-in defaults.
- Open [**Use categories from .self-review.yaml when present**](practice-use-categories-from-self-review-yaml-when-present.md) — If \`.self-review.yaml\` exists with a \`categories\` array, use only those category names. Otherwise, fall back to the documented defaults.
### #self-review
- Open [**Set viewed="true" on every file in critique output**](../output/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
### #categories
- Open [**Default critique categories**](map-default-critique-categories.md) — Six built-in comment categories used when .self-review.yaml is absent: question, bug, security, style, task, nit.
- Open [**Read categories from .self-review.yaml before generating critique**](practice-read-categories-from-self-review-yaml-before-generating-critique.md) — If .self-review.yaml exists, use only its declared categories; otherwise fall back to the six built-in defaults.
- Open [**Use categories from .self-review.yaml when present**](practice-use-categories-from-self-review-yaml-when-present.md) — If \`.self-review.yaml\` exists with a \`categories\` array, use only those category names. Otherwise, fall back to the documented defaults.
### #cli
- Open [**Kenkeep CLI**](../../../knowledge-base/tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Bootstrap document exclusions**](../../../knowledge-base/tooling/map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Select the harness for harness-specific kenkeep commands**](../../../knowledge-base/tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
### #skills
- Open [**Knowledge-base capture and curation workflow**](../../../knowledge-base/curate/map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.
- Open [**kk-bootstrap skill**](../../../knowledge-base/bootstrap/workflow/map-kb-bootstrap-skill.md) — Supervised seeding from existing Markdown, with validated node writes.
- Open [**self-review-critique skill**](map-self-review-critique-skill.md) — Generate a guide and evidence-based review XML for local or remote diffs.