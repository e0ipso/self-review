# kenkeep Index: app / ui / interactions

↑ Parent: [ui](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Clamp multi-line drag-selection to a single hunk and a single side**](practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side.md) to learn about: Drag-to-select for comment ranges cannot cross hunk boundaries; in split view it's locked to the side where it started. #drag-select #hunks #split-view
- Open [**Prefill the suggestion proposed-code editor with the original code**](practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code.md) to learn about: When the user activates a suggestion, prefill the proposed-code field with the original so they can edit in place. #suggestions #ux
- Open [**Use shadcn/ui components instead of raw HTML for UI**](practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md) to learn about: All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML equivalents. #task-manager #ui #shadcn

## Components (what exists)
- Open [**Emoji shortcode support in comments**](map-emoji-shortcode-support-in-comments.md) to learn about: Typing :xx in the comment editor triggers an inline autocomplete; :shortcode: text is converted to Unicode in rendered markdown. #task-manager #emoji #comments
- Open [**Vimium-style keyboard navigation**](map-vimium-style-keyboard-navigation.md) to learn about: f activates line-comment hints, g activates file-jump hints, j/k smooth scroll, Ctrl/Cmd+F opens find-in-page, Escape dismisses. #keyboard #navigation #vimium
- Open [**Vimium-style keyboard shortcuts**](map-vimium-style-keyboard-shortcuts.md) to learn about: Hint-driven navigation: f for diff lines, g for file tree, j/k for scroll, Ctrl+F for find, Escape to dismiss. #task-manager #keyboard #vimium

## By topic

### #task-manager
- Open [**POST_PHASE hook**](../../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #keyboard
- Open [**Vimium-style keyboard navigation**](map-vimium-style-keyboard-navigation.md) — f activates line-comment hints, g activates file-jump hints, j/k smooth scroll, Ctrl/Cmd+F opens find-in-page, Escape dismisses.
- Open [**Vimium-style keyboard shortcuts**](map-vimium-style-keyboard-shortcuts.md) — Hint-driven navigation: f for diff lines, g for file tree, j/k for scroll, Ctrl+F for find, Escape to dismiss.
### #vimium
- Open [**Vimium-style keyboard navigation**](map-vimium-style-keyboard-navigation.md) — f activates line-comment hints, g activates file-jump hints, j/k smooth scroll, Ctrl/Cmd+F opens find-in-page, Escape dismisses.
- Open [**Vimium-style keyboard shortcuts**](map-vimium-style-keyboard-shortcuts.md) — Hint-driven navigation: f for diff lines, g for file tree, j/k for scroll, Ctrl+F for find, Escape to dismiss.
### #comments
- Open [**Pair line-number attributes correctly in review comments**](../../../review-xml/line-anchors/practice-pair-line-number-attributes-correctly-in-review-comments.md) — Use exactly one complete new-line or old-line pair on line comments; omit both pairs for file-level comments.
- Open [**Pair line-number attributes correctly on review comments**](../../../review-xml/line-anchors/practice-pair-line-number-attributes-correctly-on-review-comments.md) — A comment has exactly one pair: new-line-start/end for added/context lines OR old-line-start/end for deleted lines. Never both.
- Open [**Line comments reference either old or new line numbers, never both**](../../../review-xml/line-anchors/practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) — Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither.
### #drag-select
- Open [**Clamp multi-line drag-selection to a single hunk and a single side**](practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side.md) — Drag-to-select for comment ranges cannot cross hunk boundaries; in split view it's locked to the side where it started.
### #emoji
- Open [**Emoji shortcode support in comments**](map-emoji-shortcode-support-in-comments.md) — Typing :xx in the comment editor triggers an inline autocomplete; :shortcode: text is converted to Unicode in rendered markdown.
### #hunks
- Open [**Clamp multi-line drag-selection to a single hunk and a single side**](practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side.md) — Drag-to-select for comment ranges cannot cross hunk boundaries; in split view it's locked to the side where it started.
### #navigation
- Open [**Vimium-style keyboard navigation**](map-vimium-style-keyboard-navigation.md) — f activates line-comment hints, g activates file-jump hints, j/k smooth scroll, Ctrl/Cmd+F opens find-in-page, Escape dismisses.
### #shadcn
- Open [**Use shadcn/ui components instead of raw HTML for UI**](practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md) — All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML equivalents.
### #split-view
- Open [**Clamp multi-line drag-selection to a single hunk and a single side**](practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side.md) — Drag-to-select for comment ranges cannot cross hunk boundaries; in split view it's locked to the side where it started.
### #suggestions
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../../../skills/critique/suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../../../skills/critique/suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
- Open [**Apply review suggestions bottom-to-top by line number**](../../../skills/apply/practice-apply-review-suggestions-bottom-to-top-by-line-number.md) — Sort suggestions by line number descending before applying so earlier edits don't invalidate later line references.
### #ui
- Open [**Force unified view for added and deleted files**](../previews/practice-force-unified-view-for-added-and-deleted-files.md) — Files with changeType added or deleted always render in unified view regardless of the user's selected mode.
- Open [**@self-review/react package**](../../../packages/architecture/map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
- Open [**Use shadcn/ui components instead of raw HTML for UI**](practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md) — All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML equivalents.
### #ux
- Open [**Prefill the suggestion proposed-code editor with the original code**](practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code.md) — When the user activates a suggestion, prefill the proposed-code field with the original so they can edit in place.
- Open [**Differentiate Finish Review from window close**](../lifecycle/practice-differentiate-finish-review-from-window-close.md) — Finish Review saves and exits immediately. Closing the window via OS shows a three-way Save & Quit / Discard / Cancel dialog.
- Open [**Trigger large-payload guard at configurable file/line thresholds**](../../architecture/practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md) — When diff exceeds \`max-files\` (default 500) or \`max-total-lines\` (default 100000), prompt the user; continuing enables lazy loading.