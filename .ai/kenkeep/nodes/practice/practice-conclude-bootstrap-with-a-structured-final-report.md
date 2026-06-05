---
schema_version: 1
id: practice-conclude-bootstrap-with-a-structured-final-report
title: Conclude bootstrap with a structured final report
kind: practice
tags:
  - knowledge-base
  - reporting
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  After bootstrap, summarize docs read/skipped, node counts, collisions,
  unfollowed cross-references, suspect-stale docs, and index refresh.
---
At the end of the session, summarize for the user:

- How many docs you read; which ones you skipped and why.
- Practice node count and map node count.
- Any collisions you skipped (file already existed).
- Any cross-references you noticed but didn't follow.
- Any docs that looked stale or contradictory.
- Confirmation that `INDEX.md` and `GRAPH.md` were refreshed.

Then instruct the user to review with `git diff nodes/`, accept individual files with `git add nodes/<kind>/<file>.md && git commit`, and reject the rest with `git restore nodes/<kind>/<file>.md`.
