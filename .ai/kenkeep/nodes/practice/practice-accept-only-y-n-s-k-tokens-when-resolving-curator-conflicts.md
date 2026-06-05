---
schema_version: 1
id: practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts
title: Accept only y/n/s/k tokens when resolving curator conflicts
kind: practice
tags:
  - kb-curate
  - conflicts
  - reply-contract
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  Parse conflict replies strictly as y/n/s/k (or long forms / empty for
  default); re-prompt on anything else.
---
When walking pending conflicts in `.ai/knowledge-base/conflicts/`, accept only: empty/`y`/`Y`/`yes` → accept; `n`/`N`/`no` → reject; `s`/`S`/`skip` → skip; `k`/`K`/`keep` → keep as record. Any other reply (including prose like "looks good" or "skip this one") must trigger a re-prompt of the same conflict with the same default highlighted.

**Why:** Inferring intent from prose risks miscategorizing a contradiction and silently rewriting or discarding nodes. The strict contract prevents that.

**How to apply:** Always show both the existing node (once per group) and the proposed contradiction before asking. Capitalize the default letter in the bracket group (e.g. `[Y/n/s/k]`).
