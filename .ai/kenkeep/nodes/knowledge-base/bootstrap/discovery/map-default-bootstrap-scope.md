---
type: map
title: Default bootstrap scope
description: >-
  Without a scope argument, finddocs scans from the repository root.
tags:
  - knowledge-base
  - scope
kk_schema_version: 3
kk_id: map-default-bootstrap-scope
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-kb-bootstrap-skill
kk_depends_on: []
kk_confidence: high
---
With no user path argument, `kk-bootstrap` scans from the repository root via `npx kenkeep finddocs --with-hashes`. A supplied path becomes `--from <scope>`. The primitive applies `.gitignore`, `.kkignore` and its static skip list before any content is read.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-kb-bootstrap-skill](../workflow/map-kb-bootstrap-skill.md)
<!-- kk:related:end -->
