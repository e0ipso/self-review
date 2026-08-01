---
type: map
title: Default bootstrap scope
description: >-
  With no path argument, kb-bootstrap scans `docs/`, top-level README,
  CONTRIBUTING, ARCHITECTURE, and root-level `*.md` files.
tags:
  - knowledge-base
  - scope
kk_schema_version: 3
kk_id: map-default-bootstrap-scope
kk_derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
If the user does not pass a path argument, the skill defaults its scope to: the `docs/` directory, the top-level `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, and any `*.md` files at the repository root. A user-supplied path argument overrides this and becomes the root of the docs scope.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-bootstrap/SKILL.md](.cursor/skills/kb-bootstrap/SKILL.md)
<!-- kk:citations:end -->
