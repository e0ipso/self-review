---
schema_version: 1
id: map-self-review-yaml-project-config
title: .self-review.yaml project config
kind: map
tags:
  - self-review
  - config
derived_from:
  - .agents/skills/self-review-critique/SKILL.md
relates_to: []
confidence: high
summary: >-
  Optional per-project YAML config defining critique categories and output-file
  path.
---
`.self-review.yaml` is an optional project-root config consumed by [[self-review-critique-skill]]. Recognized keys:

- `categories`: array of `{name, description, color}` objects. When present, the critique restricts `<category>` values to these names.
- `output-file`: path for the generated review file (default `./review.xml`).

When absent, the critique skill falls back to [[default-critique-categories]].
