---
type: map
title: Knowledge-base capture and curation workflow
description: >-
  Capture sessions, extract proposals, curate nodes and consume topical
  navigation.
tags:
  - knowledge-base
  - workflow
  - skills
kk_schema_version: 3
kk_id: map-knowledge-base-capture-curate-review-workflow
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
kk_relates_to:
  - map-curator-failure-modes-add-collision-and-modify-missing-target
  - map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate
  - practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts
  - practice-apply-curator-conflict-outcomes-via-targeted-git-commands
  - practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence
  - practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild
  - practice-run-kb-curator-via-npx-with-explicit-harness-id
  - practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures
  - practice-sort-and-group-pending-conflicts-before-resolving
  - map-kb-bootstrap-skill
kk_depends_on: []
kk_confidence: high
---
Hooks capture redacted transcripts to `_sessions/`. `kk-curate` extracts proposals in-host, then drafts add/modify/drop/contradict actions, deduplicates once and persists survivors. Contradictions require user decisions. After rebuilding navigation and any triggered rebalance, the user reviews the uncommitted node changes. Future sessions descend through the generated topical indices.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-curator-failure-modes-add-collision-and-modify-missing-target](map-curator-failure-modes-add-collision-and-modify-missing-target.md)
- Related: [map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate](map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate.md)
- Related: [practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md)
- Related: [practice-apply-curator-conflict-outcomes-via-targeted-git-commands](practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md)
- Related: [practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md)
- Related: [practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild](practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md)
- Related: [practice-run-kb-curator-via-npx-with-explicit-harness-id](practice-run-kb-curator-via-npx-with-explicit-harness-id.md)
- Related: [practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures](practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md)
- Related: [practice-sort-and-group-pending-conflicts-before-resolving](practice-sort-and-group-pending-conflicts-before-resolving.md)
- Related: [map-kb-bootstrap-skill](../bootstrap/workflow/map-kb-bootstrap-skill.md)
<!-- kk:related:end -->
