---
type: map
title: .self-review wrapper div
description: >-
  Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode
  toggling.
tags:
  - dom
  - scoping
  - theming
kk_schema_version: 3
kk_id: map-self-review-wrapper-div
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to:
  - map-css-build-pipeline-for-self-review-react
  - practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps
  - practice-import-only-the-compiled-dist-styles-css-from-host-apps
  - practice-pass-portalcontainer-to-all-radix-shadcn-portal-components
  - practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div
kk_depends_on: []
kk_confidence: high
---
`ConfigProvider` renders `<div className="self-review" style={{ display: 'contents' }}>` around its children. The wrapper serves two roles: theme scoping (the `dark` class toggles here instead of on `document.documentElement`) and CSS containment (all `*` selectors and overrides in `styles.css` are prefixed with `.self-review`).

It is also used as the `container` for Radix/shadcn portal-based components.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](../../../../../packages/react/AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-css-build-pipeline-for-self-review-react](map-css-build-pipeline-for-self-review-react.md)
- Related: [practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md)
- Related: [practice-import-only-the-compiled-dist-styles-css-from-host-apps](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md)
- Related: [practice-pass-portalcontainer-to-all-radix-shadcn-portal-components](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md)
- Related: [practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div](practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md)
<!-- kk:related:end -->
