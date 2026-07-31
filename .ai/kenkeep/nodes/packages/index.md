# kenkeep Index: packages

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) to learn about: Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app. #types #single-source #shared
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) to learn about: tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind. #css #tailwind #dependencies
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) to learn about: Importing core risks pulling Node-only code into the browser bundle. #react #imports #bundling
- Open [**Do not import sibling packages from @self-review/types**](practice-do-not-import-sibling-packages-from-self-review-types.md) to learn about: The types package is a leaf dependency and must never import from @self-review/core or @self-review/react. #types #imports #architecture
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) to learn about: The react package is browser-only; no fs, child_process, or path imports. #react #browser #constraints
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) to learn about: src/styles.css and src/build-styles.css are build inputs only; never import them. #css #build #imports
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) to learn about: The types package must never add runtime dependencies in package.json; it exists solely for type exports. #types #dependencies #package
- Open [**Keep all @self-review/types definitions in src/index.ts**](practice-keep-all-self-review-types-definitions-in-src-index-ts.md) to learn about: At current scale, all types live in src/index.ts with no subdirectories. #types #structure #layout
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) to learn about: getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated. #task-manager #file-type-utils #duplication
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) to learn about: The file is intentionally duplicated; both copies must be updated together. #duplication #sync #utils
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) to learn about: Portals must render inside the .self-review subtree to inherit dark-mode variables. #radix #portals #theming
- Open [**Scope styles and dark mode via the .self-review wrapper div**](practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md) to learn about: All overrides are prefixed .self-review; dark class toggles on the wrapper, not html. #css #scoping #theming
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) to learn about: Abstract expand-context, image loading, and output-path changes via ReviewAdapter. #architecture #adapter #platform

## Components (what exists)
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) to learn about: Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling. #dom #scoping #theming
- Open [**@self-review/react package**](map-self-review-react-package.md) to learn about: Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting. #package #react #ui
- Open [**@self-review/types package**](map-self-review-types-package.md) to learn about: Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies. #package #types #workspace
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) to learn about: tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css. #css #build #tailwind
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) to learn about: Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types). #task-manager #packages #workspaces
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) to learn about: Abstraction for platform-specific operations defined in src/adapter.ts. #interface #adapter #platform
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) to learn about: Top-level components exported from @self-review/react for embedding the review UI. #component #entrypoint

## By topic

### #types
- Open [**@self-review/types package**](map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) — Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app.
### #css
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
### #imports
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Do not import sibling packages from @self-review/types**](practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
### #package
- Open [**@self-review/types package**](map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**@self-review/react package**](map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
### #react
- Open [**@self-review/react package**](map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) — The react package is browser-only; no fs, child_process, or path imports.
### #theming
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) — Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling.
- Open [**Scope styles and dark mode via the .self-review wrapper div**](practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md) — All overrides are prefixed .self-review; dark class toggles on the wrapper, not html.
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) — Portals must render inside the .self-review subtree to inherit dark-mode variables.
### #adapter
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
### #architecture
- Open [**Check plans for architecture and code reuse improvements**](../planning/practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
- Open [**Do not import sibling packages from @self-review/types**](practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
- Open [**Two-process Electron architecture**](../app/architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
### #build
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
- Open [**Do not install or use webpack**](../engineering/practice-do-not-install-or-use-webpack.md) — Electron Forge handles bundling; do not add a separate webpack configuration.
### #dependencies
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](../planning/practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
### #duplication
- Open [**Extract shared logic before duplicating across call sites**](../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
- Open [**Use src/shared/types.ts as the single source of truth for shared types**](../app/architecture/practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md) — All main and renderer code imports shared types from src/shared/types.ts; never duplicate definitions.
### #platform
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
- Open [**Don't support Windows**](../engineering/practice-don-t-support-windows.md) — Windows is explicitly out of scope. Supported platforms are macOS and Linux (x64 and arm64).
### #scoping
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) — Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling.
- Open [**Scope styles and dark mode via the .self-review wrapper div**](practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md) — All overrides are prefixed .self-review; dark class toggles on the wrapper, not html.
### #tailwind
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
### #task-manager
- Open [**POST_PHASE hook**](../planning/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../planning/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #browser
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) — The react package is browser-only; no fs, child_process, or path imports.
### #bundling
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
### #component
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) — Top-level components exported from @self-review/react for embedding the review UI.
### #constraints
- Open [**Do not use Node.js APIs in @self-review/react**](practice-do-not-use-node-js-apis-in-self-review-react.md) — The react package is browser-only; no fs, child_process, or path imports.
### #dom
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) — Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling.
### #entrypoint
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) — Top-level components exported from @self-review/react for embedding the review UI.
### #file-type-utils
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
### #interface
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
### #layout
- Open [**Keep all @self-review/types definitions in src/index.ts**](practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.
- Open [**Knowledge base node layout**](../knowledge-base/structure/map-knowledge-base-node-layout.md) — Nodes live under \`.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md\`, with \`<kind>\` being \`practice\` or \`map\`.
- Open [**Knowledge-base directory layout under .ai/knowledge-base/**](../knowledge-base/structure/map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes live in nodes/<kind>/, conflicts in conflicts/<id>.md, curator state in .state/state.json, indexes are INDEX.md/GRAPH.md.
### #packages
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).
### #portals
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) — Portals must render inside the .self-review subtree to inherit dark-mode variables.
### #radix
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) — Portals must render inside the .self-review subtree to inherit dark-mode variables.
### #shared
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) — Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app.
### #single-source
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) — Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app.
### #structure
- Open [**.ai/knowledge-base/ directory**](../knowledge-base/structure/map-ai-knowledge-base-directory.md) — AI-session-derived project knowledge base built and maintained by @e0ipso/ai-knowledge-base.
- Open [**Keep all @self-review/types definitions in src/index.ts**](practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.
### #sync
- Open [**Keep the XSD schema in sync across its three locations**](../review-xml/practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) — Schema lives at .agents/ and .opencode/ skill assets plus an embedded string in packages/core/src/xml-serializer.ts; a unit test enforces all three match.
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #ui
- Open [**Force unified view for added and deleted files**](../app/ui/practice-force-unified-view-for-added-and-deleted-files.md) — Files with changeType added or deleted always render in unified view regardless of the user's selected mode.
- Open [**@self-review/react package**](map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
- Open [**Use shadcn/ui components instead of raw HTML for UI**](../app/ui/practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md) — All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML equivalents.
### #utils
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #workspace
- Open [**@self-review/types package**](map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
### #workspaces
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).