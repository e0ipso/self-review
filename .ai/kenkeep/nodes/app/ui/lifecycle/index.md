# kenkeep Index: app / ui / lifecycle

↑ Parent: [ui](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Differentiate Finish Review from window close**](practice-differentiate-finish-review-from-window-close.md) to learn about: Finish Review saves and exits immediately. Closing the window via OS shows a three-way Save & Quit / Discard / Cancel dialog. #exit #save #ux

## Components (what exists)
- Open [**Finish Review vs window-close behavior**](map-finish-review-vs-window-close-behavior.md) to learn about: Finish Review saves and exits; closing via X/Cmd+Q shows a three-way Save & Quit / Discard / Cancel dialog. #task-manager #close-behavior #save

## By topic

### #save
- Open [**Differentiate Finish Review from window close**](practice-differentiate-finish-review-from-window-close.md) — Finish Review saves and exits immediately. Closing the window via OS shows a three-way Save & Quit / Discard / Cancel dialog.
- Open [**Finish Review vs window-close behavior**](map-finish-review-vs-window-close-behavior.md) — Finish Review saves and exits; closing via X/Cmd+Q shows a three-way Save & Quit / Discard / Cancel dialog.
### #close-behavior
- Open [**Finish Review vs window-close behavior**](map-finish-review-vs-window-close-behavior.md) — Finish Review saves and exits; closing via X/Cmd+Q shows a three-way Save & Quit / Discard / Cancel dialog.
### #exit
- Open [**Differentiate Finish Review from window close**](practice-differentiate-finish-review-from-window-close.md) — Finish Review saves and exits immediately. Closing the window via OS shows a three-way Save & Quit / Discard / Cancel dialog.
### #task-manager
- Open [**POST_PHASE hook**](../../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #ux
- Open [**Prefill the suggestion proposed-code editor with the original code**](../interactions/practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code.md) — When the user activates a suggestion, prefill the proposed-code field with the original so they can edit in place.
- Open [**Differentiate Finish Review from window close**](practice-differentiate-finish-review-from-window-close.md) — Finish Review saves and exits immediately. Closing the window via OS shows a three-way Save & Quit / Discard / Cancel dialog.
- Open [**Trigger large-payload guard at configurable file/line thresholds**](../../architecture/practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md) — When diff exceeds \`max-files\` (default 500) or \`max-total-lines\` (default 100000), prompt the user; continuing enables lazy loading.