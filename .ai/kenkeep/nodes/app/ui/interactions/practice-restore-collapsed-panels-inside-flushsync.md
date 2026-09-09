---
type: practice
title: Restore collapsed panels inside flushSync
description: >-
  react-resizable-panels' expand() only writes to its store; flush the render
  before measuring rects.
tags:
  - react
  - panels
  - dom
  - keyboard-navigation
kk_schema_version: 3
kk_id: practice-restore-collapsed-panels-inside-flushsync
kk_derived_from: []
kk_relates_to:
  - map-vimium-style-keyboard-navigation
kk_depends_on: []
kk_confidence: high
---
The imperative `expand()` on a react-resizable-panels handle is not synchronous. It writes the new size
into the library's store and the width reaches the DOM on the render that store update schedules, a
microtask after `dispatchEvent` returns: a probe measured the panel's `flexGrow` still `0` at the return
and `50` only on the next tick. Anything that expands a panel and then measures rects in the next
statement sees the collapsed geometry. The jump-to-file hint key is the live case.

`Layout` wraps the restore in `flushSync` so the width and the `inert` flag commit inside the dispatch.
Deferring the measurement a frame instead also works, at the cost of one painted frame showing an
expanded tree with no hints on it.

<!-- kk:related:start -->
# Related

- Related: [map-vimium-style-keyboard-navigation](/app/ui/interactions/map-vimium-style-keyboard-navigation.md)
<!-- kk:related:end -->
