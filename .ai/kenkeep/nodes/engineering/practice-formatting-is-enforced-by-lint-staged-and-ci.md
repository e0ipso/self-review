---
type: practice
title: Formatting is enforced by lint-staged and CI
description: >-
  Prettier runs on staged files via .husky/pre-commit and CI runs npm run
  format:check; printWidth is 100.
tags:
  - formatting
  - prettier
  - husky
  - ci
kk_schema_version: 3
kk_id: practice-formatting-is-enforced-by-lint-staged-and-ci
kk_derived_from: []
kk_relates_to:
  - practice-use-conventional-commit-naming-for-pr-titles
kk_depends_on: []
kk_confidence: high
---
`.husky/pre-commit` runs lint-staged (`prettier --write` over the staged source, markdown, YAML, JSON
and CSS), then `npm run lint` and `npm run test:unit`. CI re-checks with `npm run format:check`
(`prettier --check .`), so an unformatted file fails the build even if the hook was skipped. Prettier
config: `printWidth` 100, single quotes, `trailingComma: es5`, markdown overridden to `proseWrap:
always` at 100 and JSON to 120.

The hook invokes `node_modules/.bin/lint-staged` directly and fails with a "run npm install" message
when it is missing. Bare `npx lint-staged` would fetch the package from the registry mid-commit on a
checkout whose install predates it, and `npx --no-install` quietly runs whatever copy the npx cache
holds instead of the one `package-lock.json` pins.

<!-- kk:related:start -->
# Related

- Related: [practice-use-conventional-commit-naming-for-pr-titles](/engineering/practice-use-conventional-commit-naming-for-pr-titles.md)
<!-- kk:related:end -->
