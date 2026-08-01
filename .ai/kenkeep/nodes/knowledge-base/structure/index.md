# kenkeep Index: knowledge-base / structure

↑ Parent: [knowledge-base](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**_sessions/ is gitignored; provenance does not travel with the repo**](practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo.md) to learn about: derived_from session filenames only resolve for the original contributor unless your team explicitly commits _sessions/. #knowledge-base #sessions #provenance
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](practice-do-not-hand-edit-index-md-or-graph-md.md) to learn about: Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit. #knowledge-base #index #hooks
- Open [**Don't hallucinate rationale in node bodies**](practice-don-t-hallucinate-rationale-in-node-bodies.md) to learn about: Only include "because…" content that is actually present in the source doc; do not generate plausible-sounding rationale. #knowledge-base #node-authoring #rationale
- Open [**Refresh INDEX.md and GRAPH.md after writing nodes**](practice-refresh-index-md-and-graph-md-after-writing-nodes.md) to learn about: Run \`npx @e0ipso/ai-knowledge-base index rebuild\` after writing nodes so the indices reflect them before reviewer diff. #knowledge-base #cli #indexing
- Open [**Review knowledge-base changes via git diff before committing**](practice-review-knowledge-base-changes-via-git-diff-before-committing.md) to learn about: Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore. #knowledge-base #git #review
- Open [**Split combined content across practice and map nodes**](practice-split-combined-content-across-practice-and-map-nodes.md) to learn about: When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition. #knowledge-base #node-authoring #ownership

## Components (what exists)
- Open [**.ai/knowledge-base/ directory**](map-ai-knowledge-base-directory.md) to learn about: AI-session-derived project knowledge base built and maintained by @e0ipso/ai-knowledge-base. #knowledge-base #structure
- Open [**Knowledge base config locations**](map-knowledge-base-config-locations.md) to learn about: KB config is read from \`.ai/knowledge-base/config.yaml\`, with fallback to \`~/.config/ai-knowledge-base/config.yaml\`. #knowledge-base #config
- Open [**Knowledge base node layout**](map-knowledge-base-node-layout.md) to learn about: Nodes live under \`.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md\`, with \`<kind>\` being \`practice\` or \`map\`. #knowledge-base #layout #nodes
- Open [**Knowledge-base directory layout under .ai/knowledge-base/**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) to learn about: Nodes live in nodes/<kind>/, conflicts in conflicts/<id>.md, curator state in .state/state.json, indexes are INDEX.md/GRAPH.md. #kb #layout #paths
- Open [**Knowledge-base node kinds and frontmatter**](map-knowledge-base-node-kinds-and-frontmatter.md) to learn about: Nodes are practice (how we build) or map (what exists), with frontmatter including kind, tags, derived_from, relates_to, summary. #knowledge-base #node #schema

## By topic

### #knowledge-base
- Open [**ai-knowledge-base CLI**](../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../bootstrap/discovery/map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
### #layout
- Open [**Keep all @self-review/types definitions in src/index.ts**](../../packages/types/practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.
- Open [**Knowledge base node layout**](map-knowledge-base-node-layout.md) — Nodes live under \`.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md\`, with \`<kind>\` being \`practice\` or \`map\`.
- Open [**Knowledge-base directory layout under .ai/knowledge-base/**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes live in nodes/<kind>/, conflicts in conflicts/<id>.md, curator state in .state/state.json, indexes are INDEX.md/GRAPH.md.
### #node-authoring
- Open [**Don't hallucinate rationale in node bodies**](practice-don-t-hallucinate-rationale-in-node-bodies.md) — Only include "because…" content that is actually present in the source doc; do not generate plausible-sounding rationale.
- Open [**Never overwrite an existing node during bootstrap**](../bootstrap/admission/practice-never-overwrite-an-existing-node-during-bootstrap.md) — Bootstrap is conservative: if a target node file already exists, refine the title or skip the candidate and report it.
- Open [**Split combined content across practice and map nodes**](practice-split-combined-content-across-practice-and-map-nodes.md) — When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition.
### #cli
- Open [**ai-knowledge-base CLI**](../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**CLI static skip list**](../tooling/map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
### #config
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](../../app/config/practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) — Higher-priority values override lower-priority values on a per-key shallow merge.
- Open [**Apply config precedence: project overrides user overrides defaults**](../../app/config/practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) — \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults.
- Open [**Knowledge base config locations**](map-knowledge-base-config-locations.md) — KB config is read from \`.ai/knowledge-base/config.yaml\`, with fallback to \`~/.config/ai-knowledge-base/config.yaml\`.
### #git
- Open [**Apply curator conflict outcomes via targeted git commands**](../curate/practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept rewrites the node and restores the conflict file; reject restores it; skip leaves it; keep commits it.
- Open [**Review knowledge-base changes via git diff before committing**](practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
- Open [**Three startup modes: git, directory, welcome**](../../app/cli/map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #hooks
- Open [**PRE_TASK_ASSIGNMENT hook**](../../planning/assignment/map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**POST_PLAN hook**](../../planning/authoring/map-post-plan-hook.md) — Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates plans on PRD/test updates and architecture review.
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](practice-do-not-hand-edit-index-md-or-graph-md.md) — Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit.
### #index
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](practice-do-not-hand-edit-index-md-or-graph-md.md) — Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit.
- Open [**Hand off curate runs via git diff and optional pre-commit index rebuild**](../curate/practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) — Tell the user to review with \`git diff .ai/knowledge-base/\`; the curator already regenerated INDEX/GRAPH at end-of-run.
### #indexing
- Open [**Refresh INDEX.md and GRAPH.md after writing nodes**](practice-refresh-index-md-and-graph-md-after-writing-nodes.md) — Run \`npx @e0ipso/ai-knowledge-base index rebuild\` after writing nodes so the indices reflect them before reviewer diff.
### #kb
- Open [**KB harness detection script at /tmp/kb-detect-harness.mjs**](../tooling/map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) — Node script that resolves the active KB harness id, mirroring src/harnesses/detect.ts resolveWithHint priority.
- Open [**Knowledge-base directory layout under .ai/knowledge-base/**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes live in nodes/<kind>/, conflicts in conflicts/<id>.md, curator state in .state/state.json, indexes are INDEX.md/GRAPH.md.
### #node
- Open [**Knowledge-base node kinds and frontmatter**](map-knowledge-base-node-kinds-and-frontmatter.md) — Nodes are practice (how we build) or map (what exists), with frontmatter including kind, tags, derived_from, relates_to, summary.
### #nodes
- Open [**Knowledge base node layout**](map-knowledge-base-node-layout.md) — Nodes live under \`.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md\`, with \`<kind>\` being \`practice\` or \`map\`.
### #ownership
- Open [**Split combined content across practice and map nodes**](practice-split-combined-content-across-practice-and-map-nodes.md) — When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition.
### #paths
- Open [**Knowledge-base directory layout under .ai/knowledge-base/**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes live in nodes/<kind>/, conflicts in conflicts/<id>.md, curator state in .state/state.json, indexes are INDEX.md/GRAPH.md.
### #provenance
- Open [**_sessions/ is gitignored; provenance does not travel with the repo**](practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo.md) — derived_from session filenames only resolve for the original contributor unless your team explicitly commits _sessions/.
### #rationale
- Open [**Don't hallucinate rationale in node bodies**](practice-don-t-hallucinate-rationale-in-node-bodies.md) — Only include "because…" content that is actually present in the source doc; do not generate plausible-sounding rationale.
### #review
- Open [**Review knowledge-base changes via git diff before committing**](practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
### #schema
- Open [**review.xml format and XSD**](../../review-xml/schema/map-review-xml-format-and-xsd.md) — v3 XML review documents contain files, comments, suggestions, attachments, and ordered flat reply threads.
- Open [**self-review XML v3 schema**](../../review-xml/schema/map-self-review-xml-v1-schema.md) — The canonical v3 XSD defines files, comments, suggestions, attachments, and ordered reply threads.
- Open [**Emit no wrapper elements in the XML output**](../../review-xml/schema/practice-emit-no-wrapper-elements-in-the-xml-output.md) — file elements are direct children of review; no files or comments wrapper, no summary element.
### #sessions
- Open [**_sessions/ is gitignored; provenance does not travel with the repo**](practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo.md) — derived_from session filenames only resolve for the original contributor unless your team explicitly commits _sessions/.
### #structure
- Open [**.ai/knowledge-base/ directory**](map-ai-knowledge-base-directory.md) — AI-session-derived project knowledge base built and maintained by @e0ipso/ai-knowledge-base.
- Open [**Keep all @self-review/types definitions in src/index.ts**](../../packages/types/practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.