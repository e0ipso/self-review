# kenkeep Index: knowledge-base / curate

↑ Parent: [knowledge-base](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) to learn about: Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else. #kk-curate #conflicts #reply-contract
- Open [**Apply curator conflicts using the selected reply**](practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) to learn about: Accept updates the target and removes the conflict; reject removes only the conflict. #kk-curate #outcomes #git
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) to learn about: Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists. #kk-curate #conflicts #defaults
- Open [**Finish curation after reporting placements and rebalance**](practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md) to learn about: With no conflicts, report placements and structural results before the final summary. #kk-curate #fast-path #summary
- Open [**Report curation results after rebuilding navigation**](practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) to learn about: Report counts, placements, structural actions and failures for review. #kk-curate #handoff #index
- Open [**Run curation in the current session**](practice-run-kb-curator-via-npx-with-explicit-harness-id.md) to learn about: Use kk-curate and its deterministic primitives without spawning a nested CLI. #kk-curate #cli #harness
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) to learn about: Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group. #kk-curate #conflicts #grouping

## Components (what exists)
- Open [**Knowledge-base capture and curation workflow**](map-knowledge-base-capture-curate-review-workflow.md) to learn about: Capture sessions, extract proposals, curate nodes and consume topical navigation. #knowledge-base #workflow #skills
- Open [**Curator persistence results**](map-curator-failure-modes-add-collision-and-modify-missing-target.md) to learn about: curate-persist reports written, dropped and failed actions with per-action results. #kk-curate #failures #reasons
- Open [**Kenkeep curation commands**](map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate.md) to learn about: Extract, validate, deduplicate, persist and rebuild through deterministic commands. #kk-curate #cli #subcommands

## By topic

### #kk-curate
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) — Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else.
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) — Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group.
### #conflicts
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) — Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else.
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) — Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group.
### #cli
- Open [**Kenkeep CLI**](../tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Bootstrap document exclusions**](../tooling/map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Select the harness for harness-specific kenkeep commands**](../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
### #defaults
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Hide untracked files by default for --staged/--cached reviews**](../../app/cli/practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #failures
- Open [**Curator persistence results**](map-curator-failure-modes-add-collision-and-modify-missing-target.md) — curate-persist reports written, dropped and failed actions with per-action results.
### #fast-path
- Open [**Finish curation after reporting placements and rebalance**](practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md) — With no conflicts, report placements and structural results before the final summary.
### #git
- Open [**Apply curator conflicts using the selected reply**](practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept updates the target and removes the conflict; reject removes only the conflict.
- Open [**Review knowledge-base changes via git diff before committing**](../structure/practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
- Open [**Three startup modes: git, directory, welcome**](../../app/cli/map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #grouping
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) — Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group.
### #handoff
- Open [**Report curation results after rebuilding navigation**](practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) — Report counts, placements, structural actions and failures for review.
### #harness
- Open [**Kenkeep harness detector**](../tooling/map-kb-detect-harness-helper-script.md) — The shipped helper resolves explicit hints, environment or CLI defaults.
- Open [**Select the harness for harness-specific kenkeep commands**](../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
- Open [**Run curation in the current session**](practice-run-kb-curator-via-npx-with-explicit-harness-id.md) — Use kk-curate and its deterministic primitives without spawning a nested CLI.
### #index
- Open [**Regenerate kenkeep navigation after node changes**](../structure/practice-do-not-hand-edit-index-md-or-graph-md.md) — Use index rebuild for ENTRY.md, GRAPH.md and topical index nodes.
- Open [**Report curation results after rebuilding navigation**](practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) — Report counts, placements, structural actions and failures for review.
### #knowledge-base
- Open [**Kenkeep CLI**](../tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../bootstrap/discovery/map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
### #outcomes
- Open [**Apply curator conflicts using the selected reply**](practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept updates the target and removes the conflict; reject removes only the conflict.
### #reasons
- Open [**Curator persistence results**](map-curator-failure-modes-add-collision-and-modify-missing-target.md) — curate-persist reports written, dropped and failed actions with per-action results.
### #reply-contract
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) — Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else.
### #skills
- Open [**Knowledge-base capture and curation workflow**](map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.
- Open [**kk-bootstrap skill**](../bootstrap/workflow/map-kb-bootstrap-skill.md) — Supervised seeding from existing Markdown, with validated node writes.
- Open [**self-review-critique skill**](../../skills/critique/configuration/map-self-review-critique-skill.md) — Generate a guide and evidence-based review XML for local or remote diffs.
### #subcommands
- Open [**Kenkeep curation commands**](map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate.md) — Extract, validate, deduplicate, persist and rebuild through deterministic commands.
### #summary
- Open [**Finish curation after reporting placements and rebalance**](practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md) — With no conflicts, report placements and structural results before the final summary.
### #workflow
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**Knowledge-base capture and curation workflow**](map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.