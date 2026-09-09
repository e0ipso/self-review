---
type: map
title: self-review
description: >-
  Local-only Electron desktop app providing a GitHub-style PR review UI for
  local git diffs and directory reviews.
tags:
  - strikethroo
  - app
  - overview
kk_schema_version: 3
kk_id: map-self-review
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review-application
  - practice-keep-self-review-local-only-with-no-network-access
  - practice-limit-file-writes-to-the-review-xml-and-assets-directory
  - practice-make-no-network-connections-at-runtime
  - practice-make-zero-network-requests-except-the-startup-version-check
  - map-testing-layers-unit-e2e
  - practice-do-not-install-or-use-webpack
  - practice-do-not-run-e2e-tests-inside-the-dev-container
  - practice-don-t-support-windows
  - practice-exclude-generated-assistant-tooling-from-eslint
  - practice-extract-shared-logic-before-duplicating-across-call-sites
  - practice-favor-simple-maintainable-solutions-over-clever-ones
  - practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production
  - practice-implement-only-what-the-user-explicitly-requests
  - practice-lead-each-platform-installation-section-with-homebrew
  - practice-upload-release-zips-using-the-makerzip-filenames
  - practice-use-conventional-commit-naming-for-pr-titles
kk_depends_on: []
kk_confidence: high
---
`self-review` is a local-only Electron desktop app that provides a GitHub-style PR review UI for local git diffs and directory-based reviews (all files treated as new when no repo context is available). It is designed for solo developers reviewing AI-generated code with a CLI-first, one-shot workflow: open → review → close → XML to file.

When launched outside a git repo without a directory argument (e.g., from an app launcher), the app shows a welcome screen with a directory picker instead of exiting.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review-application](map-self-review-application.md)
- Related: [practice-keep-self-review-local-only-with-no-network-access](practice-keep-self-review-local-only-with-no-network-access.md)
- Related: [practice-limit-file-writes-to-the-review-xml-and-assets-directory](practice-limit-file-writes-to-the-review-xml-and-assets-directory.md)
- Related: [practice-make-no-network-connections-at-runtime](practice-make-no-network-connections-at-runtime.md)
- Related: [practice-make-zero-network-requests-except-the-startup-version-check](practice-make-zero-network-requests-except-the-startup-version-check.md)
- Related: [map-testing-layers-unit-e2e](../engineering/map-testing-layers-unit-e2e.md)
- Related: [practice-do-not-install-or-use-webpack](../engineering/practice-do-not-install-or-use-webpack.md)
- Related: [practice-do-not-run-e2e-tests-inside-the-dev-container](../engineering/practice-do-not-run-e2e-tests-inside-the-dev-container.md)
- Related: [practice-don-t-support-windows](../engineering/practice-don-t-support-windows.md)
- Related: [practice-exclude-generated-assistant-tooling-from-eslint](../engineering/practice-exclude-generated-assistant-tooling-from-eslint.md)
- Related: [practice-extract-shared-logic-before-duplicating-across-call-sites](../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md)
- Related: [practice-favor-simple-maintainable-solutions-over-clever-ones](../engineering/practice-favor-simple-maintainable-solutions-over-clever-ones.md)
- Related: [practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production](../engineering/practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production.md)
- Related: [practice-implement-only-what-the-user-explicitly-requests](../engineering/practice-implement-only-what-the-user-explicitly-requests.md)
- Related: [practice-lead-each-platform-installation-section-with-homebrew](../engineering/practice-lead-each-platform-installation-section-with-homebrew.md)
- Related: [practice-upload-release-zips-using-the-makerzip-filenames](../engineering/practice-upload-release-zips-using-the-makerzip-filenames.md)
- Related: [practice-use-conventional-commit-naming-for-pr-titles](../engineering/practice-use-conventional-commit-naming-for-pr-titles.md)
<!-- kk:related:end -->
