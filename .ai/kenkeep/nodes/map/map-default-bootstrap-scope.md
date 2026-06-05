---
schema_version: 1
id: map-default-bootstrap-scope
title: Default bootstrap scope
kind: map
tags:
  - knowledge-base
  - scope
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  With no path argument, kb-bootstrap scans `docs/`, top-level README,
  CONTRIBUTING, ARCHITECTURE, and root-level `*.md` files.
---
If the user does not pass a path argument, the skill defaults its scope to: the `docs/` directory, the top-level `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, and any `*.md` files at the repository root. A user-supplied path argument overrides this and becomes the root of the docs scope.
