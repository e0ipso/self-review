---
schema_version: 1
id: practice-split-combined-content-across-practice-and-map-nodes
title: Split combined content across practice and map nodes
kind: practice
tags:
  - knowledge-base
  - node-authoring
  - ownership
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  When content has both imperative and named-entity aspects, split it: practice
  owns the rule; map owns the definition.
---
For example, "Use bravo_analytics.dispatcher, our service for tracking events" becomes two nodes: a practice node ("use the dispatcher") and a map node ("what the dispatcher is").

**Why:** Practice owns imperative knowledge; map owns named-entity definitions. **How to apply:** Whenever you spot a candidate that mixes a convention with a definition, emit one of each kind rather than cramming both into one node.
