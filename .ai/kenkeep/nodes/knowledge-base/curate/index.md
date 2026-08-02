# kenkeep Index: knowledge-base / curate

↑ Parent: [knowledge-base](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) to learn about: Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else. #kb-curate #conflicts #reply-contract
- Open [**Apply curator conflict outcomes via targeted git commands**](practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) to learn about: Accept rewrites the node and restores the conflict file; reject restores it; skip leaves it; keep commits it. #kb-curate #outcomes #git
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) to learn about: Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists. #kb-curate #conflicts #defaults
- Open [**Hand off curate runs via git diff and optional pre-commit index rebuild**](practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) to learn about: Tell the user to review with \`git diff .ai/knowledge-base/\`; the curator already regenerated INDEX/GRAPH at end-of-run. #kb-curate #handoff #index
- Open [**Run kb curator via npx with explicit harness id**](practice-run-kb-curator-via-npx-with-explicit-harness-id.md) to learn about: Curate pending session logs with \`npx @e0ipso/ai-knowledge-base@latest curate --harness "$HARNESS"\` using the resolved harness id. #kb-curate #cli #harness
- Open [**Short-circuit kb-curate with one-line summary when no conflicts and no failures**](practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md) to learn about: If conflicts==0 AND failures.length==0, print one summary line and stop — skip every later step. #kb-curate #fast-path #summary
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) to learn about: Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group. #kb-curate #conflicts #grouping

## Components (what exists)
- Open [**@e0ipso/ai-knowledge-base CLI commands used by kb-curate**](map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate.md) to learn about: \`curate --harness <id>\` runs the curator; \`index rebuild --harness <id> --stage\` regenerates INDEX/GRAPH for pre-commit hooks. #kb-curate #cli #subcommands
- Open [**Curator failure modes: add_collision and modify_missing_target**](map-curator-failure-modes-add-collision-and-modify-missing-target.md) to learn about: Failures surfaced verbatim with reason and detail when the curator cannot apply a proposed add or modify. #kb-curate #failures #reasons
- Open [**Knowledge-base capture-curate-review workflow**](map-knowledge-base-capture-curate-review-workflow.md) to learn about: Sessions capture to _sessions/, /kb-curate writes nodes, git diff reviews, future sessions consume via injected INDEX.md. #knowledge-base #workflow #skills

## By topic

### #kb-curate
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) — Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else.
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) — Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group.
### #conflicts
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) — Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else.
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) — Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group.
### #cli
- Open [**ai-knowledge-base CLI**](../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**CLI static skip list**](../tooling/map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
### #defaults
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Hide untracked files by default for --staged/--cached reviews**](../../app/cli/practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #failures
- Open [**Curator failure modes: add_collision and modify_missing_target**](map-curator-failure-modes-add-collision-and-modify-missing-target.md) — Failures surfaced verbatim with reason and detail when the curator cannot apply a proposed add or modify.
### #fast-path
- Open [**Short-circuit kb-curate with one-line summary when no conflicts and no failures**](practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md) — If conflicts==0 AND failures.length==0, print one summary line and stop — skip every later step.
### #git
- Open [**Apply curator conflict outcomes via targeted git commands**](practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept rewrites the node and restores the conflict file; reject restores it; skip leaves it; keep commits it.
- Open [**Review knowledge-base changes via git diff before committing**](../structure/practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
- Open [**Three startup modes: git, directory, welcome**](../../app/cli/map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #grouping
- Open [**Sort and group pending conflicts before resolving**](practice-sort-and-group-pending-conflicts-before-resolving.md) — Sort pending conflicts by target_node_id, proposed_kind, detected_at; show the shared existing node once per group.
### #handoff
- Open [**Hand off curate runs via git diff and optional pre-commit index rebuild**](practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) — Tell the user to review with \`git diff .ai/knowledge-base/\`; the curator already regenerated INDEX/GRAPH at end-of-run.
### #harness
- Open [**kb-detect-harness helper script**](../tooling/map-kb-detect-harness-helper-script.md) — \`/tmp/kb-detect-harness.mjs\` resolves the active KB harness id by hint, env vars, or \`cliDefaultHarness\` in KB config.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
- Open [**Run kb curator via npx with explicit harness id**](practice-run-kb-curator-via-npx-with-explicit-harness-id.md) — Curate pending session logs with \`npx @e0ipso/ai-knowledge-base@latest curate --harness "$HARNESS"\` using the resolved harness id.
### #index
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](../structure/practice-do-not-hand-edit-index-md-or-graph-md.md) — Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit.
- Open [**Hand off curate runs via git diff and optional pre-commit index rebuild**](practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) — Tell the user to review with \`git diff .ai/knowledge-base/\`; the curator already regenerated INDEX/GRAPH at end-of-run.
### #knowledge-base
- Open [**ai-knowledge-base CLI**](../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../bootstrap/discovery/map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
### #outcomes
- Open [**Apply curator conflict outcomes via targeted git commands**](practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept rewrites the node and restores the conflict file; reject restores it; skip leaves it; keep commits it.
### #reasons
- Open [**Curator failure modes: add_collision and modify_missing_target**](map-curator-failure-modes-add-collision-and-modify-missing-target.md) — Failures surfaced verbatim with reason and detail when the curator cannot apply a proposed add or modify.
### #reply-contract
- Open [**Accept only y/n/s/k tokens when resolving curator conflicts**](practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md) — Parse conflict replies strictly as y/n/s/k (or long forms / empty for default); re-prompt on anything else.
### #skills
- Open [**self-review-apply skill**](../../skills/apply/map-self-review-apply-skill.md) — Slash command that consumes a v3 review.xml, reads threaded replies in order, and applies accepted feedback to the codebase.
- Open [**self-review-critique skill**](../../skills/critique/configuration/map-self-review-critique-skill.md) — Slash command that critiques a git diff and emits review.xml for human validation via self-review --resume-from.
- Open [**Engage relevant assistant skills based on task skills**](../../planning/assignment/practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
### #subcommands
- Open [**@e0ipso/ai-knowledge-base CLI commands used by kb-curate**](map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate.md) — \`curate --harness <id>\` runs the curator; \`index rebuild --harness <id> --stage\` regenerates INDEX/GRAPH for pre-commit hooks.
### #summary
- Open [**Short-circuit kb-curate with one-line summary when no conflicts and no failures**](practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md) — If conflicts==0 AND failures.length==0, print one summary line and stop — skip every later step.
### #workflow
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Follow the allowed task status transitions**](../../planning/execution/practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.