---
type: practice
title: Keep file-type detection utilities duplicated across core and react packages
description: >-
  getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath
  are intentionally duplicated.
tags:
  - strikethroo
  - file-type-utils
  - duplication
kk_schema_version: 3
kk_id: >-
  practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review-react-package
kk_depends_on: []
kk_confidence: high
---
Detection utilities (`getRenderedTextMode`, `isPreviewableImage`, `isPreviewableSvg`, `getLanguageFromPath`) are intentionally duplicated in both `@self-review/core` (`packages/core/src/file-type-utils.ts`) and `@self-review/react` (`packages/react/src/utils/file-type-utils.ts`). See the package AGENTS.md files for rationale.

**Why:** Package boundaries — neither package should depend on the other for these small pure utilities; AGENTS.md files in each package document the rationale.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-react-package](map-self-review-react-package.md)
<!-- kk:related:end -->
