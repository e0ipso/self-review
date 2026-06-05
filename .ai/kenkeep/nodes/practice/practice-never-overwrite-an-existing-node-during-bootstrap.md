---
schema_version: 1
id: practice-never-overwrite-an-existing-node-during-bootstrap
title: Never overwrite an existing node during bootstrap
kind: practice
tags:
  - knowledge-base
  - node-authoring
  - collision
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Bootstrap is conservative: if a target node file already exists, refine the
  title or skip the candidate and report it.
---
Before writing each node at `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`, check whether the file already exists. If it does, either refine the title to avoid the collision or skip the candidate.

**Why:** Bootstrap should not destroy prior curated content. **How to apply:** Surface every skipped collision in the final report so the user can merge content manually if desired.
