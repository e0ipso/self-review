---
type: practice
title: Split file text on \n only and keep each line's trailing \r
description: >-
  apply-suggestion, the diff parser and the thread mapper all carry a CRLF
  file's \r inside the line, which is what makes the byte compare work.
tags:
  - core
  - apply-suggestion
  - line-endings
  - diff-parser
kk_schema_version: 3
kk_id: practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r
kk_derived_from: []
kk_relates_to:
  - practice-encode-diff-header-paths-with-quotegitpath
kk_depends_on: []
kk_confidence: high
---
`splitLines` in `packages/core/src/apply-suggestion.ts` splits on `\n` and nothing else, so on a CRLF
file each element keeps its own trailing `\r`. That is deliberate, and three components depend on it:
the diff parser hands the same `\r` through in `DiffLine.content`, the thread mapper builds
`originalCode` from those lines, and `applySuggestion` compares the anchored file lines against
`originalCode` byte for byte. Normalizing line endings at any one of those points makes the compare
fail on every CRLF file and the apply refuse with `context-mismatch`.

The same rule governs the write back: rejoining with `\n` restores the original bytes including mixed
endings, and `isCrlfRegion` re-terminates a hand-typed LF proposal only when every replaced line was
CRLF. Do not reach for `split(/\r?\n/)`, `trimEnd()` or a normalize pass anywhere on this path.

**Why:** The byte-exact compare is what proves the file has not moved under the suggestion since the
review was written. Nothing else on this path checks that.

<!-- kk:related:start -->
# Related

- Related: [practice-encode-diff-header-paths-with-quotegitpath](/packages/architecture/practice-encode-diff-header-paths-with-quotegitpath.md)
<!-- kk:related:end -->
