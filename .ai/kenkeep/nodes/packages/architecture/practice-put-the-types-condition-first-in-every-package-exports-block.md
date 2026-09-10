---
type: practice
title: Put the types condition first in every package exports block
description: >-
  Export conditions resolve in declaration order, and a misordered block still
  type-checks at exit 0, so nothing here catches it.
tags:
  - packages
  - exports
  - typescript
  - packaging
kk_schema_version: 3
kk_id: practice-put-the-types-condition-first-in-every-package-exports-block
kk_derived_from: []
kk_relates_to:
  - map-npm-workspaces-packages
kk_depends_on: []
kk_confidence: high
---
`@self-review/types`, `@self-review/core` and `@self-review/react` all list `types` first in their
`exports` block, ahead of `import` and `require`. Keep that order when adding an entry point or a
package.

Export conditions resolve in declaration order, so a `types` entry sitting after `import` is never
reached. Plain `tsc` will not report it: under `moduleResolution: node16`, a consumer of a package
declaring `{ import, types }` type-checks at exit 0 exactly like one declaring `{ types, import }`,
because the resolver falls back to the `.d.ts` next to the JS it just resolved. `--traceResolution`
is where the two differ.

Nothing in this repo exercises the block. The Electron app imports the packages by relative source
path under `packages/*/src`, so a misordered block would clear every check we run and surface only
for an outside consumer.

**Why:** Our own toolchain never resolves the block, so a consumer's build is the first place the
mistake shows up.

<!-- kk:related:start -->
# Related

- Related: [map-npm-workspaces-packages](/packages/architecture/map-npm-workspaces-packages.md)
<!-- kk:related:end -->
