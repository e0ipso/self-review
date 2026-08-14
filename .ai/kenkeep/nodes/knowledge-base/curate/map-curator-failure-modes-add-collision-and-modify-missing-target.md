---
type: map
title: 'Curator failure modes: add_collision and modify_missing_target'
description: >-
  Failures surfaced verbatim with reason and detail when the curator cannot
  apply a proposed add or modify.
tags:
  - kb-curate
  - failures
  - reasons
kk_schema_version: 3
kk_id: map-curator-failure-modes-add-collision-and-modify-missing-target
kk_derived_from:
  - .cursor/skills/kb-curate/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The curator reports two named failure modes that the kb-curate skill must surface verbatim to the user with their `reason` and `detail`:

- `add_collision` — a proposed `add` action conflicts with an existing node at the target path.
- `modify_missing_target` — a proposed `modify` action references a node id that does not exist.

These are reported in the `failure(s)` list of the curator's stdout and require manual cleanup; the skill must not silently swallow them.

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-curate/SKILL.md](.cursor/skills/kb-curate/SKILL.md)
<!-- kk:citations:end -->
