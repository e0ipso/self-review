---
type: practice
title: Do not add Tailwind as a peer dependency for host apps
description: >-
  tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no
  Tailwind.
tags:
  - css
  - tailwind
  - dependencies
kk_schema_version: 3
kk_id: practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps
kk_derived_from:
  - packages/react/AGENTS.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`tailwindcss` and `@tailwindcss/typography` are `devDependencies` of `@self-review/react`, not `peerDependencies`. The compiled `dist/styles.css` ships all needed utility classes, so host applications do not need Tailwind in their project.

<!-- kk:citations:start -->
# Citations

[1] [packages/react/AGENTS.md](packages/react/AGENTS.md)
<!-- kk:citations:end -->
