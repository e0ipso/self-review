---
type: map
title: self-review YAML configuration options
description: >-
  User (`~/.config/self-review/config.yaml`) and project (`.self-review.yaml`)
  configs control theme, diff view, categories, payload limits, and more.
tags:
  - config
  - yaml
kk_schema_version: 3
kk_id: map-self-review-yaml-configuration-options
kk_derived_from:
  - README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Available options from the README:
- `theme`: light, dark, or system (default: system)
- `diff-view`: split or unified (default: split)
- `font-size`: editor font in pixels (default: 14)
- `output-file`: review XML output path (default: `./review.xml`)
- `ignore`: gitignore-compatible exclude patterns
- `categories`: custom comment tags with name/description/color
- `default-diff-args`: default `git diff` arguments
- `show-untracked`: include new untracked files (default: true)
- `word-wrap`: wrap long diff lines (default: true)
- `max-files`: large payload file threshold (default: 500; `0` disables)
- `max-total-lines`: large payload line threshold (default: 100000; `0` disables)

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
<!-- kk:citations:end -->
