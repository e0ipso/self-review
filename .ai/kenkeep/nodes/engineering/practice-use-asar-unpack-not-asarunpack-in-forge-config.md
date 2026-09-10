---
type: practice
title: asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack
description: >-
  Forge drops an asarUnpack key on the floor. The packager option is asar: {
  unpack }, and this repo needs neither.
tags:
  - electron
  - forge
  - packaging
  - asar
  - xmllint
kk_schema_version: 3
kk_id: practice-use-asar-unpack-not-asarunpack-in-forge-config
kk_derived_from: []
kk_relates_to:
  - practice-do-not-install-or-use-webpack
kk_depends_on: []
kk_confidence: high
---
`packagerConfig` in `forge.config.ts` is passed straight to `@electron/packager`, whose only
unpacking knob is the object form of `asar`: `asar?: boolean | AsarOptions` with `unpack` and
`unpackDir` inside it (`node_modules/@electron/packager/dist/types.d.ts`). `asarUnpack` is
electron-builder's spelling and appears nowhere in the packager. Forge accepts a stray `asarUnpack`
and drops it. Nothing warns, and nothing lands outside the archive.

This repo carried `asarUnpack: ['**/xmllint.wasm']` for its whole life without effect. A packaged
tree has no `app.asar.unpacked` directory and ships the file at
`/.webpack/main/native_modules/xmllint.wasm` inside `app.asar`. That turned out to be fine:
`xmllint-wasm` loads it with `fs.readFileSync(__dirname + '/xmllint.wasm')`, and Electron's asar
`fs` patch serves the read from inside the archive. Measured on the packaged Linux binary, the app
writes a `review.xml` that validates against `self-review-v3.xsd` with no
`XML validation infrastructure failed` warning on stderr, and the guide loader rejects an invalid
sidecar with libxml2's own error. The wasm executes from inside the archive; unpacking it is not
needed. `forge.config.ts` keeps a comment where the key used to sit so nobody re-adds it.

**Why:** A packaging key that the packager does not recognize looks load-bearing in review and in
`git blame`, and deleting it looks risky. Knowing which library owns the name settles both: check
the option against `@electron/packager`'s types, not against electron-builder docs or memory.

<!-- kk:related:start -->
# Related

- Related: [practice-do-not-install-or-use-webpack](/engineering/practice-do-not-install-or-use-webpack.md)
<!-- kk:related:end -->
