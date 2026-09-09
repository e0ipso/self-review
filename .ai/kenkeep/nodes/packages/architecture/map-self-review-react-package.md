---
type: map
title: '@self-review/react package'
description: >-
  Embeddable React UI layer: diff viewer, file tree, commenting, syntax
  highlighting.
tags:
  - packages
  - react
  - ui
kk_schema_version: 3
kk_id: map-self-review-react-package
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to:
  - map-emoji-shortcode-support-in-comments
  - map-vimium-style-keyboard-navigation
  - map-vimium-style-keyboard-shortcuts
  - practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side
  - practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code
  - practice-use-shadcn-ui-components-instead-of-raw-html-for-ui
  - map-npm-workspaces-packages
  - map-reviewadapter-interface
  - map-reviewpanel-and-singlefilereview-entry-components
  - practice-do-not-import-from-self-review-core-in-the-react-package
  - practice-do-not-use-node-js-apis-in-self-review-react
  - practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages
  - practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react
  - practice-keep-review-comment-mutations-immutable
  - practice-use-the-reviewadapter-pattern-for-platform-specific-operations
kk_depends_on: []
kk_confidence: high
---
`@self-review/react` is the reusable UI layer consumed by the Electron renderer and the webapp e2e test harness. It provides `ReviewPanel` as the main entry point and exports individual components for custom composition.

Source lives under `packages/react/src/`, with subdirectories for `components/` (Layout, FileTree, Toolbar, DiffViewer, Comments), `context/`, `hooks/`, and `utils/`.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](../../../../../packages/react/AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-emoji-shortcode-support-in-comments](../../app/ui/interactions/map-emoji-shortcode-support-in-comments.md)
- Related: [map-vimium-style-keyboard-navigation](../../app/ui/interactions/map-vimium-style-keyboard-navigation.md)
- Related: [map-vimium-style-keyboard-shortcuts](../../app/ui/interactions/map-vimium-style-keyboard-shortcuts.md)
- Related: [practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side](../../app/ui/interactions/practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side.md)
- Related: [practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code](../../app/ui/interactions/practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code.md)
- Related: [practice-use-shadcn-ui-components-instead-of-raw-html-for-ui](../../app/ui/interactions/practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md)
- Related: [map-npm-workspaces-packages](map-npm-workspaces-packages.md)
- Related: [map-reviewadapter-interface](map-reviewadapter-interface.md)
- Related: [map-reviewpanel-and-singlefilereview-entry-components](map-reviewpanel-and-singlefilereview-entry-components.md)
- Related: [practice-do-not-import-from-self-review-core-in-the-react-package](practice-do-not-import-from-self-review-core-in-the-react-package.md)
- Related: [practice-do-not-use-node-js-apis-in-self-review-react](practice-do-not-use-node-js-apis-in-self-review-react.md)
- Related: [practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages](practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md)
- Related: [practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react](practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md)
- Related: [practice-keep-review-comment-mutations-immutable](practice-keep-review-comment-mutations-immutable.md)
- Related: [practice-use-the-reviewadapter-pattern-for-platform-specific-operations](practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md)
<!-- kk:related:end -->
