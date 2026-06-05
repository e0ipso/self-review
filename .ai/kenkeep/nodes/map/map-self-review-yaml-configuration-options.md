---
schema_version: 1
id: map-self-review-yaml-configuration-options
title: self-review YAML configuration options
kind: map
tags:
  - config
  - yaml
derived_from:
  - README.md
relates_to: []
confidence: high
summary: >-
  User (`~/.config/self-review/config.yaml`) and project (`.self-review.yaml`)
  configs control theme, diff view, categories, payload limits, and more.
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
