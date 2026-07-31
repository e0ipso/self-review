---
type: map
title: .self-review.yaml project config
description: >-
  Optional per-project YAML config defining critique categories and output-file
  path.
tags:
  - self-review
  - config
kk_schema_version: 3
kk_id: map-self-review-yaml-project-config
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`.self-review.yaml` is an optional project-root config consumed by [[self-review-critique-skill]]. Recognized keys:

- `categories`: array of `{name, description, color}` objects. When present, the critique restricts `<category>` values to these names.
- `output-file`: path for the generated review file (default `./review.xml`).

When absent, the critique skill falls back to [[default-critique-categories]].

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->
