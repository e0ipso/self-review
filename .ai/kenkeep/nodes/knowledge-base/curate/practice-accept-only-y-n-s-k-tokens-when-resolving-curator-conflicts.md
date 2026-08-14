---
type: practice
title: Accept only y/n/s/k tokens when resolving curator conflicts
description: >-
  Parse conflict replies strictly as y/n/s/k (or long forms / empty for
  default); re-prompt on anything else.
tags:
  - kb-curate
  - conflicts
  - reply-contract
kk_schema_version: 3
kk_id: practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts
kk_derived_from:
  - .cursor/skills/kb-curate/SKILL.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
When walking pending conflicts in `.ai/knowledge-base/conflicts/`, accept only: empty/`y`/`Y`/`yes` → accept; `n`/`N`/`no` → reject; `s`/`S`/`skip` → skip; `k`/`K`/`keep` → keep as record. Any other reply (including prose like "looks good" or "skip this one") must trigger a re-prompt of the same conflict with the same default highlighted.

**Why:** Inferring intent from prose risks miscategorizing a contradiction and silently rewriting or discarding nodes. The strict contract prevents that.

**How to apply:** Always show both the existing node (once per group) and the proposed contradiction before asking. Capitalize the default letter in the bracket group (e.g. `[Y/n/s/k]`).

<!-- kk:citations:start -->
# Citations

[1] [.cursor/skills/kb-curate/SKILL.md](.cursor/skills/kb-curate/SKILL.md)
<!-- kk:citations:end -->
