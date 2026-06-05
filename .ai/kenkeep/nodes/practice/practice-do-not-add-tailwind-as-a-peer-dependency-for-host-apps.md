---
schema_version: 1
id: practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps
title: Do not add Tailwind as a peer dependency for host apps
kind: practice
tags:
  - css
  - tailwind
  - dependencies
derived_from:
  - packages/react/AGENTS.md
relates_to: []
confidence: high
summary: >-
  tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no
  Tailwind.
---
`tailwindcss` and `@tailwindcss/typography` are `devDependencies` of `@self-review/react`, not `peerDependencies`. The compiled `dist/styles.css` ships all needed utility classes, so host applications do not need Tailwind in their project.
