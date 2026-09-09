---
type: map
title: Two-process Electron architecture
description: >-
  Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI
  sandboxed via preload contextBridge.
tags:
  - strikethroo
  - architecture
  - electron
kk_schema_version: 3
kk_id: map-two-process-electron-architecture
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-ipc-channel-contract-between-main-and-renderer
  - map-ipc-channel-registry
  - map-large-payload-lazy-loading-mode
  - practice-do-not-store-renderer-state-outside-react-context
  - practice-lazy-load-file-hunks-in-large-payload-mode
  - practice-never-import-electron-directly-in-the-renderer
  - practice-trigger-large-payload-guard-at-configurable-file-line-thresholds
  - practice-use-es-module-imports-in-the-renderer-not-require
  - practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types
kk_depends_on: []
kk_confidence: high
---
The app uses Electron's two-process model. The **main process** parses CLI args, runs `git diff`, parses the unified diff into a structured AST (`DiffFile[]`), and sends it to the renderer via IPC. On 'Finish Review' or 'Save & Quit', it collects review state from the renderer, serializes it to XML, writes to the output file, and exits.

The **renderer process** is a React app that renders the review UI and manages all review state (comments, suggestions, viewed flags) in React context. It communicates with main via the preload bridge, which uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ipc-channel-contract-between-main-and-renderer](map-ipc-channel-contract-between-main-and-renderer.md)
- Related: [map-ipc-channel-registry](map-ipc-channel-registry.md)
- Related: [map-large-payload-lazy-loading-mode](map-large-payload-lazy-loading-mode.md)
- Related: [practice-do-not-store-renderer-state-outside-react-context](practice-do-not-store-renderer-state-outside-react-context.md)
- Related: [practice-lazy-load-file-hunks-in-large-payload-mode](practice-lazy-load-file-hunks-in-large-payload-mode.md)
- Related: [practice-never-import-electron-directly-in-the-renderer](practice-never-import-electron-directly-in-the-renderer.md)
- Related: [practice-trigger-large-payload-guard-at-configurable-file-line-thresholds](practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md)
- Related: [practice-use-es-module-imports-in-the-renderer-not-require](practice-use-es-module-imports-in-the-renderer-not-require.md)
- Related: [practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types](practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md)
<!-- kk:related:end -->
