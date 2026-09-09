---
type: practice
title: Watch CSS sources explicitly with tsup
description: >-
  tsup --watch only follows the entry import graph, so the react dev script
  watches src and rebuilds CSS on success.
tags:
  - build
  - tsup
  - css
  - dev-loop
kk_schema_version: 3
kk_id: practice-watch-css-sources-explicitly-with-tsup
kk_derived_from: []
kk_relates_to:
  - map-css-build-pipeline-for-self-review-react
kk_depends_on: []
kk_confidence: high
---
A bare `tsup --watch` watches only the files reachable from the entry's import graph. `src/styles.css`
and `src/build-styles.css` are compiled by the Tailwind CLI, not imported by the bundle, so edits to
them produce no rebuild and no error. The dev loop just serves stale CSS.

`packages/react`'s dev script is `tsup --watch src --onSuccess "npm run build:css"`: the explicit path
puts the whole source directory under the watcher, and `--onSuccess` re-runs the stylesheet build after
each successful bundle so `dist/styles.css` tracks the sources. Any new build input that lives outside
the import graph needs the same treatment.

<!-- kk:related:start -->
# Related

- Related: [map-css-build-pipeline-for-self-review-react](/packages/styling/map-css-build-pipeline-for-self-review-react.md)
<!-- kk:related:end -->
