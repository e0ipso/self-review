# kenkeep Index: packages / architecture

↑ Parent: [packages](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) to learn about: Importing core risks pulling Node-only code into the browser bundle. #react #imports #bundling
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) to learn about: Abstract expand-context, image loading, and output-path changes via ReviewAdapter. #architecture #adapter #platform
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) to learn about: The react package is browser-only; no fs, child_process, or path imports. #react #browser #constraints
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) to learn about: getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated. #strikethroo #file-type-utils #duplication
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) to learn about: The file is intentionally duplicated; both copies must be updated together. #duplication #sync #utils
- Open [**Keep review comment mutations immutable**](practice-keep-review-comment-mutations-immutable.md) to learn about: Replace affected comment objects so useReviewBridge emits onReviewChange; preserve them for viewed-only file updates. #react #review-state #callbacks #immutability

## Components (what exists)
- Open [**@self-review/react package**](map-self-review-react-package.md) to learn about: Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting. #packages #react #ui
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) to learn about: Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types). #strikethroo #packages #workspace
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) to learn about: Abstraction for platform-specific operations defined in src/adapter.ts. #interface #adapter #platform
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) to learn about: Top-level components exported from @self-review/react for embedding the review UI. #component #entrypoint

## By topic

### #react
- Open [**@self-review/react package**](map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) — The react package is browser-only; no fs, child_process, or path imports.
### #adapter
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
### #duplication
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
- Open [**Use src/shared/types.ts as the single source of truth for shared types**](../../app/architecture/practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md) — All main and renderer code imports shared types from src/shared/types.ts; never duplicate definitions.
### #packages
- Open [**@self-review/types package**](../types/map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](../types/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).
### #platform
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
- Open [**Don't support Windows**](../../engineering/practice-don-t-support-windows.md) — Windows is explicitly out of scope. Supported platforms are macOS and Linux (x64 and arm64).
### #strikethroo
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../../planning/authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #architecture
- Open [**Two-process Electron architecture**](../../app/architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
- Open [**Do not import sibling packages from @self-review/types**](../types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
### #browser
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) — The react package is browser-only; no fs, child_process, or path imports.
### #bundling
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
### #callbacks
- Open [**Keep review comment mutations immutable**](practice-keep-review-comment-mutations-immutable.md) — Replace affected comment objects so useReviewBridge emits onReviewChange; preserve them for viewed-only file updates.
### #component
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) — Top-level components exported from @self-review/react for embedding the review UI.
### #constraints
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) — The react package is browser-only; no fs, child_process, or path imports.
### #entrypoint
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) — Top-level components exported from @self-review/react for embedding the review UI.
### #file-type-utils
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
### #immutability
- Open [**Keep review comment mutations immutable**](practice-keep-review-comment-mutations-immutable.md) — Replace affected comment objects so useReviewBridge emits onReviewChange; preserve them for viewed-only file updates.
### #imports
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Import only the compiled dist/styles.css from host apps**](../styling/practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
- Open [**Do not import sibling packages from @self-review/types**](../types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
### #interface
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
### #review-state
- Open [**Keep review comment mutations immutable**](practice-keep-review-comment-mutations-immutable.md) — Replace affected comment objects so useReviewBridge emits onReviewChange; preserve them for viewed-only file updates.
### #sync
- Open [**Keep the v3 XSD schema in sync across its two locations**](../../review-xml/schema/practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) — Keep the canonical v3 XSD and the serializer's embedded XSD byte-identical, and preserve the OpenCode skill symlinks.
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #ui
- Open [**Force unified view for added and deleted files**](../../app/ui/previews/practice-force-unified-view-for-added-and-deleted-files.md) — Files with changeType added or deleted always render in unified view regardless of the user's selected mode.
- Open [**@self-review/react package**](map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
- Open [**Use shadcn/ui components instead of raw HTML for UI**](../../app/ui/interactions/practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md) — All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML equivalents.
### #utils
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #workspace
- Open [**@self-review/types package**](../types/map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).