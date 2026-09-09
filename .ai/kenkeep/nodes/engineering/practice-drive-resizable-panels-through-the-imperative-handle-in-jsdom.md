---
type: practice
title: Drive resizable panels through the imperative handle in jsdom
description: >-
  react-resizable-panels needs a ResizeObserver stub under jsdom and never fires
  onResize there.
tags:
  - testing
  - jsdom
  - react
  - panels
kk_schema_version: 3
kk_id: practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom
kk_derived_from: []
kk_relates_to:
  - practice-restore-collapsed-panels-inside-flushsync
  - map-testing-layers-unit-e2e
kk_depends_on: []
kk_confidence: high
---
react-resizable-panels measures through a `ResizeObserver`, which jsdom does not implement, so a test
that renders `Layout` throws before it asserts anything. Install a no-op stub on `globalThis` before the
component import, as `packages/react/src/components/Layout.test.tsx` does.

The stub never fires, and neither does the real observer under jsdom, so `onResize` callbacks are not a
usable signal in a unit test. Drive the panel through its imperative handle (`collapse`, `expand`,
`isCollapsed`) and assert on what the component does with it. Layout behavior that depends on real
measurement belongs in the e2e layer.

<!-- kk:related:start -->
# Related

- Related: [practice-restore-collapsed-panels-inside-flushsync](/app/ui/interactions/practice-restore-collapsed-panels-inside-flushsync.md)
- Related: [map-testing-layers-unit-e2e](/engineering/map-testing-layers-unit-e2e.md)
<!-- kk:related:end -->
