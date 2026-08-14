# kenkeep Index: review-xml / line-anchors

↑ Parent: [review-xml](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Line comments reference either old or new line numbers, never both**](practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) to learn about: Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither. #xml #comments #line-numbers
- Open [**Pair comment line numbers as either new or old, never both**](practice-pair-comment-line-numbers-as-either-new-or-old-never-both.md) to learn about: Self-review comments use exactly one new-line or old-line pair; file-level comments have neither. #self-review #xml #line-numbers
- Open [**Pair line-number attributes correctly in review comments**](practice-pair-line-number-attributes-correctly-in-review-comments.md) to learn about: Use exactly one complete new-line or old-line pair on line comments; omit both pairs for file-level comments. #self-review #xml #comments
- Open [**Pair line-number attributes correctly on review comments**](practice-pair-line-number-attributes-correctly-on-review-comments.md) to learn about: A comment has exactly one pair: new-line-start/end for added/context lines OR old-line-start/end for deleted lines. Never both. #self-review #xml #comments
- Open [**Use old vs new line numbers based on the commented line type**](practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type.md) to learn about: Added/context lines use newLineStart/End; deleted lines use oldLineStart/End; exactly one pair, never both. #task-manager #line-numbers #comments

## Components (what exists)
_None yet._

## By topic

### #comments
- Open [**Pair line-number attributes correctly in review comments**](practice-pair-line-number-attributes-correctly-in-review-comments.md) — Use exactly one complete new-line or old-line pair on line comments; omit both pairs for file-level comments.
- Open [**Pair line-number attributes correctly on review comments**](practice-pair-line-number-attributes-correctly-on-review-comments.md) — A comment has exactly one pair: new-line-start/end for added/context lines OR old-line-start/end for deleted lines. Never both.
- Open [**Line comments reference either old or new line numbers, never both**](practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) — Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither.
### #xml
- Open [**review.xml format and XSD**](../schema/map-review-xml-format-and-xsd.md) — v3 XML review documents contain files, comments, suggestions, attachments, and ordered flat reply threads.
- Open [**self-review XML v3 schema**](../schema/map-self-review-xml-v1-schema.md) — The canonical v3 XSD defines files, comments, suggestions, attachments, and ordered reply threads.
- Open [**Pair line-number attributes correctly in review comments**](practice-pair-line-number-attributes-correctly-in-review-comments.md) — Use exactly one complete new-line or old-line pair on line comments; omit both pairs for file-level comments.
### #line-numbers
- Open [**Line comments reference either old or new line numbers, never both**](practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) — Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither.
- Open [**Pair comment line numbers as either new or old, never both**](practice-pair-comment-line-numbers-as-either-new-or-old-never-both.md) — Self-review comments use exactly one new-line or old-line pair; file-level comments have neither.
- Open [**Use old vs new line numbers based on the commented line type**](practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type.md) — Added/context lines use newLineStart/End; deleted lines use oldLineStart/End; exactly one pair, never both.
### #self-review
- Open [**Set viewed="true" on every file in critique output**](../../skills/critique/output/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../../skills/critique/suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../../skills/critique/suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
### #task-manager
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.