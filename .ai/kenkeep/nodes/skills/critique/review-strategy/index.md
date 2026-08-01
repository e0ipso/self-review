# kenkeep Index: skills / critique / review-strategy

↑ Parent: [critique](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Prioritize the largest diffs when reviewing many files**](practice-prioritize-the-largest-diffs-when-reviewing-many-files.md) to learn about: For diffs with >15 files, read files with the largest diffs first; for very large files, read only ±50 lines around changed regions. #self-review #critique #performance
- Open [**Read full file contents for added/modified files when critiquing**](practice-read-full-file-contents-for-added-modified-files-when-critiquing.md) to learn about: Read the current file (not just the diff hunks) to understand surrounding code; skip reading for deleted or binary files. #self-review #critique #context
- Open [**Skip files that look correct rather than forcing comments**](practice-skip-files-that-look-correct-rather-than-forcing-comments.md) to learn about: Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file. #self-review #critique #scope
- Open [**Skip files that look correct; do not force comments on every file**](practice-skip-files-that-look-correct-do-not-force-comments-on-every-file.md) to learn about: Critique should be substantive — emit zero comments for files without real issues rather than padding output. #self-review #critique #scope

## Components (what exists)
_None yet._

## By topic

### #critique
- Open [**Default critique categories**](../configuration/map-default-critique-categories.md) — Six built-in comment categories used when .self-review.yaml is absent: question, bug, security, style, task, nit.
- Open [**Read categories from .self-review.yaml before generating critique**](../configuration/practice-read-categories-from-self-review-yaml-before-generating-critique.md) — If .self-review.yaml exists, use only its declared categories; otherwise fall back to the six built-in defaults.
- Open [**Use categories from .self-review.yaml when present**](../configuration/practice-use-categories-from-self-review-yaml-when-present.md) — If \`.self-review.yaml\` exists with a \`categories\` array, use only those category names. Otherwise, fall back to the documented defaults.
### #self-review
- Open [**Set viewed="true" on every file in critique output**](../output/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
### #scope
- Open [**Default bootstrap scope**](../../../knowledge-base/bootstrap/discovery/map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../../../knowledge-base/bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.
### #context
- Open [**Load the original diff context before applying review feedback**](../../apply/practice-load-the-original-diff-context-before-applying-review-feedback.md) — Reconstruct the reviewer's view via git diff (git mode) or by reading source files (directory mode) before editing.
- Open [**Read full file contents for added/modified files when critiquing**](practice-read-full-file-contents-for-added-modified-files-when-critiquing.md) — Read the current file (not just the diff hunks) to understand surrounding code; skip reading for deleted or binary files.
### #performance
- Open [**Lazy-load file hunks in large-payload mode**](../../../app/architecture/practice-lazy-load-file-hunks-in-large-payload-mode.md) — When max-files or max-total-lines is exceeded, send file metadata only in diff:load and fetch hunks per file on demand.
- Open [**Trigger large-payload guard at configurable file/line thresholds**](../../../app/architecture/practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md) — When diff exceeds \`max-files\` (default 500) or \`max-total-lines\` (default 100000), prompt the user; continuing enables lazy loading.
- Open [**Prioritize the largest diffs when reviewing many files**](practice-prioritize-the-largest-diffs-when-reviewing-many-files.md) — For diffs with >15 files, read files with the largest diffs first; for very large files, read only ±50 lines around changed regions.