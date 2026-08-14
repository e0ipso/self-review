# kenkeep Index: app / architecture

↑ Parent: [app](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Do not store renderer state outside React context**](practice-do-not-store-renderer-state-outside-react-context.md) to learn about: All review state (comments, suggestions, viewed flags) lives in React context; no localStorage or globals. #task-manager #state #renderer
- Open [**Lazy-load file hunks in large-payload mode**](practice-lazy-load-file-hunks-in-large-payload-mode.md) to learn about: When max-files or max-total-lines is exceeded, send file metadata only in diff:load and fetch hunks per file on demand. #large-diff #performance #payload
- Open [**Never import electron directly in the renderer**](practice-never-import-electron-directly-in-the-renderer.md) to learn about: Renderer must only access IPC via the preload contextBridge electronAPI object. #task-manager #ipc #security
- Open [**Trigger large-payload guard at configurable file/line thresholds**](practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md) to learn about: When diff exceeds \`max-files\` (default 500) or \`max-total-lines\` (default 100000), prompt the user; continuing enables lazy loading. #payload #performance #ux
- Open [**Use ES module imports in the renderer, not require()**](practice-use-es-module-imports-in-the-renderer-not-require.md) to learn about: Renderer code must use ES module import syntax; CommonJS require() is disallowed. #task-manager #modules #imports
- Open [**Use src/shared/types.ts as the single source of truth for shared types**](practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md) to learn about: All main and renderer code imports shared types from src/shared/types.ts; never duplicate definitions. #task-manager #types #duplication

## Components (what exists)
- Open [**IPC channel contract between main and renderer**](map-ipc-channel-contract-between-main-and-renderer.md) to learn about: Named channels including diff:load, review:submit, resume:load, config:load, app:close-requested, app:save-and-quit, app:discard-and-quit. #ipc #channels
- Open [**IPC channel registry**](map-ipc-channel-registry.md) to learn about: Channels defined in src/shared/ipc-channels.ts cover diff loading, review submission, resume, config, output path, and lifecycle events. #task-manager #ipc #channels
- Open [**Large-payload lazy-loading mode**](map-large-payload-lazy-loading-mode.md) to learn about: When a diff exceeds max-files or max-total-lines, files load without hunks initially and hunks are fetched lazily via diff:load-file. #task-manager #large-payload #perf
- Open [**Two-process Electron architecture**](map-two-process-electron-architecture.md) to learn about: Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge. #task-manager #architecture #electron

## By topic

### #task-manager
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #ipc
- Open [**IPC channel registry**](map-ipc-channel-registry.md) — Channels defined in src/shared/ipc-channels.ts cover diff loading, review submission, resume, config, output path, and lifecycle events.
- Open [**IPC channel contract between main and renderer**](map-ipc-channel-contract-between-main-and-renderer.md) — Named channels including diff:load, review:submit, resume:load, config:load, app:close-requested, app:save-and-quit, app:discard-and-quit.
- Open [**Never import electron directly in the renderer**](practice-never-import-electron-directly-in-the-renderer.md) — Renderer must only access IPC via the preload contextBridge electronAPI object.
### #channels
- Open [**IPC channel contract between main and renderer**](map-ipc-channel-contract-between-main-and-renderer.md) — Named channels including diff:load, review:submit, resume:load, config:load, app:close-requested, app:save-and-quit, app:discard-and-quit.
- Open [**IPC channel registry**](map-ipc-channel-registry.md) — Channels defined in src/shared/ipc-channels.ts cover diff loading, review submission, resume, config, output path, and lifecycle events.
### #payload
- Open [**Lazy-load file hunks in large-payload mode**](practice-lazy-load-file-hunks-in-large-payload-mode.md) — When max-files or max-total-lines is exceeded, send file metadata only in diff:load and fetch hunks per file on demand.
- Open [**Trigger large-payload guard at configurable file/line thresholds**](practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md) — When diff exceeds \`max-files\` (default 500) or \`max-total-lines\` (default 100000), prompt the user; continuing enables lazy loading.
### #performance
- Open [**Lazy-load file hunks in large-payload mode**](practice-lazy-load-file-hunks-in-large-payload-mode.md) — When max-files or max-total-lines is exceeded, send file metadata only in diff:load and fetch hunks per file on demand.
- Open [**Trigger large-payload guard at configurable file/line thresholds**](practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md) — When diff exceeds \`max-files\` (default 500) or \`max-total-lines\` (default 100000), prompt the user; continuing enables lazy loading.
- Open [**Prioritize the largest diffs when reviewing many files**](../../skills/critique/review-strategy/practice-prioritize-the-largest-diffs-when-reviewing-many-files.md) — For diffs with >15 files, read files with the largest diffs first; for very large files, read only ±50 lines around changed regions.
### #architecture
- Open [**Check plans for architecture and code reuse improvements**](../../planning/authoring/practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
- Open [**Do not import sibling packages from @self-review/types**](../../packages/types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
- Open [**Two-process Electron architecture**](map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
### #duplication
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep file-type detection utilities duplicated across core and react packages**](../../packages/architecture/practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
- Open [**Use src/shared/types.ts as the single source of truth for shared types**](practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md) — All main and renderer code imports shared types from src/shared/types.ts; never duplicate definitions.
### #electron
- Open [**Two-process Electron architecture**](map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
### #imports
- Open [**Do not import from @self-review/core in the react package**](../../packages/architecture/practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Do not import sibling packages from @self-review/types**](../../packages/types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
- Open [**Import only the compiled dist/styles.css from host apps**](../../packages/styling/practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
### #large-diff
- Open [**Lazy-load file hunks in large-payload mode**](practice-lazy-load-file-hunks-in-large-payload-mode.md) — When max-files or max-total-lines is exceeded, send file metadata only in diff:load and fetch hunks per file on demand.
### #large-payload
- Open [**Large-payload lazy-loading mode**](map-large-payload-lazy-loading-mode.md) — When a diff exceeds max-files or max-total-lines, files load without hunks initially and hunks are fetched lazily via diff:load-file.
### #modules
- Open [**Use ES module imports in the renderer, not require()**](practice-use-es-module-imports-in-the-renderer-not-require.md) — Renderer code must use ES module import syntax; CommonJS require() is disallowed.
### #perf
- Open [**Large-payload lazy-loading mode**](map-large-payload-lazy-loading-mode.md) — When a diff exceeds max-files or max-total-lines, files load without hunks initially and hunks are fetched lazily via diff:load-file.
### #renderer
- Open [**Do not store renderer state outside React context**](practice-do-not-store-renderer-state-outside-react-context.md) — All review state (comments, suggestions, viewed flags) lives in React context; no localStorage or globals.
### #security
- Open [**Never import electron directly in the renderer**](practice-never-import-electron-directly-in-the-renderer.md) — Renderer must only access IPC via the preload contextBridge electronAPI object.
### #state
- Open [**Do not store renderer state outside React context**](practice-do-not-store-renderer-state-outside-react-context.md) — All review state (comments, suggestions, viewed flags) lives in React context; no localStorage or globals.
### #types
- Open [**@self-review/types package**](../../packages/types/map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](../../packages/types/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**Define shared data structures only in @self-review/types**](../../packages/types/practice-define-shared-data-structures-only-in-self-review-types.md) — Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app.
### #ux
- Open [**Prefill the suggestion proposed-code editor with the original code**](../ui/interactions/practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code.md) — When the user activates a suggestion, prefill the proposed-code field with the original so they can edit in place.
- Open [**Differentiate Finish Review from window close**](../ui/lifecycle/practice-differentiate-finish-review-from-window-close.md) — Finish Review saves and exits immediately. Closing the window via OS shows a three-way Save & Quit / Discard / Cancel dialog.
- Open [**Trigger large-payload guard at configurable file/line thresholds**](practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md) — When diff exceeds \`max-files\` (default 500) or \`max-total-lines\` (default 100000), prompt the user; continuing enables lazy loading.