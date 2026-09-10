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
- Open [**Encode diff header paths with quoteGitPath**](practice-encode-diff-header-paths-with-quotegitpath.md) to learn about: quoteGitPath in synthetic-diff.ts reproduces git's C-style quoting and inverts decodeGitPath in diff-parser.ts. #git #diff #paths #encoding
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) to learn about: getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated. #strikethroo #file-type-utils #duplication
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) to learn about: The file is intentionally duplicated; both copies must be updated together. #duplication #sync #utils
- Open [**Keep review comment mutations immutable**](practice-keep-review-comment-mutations-immutable.md) to learn about: Replace affected comment objects so useReviewBridge emits onReviewChange; preserve them for viewed-only file updates. #react #review-state #callbacks #immutability
- Open [**Split file text on \\n only and keep each line's trailing \\r**](practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md) to learn about: apply-suggestion, the diff parser and the thread mapper all carry a CRLF file's \\r inside the line, which is what makes the byte compare work. #core #apply-suggestion #line-endings #diff-parser
- Open [**Put the types condition first in every package exports block**](practice-put-the-types-condition-first-in-every-package-exports-block.md) to learn about: Export conditions resolve in declaration order, and a misordered block still type-checks at exit 0, so nothing here catches it. #packages #exports #typescript #packaging
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) to learn about: startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff. #core #remote-mode #ordering #gotcha

## Components (what exists)
- Open [**@self-review/react package**](map-self-review-react-package.md) to learn about: Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting. #packages #react #ui
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) to learn about: Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types). #strikethroo #packages #workspace
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) to learn about: Abstraction for platform-specific operations defined in src/adapter.ts. #interface #adapter #platform
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) to learn about: Top-level components exported from @self-review/react for embedding the review UI. #component #entrypoint

## By topic

### #react
- Open [**Restore collapsed panels inside flushSync**](../../app/ui/interactions/practice-restore-collapsed-panels-inside-flushsync.md) — react-resizable-panels' expand() only writes to its store; flush the render before measuring rects.
- Open [**Drive resizable panels through the imperative handle in jsdom**](../../engineering/practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom.md) — react-resizable-panels needs a ResizeObserver stub under jsdom and never fires onResize there.
- Open [**@self-review/react package**](map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
### #packages
- Open [**@self-review/types package**](../types/map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](../types/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).
### #adapter
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
### #core
- Open [**Suggestion-apply write boundary**](../../app/map-suggestion-apply-write-boundary.md) — applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone.
- Open [**Split file text on \\n only and keep each line's trailing \\r**](practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md) — apply-suggestion, the diff parser and the thread mapper all carry a CRLF file's \\r inside the line, which is what makes the byte compare work.
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) — startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff.
### #duplication
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
- Open [**Use src/shared/types.ts as the single source of truth for shared types**](../../app/architecture/practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md) — All main and renderer code imports shared types from src/shared/types.ts; never duplicate definitions.
### #platform
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
- Open [**Don't support Windows**](../../engineering/practice-don-t-support-windows.md) — Windows is explicitly out of scope. Supported platforms are macOS and Linux (x64 and arm64).
### #strikethroo
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../../planning/authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #apply-suggestion
- Open [**Split file text on \\n only and keep each line's trailing \\r**](practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md) — apply-suggestion, the diff parser and the thread mapper all carry a CRLF file's \\r inside the line, which is what makes the byte compare work.
- Open [**Suggestion-apply write boundary**](../../app/map-suggestion-apply-write-boundary.md) — applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone.
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
### #diff
- Open [**Encode diff header paths with quoteGitPath**](practice-encode-diff-header-paths-with-quotegitpath.md) — quoteGitPath in synthetic-diff.ts reproduces git's C-style quoting and inverts decodeGitPath in diff-parser.ts.
### #diff-parser
- Open [**Split file text on \\n only and keep each line's trailing \\r**](practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md) — apply-suggestion, the diff parser and the thread mapper all carry a CRLF file's \\r inside the line, which is what makes the byte compare work.
### #encoding
- Open [**Encode diff header paths with quoteGitPath**](practice-encode-diff-header-paths-with-quotegitpath.md) — quoteGitPath in synthetic-diff.ts reproduces git's C-style quoting and inverts decodeGitPath in diff-parser.ts.
### #entrypoint
- Open [**ReviewPanel and SingleFileReview entry components**](map-reviewpanel-and-singlefilereview-entry-components.md) — Top-level components exported from @self-review/react for embedding the review UI.
### #exports
- Open [**Put the types condition first in every package exports block**](practice-put-the-types-condition-first-in-every-package-exports-block.md) — Export conditions resolve in declaration order, and a misordered block still type-checks at exit 0, so nothing here catches it.
### #file-type-utils
- Open [**Keep file-type detection utilities duplicated across core and react packages**](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
### #git
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](../../engineering/practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) — core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning.
- Open [**Apply curator conflicts using the selected reply**](../../knowledge-base/curate/practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept updates the target and removes the conflict; reject removes only the conflict.
- Open [**Review knowledge-base changes via git diff before committing**](../../knowledge-base/structure/practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
### #gotcha
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](../../engineering/practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) — core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning.
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) — startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff.
### #immutability
- Open [**Keep review comment mutations immutable**](practice-keep-review-comment-mutations-immutable.md) — Replace affected comment objects so useReviewBridge emits onReviewChange; preserve them for viewed-only file updates.
### #imports
- Open [**Do not import from @self-review/core in the react package**](practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Import only the compiled dist/styles.css from host apps**](../styling/practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
- Open [**Do not import sibling packages from @self-review/types**](../types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
### #interface
- Open [**ReviewAdapter interface**](map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
### #line-endings
- Open [**Split file text on \\n only and keep each line's trailing \\r**](practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md) — apply-suggestion, the diff parser and the thread mapper all carry a CRLF file's \\r inside the line, which is what makes the byte compare work.
### #ordering
- Open [**Apply review suggestions bottom-to-top by line number**](../../skills/apply/practice-apply-review-suggestions-bottom-to-top-by-line-number.md) — Sort suggestions by line number descending before applying so earlier edits don't invalidate later line references.
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) — startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff.
### #packaging
- Open [**Upload release ZIPs using the MakerZIP filenames**](../../engineering/practice-upload-release-zips-using-the-makerzip-filenames.md) — Upload MakerZIP archives directly by glob without renaming them.
- Open [**Pin Nix fetchzip hashes to the unpacked directory**](../../engineering/practice-pin-nix-fetchzip-hashes-to-the-unpacked-directory.md) — A fetchzip hash covers the unpacked tree, never the archive bytes; update-flake-hash.sh prefetches with --unpack.
- Open [**Put the types condition first in every package exports block**](practice-put-the-types-condition-first-in-every-package-exports-block.md) — Export conditions resolve in declaration order, and a misordered block still type-checks at exit 0, so nothing here catches it.
### #paths
- Open [**Encode diff header paths with quoteGitPath**](practice-encode-diff-header-paths-with-quotegitpath.md) — quoteGitPath in synthetic-diff.ts reproduces git's C-style quoting and inverts decodeGitPath in diff-parser.ts.
- Open [**Kenkeep directory layout**](../../knowledge-base/structure/map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes use topical folders; sessions, conflicts and logs have separate directories.
### #remote-mode
- Open [**Suggestion-apply write boundary**](../../app/map-suggestion-apply-write-boundary.md) — applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone.
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) — startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff.
### #review-state
- Open [**Keep review comment mutations immutable**](practice-keep-review-comment-mutations-immutable.md) — Replace affected comment objects so useReviewBridge emits onReviewChange; preserve them for viewed-only file updates.
### #sync
- Open [**Keep the v3 XSD schema in sync across its two locations**](../../review-xml/schema/practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) — Keep the canonical v3 XSD and the serializer's embedded XSD byte-identical, and preserve the OpenCode skill symlinks.
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #typescript
- Open [**Six tsc programs behind four typecheck npm scripts**](../../engineering/map-type-check-programs-and-scripts.md) — typecheck, typecheck:tests, typecheck:unit and typecheck:packages cover six tsconfig programs; the CI lint job gates on all four.
- Open [**Check each package with its own tsconfig; the root program only follows imports**](../../engineering/practice-check-each-package-with-its-own-tsconfig.md) — The root program includes only src/**/*, so package files the app never imports are covered by typecheck:packages alone.
- Open [**Fix webpack type-checking in the root tsconfig.json, not in a webpack config**](../../engineering/practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md) — fork-ts-checker defaults configFile to <context>/tsconfig.json and all three webpack configs set context to the project root.
### #ui
- Open [**Force unified view for added and deleted files**](../../app/ui/previews/practice-force-unified-view-for-added-and-deleted-files.md) — Files with changeType added or deleted always render in unified view regardless of the user's selected mode.
- Open [**@self-review/react package**](map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
- Open [**Use shadcn/ui components instead of raw HTML for UI**](../../app/ui/interactions/practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md) — All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML equivalents.
### #utils
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #workspace
- Open [**@self-review/types package**](../types/map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**npm workspaces packages**](map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).