---
type: practice
title: Discover bootstrap documents through finddocs
description: >-
  Use finddocs with hashes and compare prior bootstrap state before reading.
tags:
  - knowledge-base
  - cli
  - discovery
kk_schema_version: 3
kk_id: practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-kb-bootstrap-skill
kk_depends_on: []
kk_confidence: high
---
Run `npx kenkeep finddocs --with-hashes`, adding `--from <scope>` when supplied. Parse the path/hash pairs and compare `.ai/kenkeep/.state/bootstrap-state.json` to skip unchanged documents. Do not reproduce the discovery, exclusion or hashing logic.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-kb-bootstrap-skill](../workflow/map-kb-bootstrap-skill.md)
<!-- kk:related:end -->
