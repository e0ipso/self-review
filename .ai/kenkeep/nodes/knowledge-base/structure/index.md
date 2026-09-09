# kenkeep Index: knowledge-base / structure

↑ Parent: [knowledge-base](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**_sessions/ is gitignored; provenance does not travel with the repo**](practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo.md) to learn about: derived_from session filenames only resolve for the original contributor unless your team explicitly commits _sessions/. #knowledge-base #sessions #provenance
- Open [**Don't hallucinate rationale in node bodies**](practice-don-t-hallucinate-rationale-in-node-bodies.md) to learn about: Only include "because…" content that is actually present in the source doc; do not generate plausible-sounding rationale. #knowledge-base #node-authoring #rationale
- Open [**Regenerate kenkeep navigation after node changes**](practice-do-not-hand-edit-index-md-or-graph-md.md) to learn about: Use index rebuild for ENTRY.md, GRAPH.md and topical index nodes. #knowledge-base #index #hooks
- Open [**Regenerate kenkeep navigation after node changes**](practice-refresh-index-md-and-graph-md-after-writing-nodes.md) to learn about: Use index rebuild for ENTRY.md, GRAPH.md and topical index nodes. #knowledge-base #cli #indexing
- Open [**Review knowledge-base changes via git diff before committing**](practice-review-knowledge-base-changes-via-git-diff-before-committing.md) to learn about: Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore. #knowledge-base #git #review
- Open [**Split combined content across practice and map nodes**](practice-split-combined-content-across-practice-and-map-nodes.md) to learn about: When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition. #knowledge-base #node-authoring #ownership

## Components (what exists)
- Open [**.ai/kenkeep directory**](map-ai-knowledge-base-directory.md) to learn about: Topical knowledge nodes, captured sessions, conflicts and generated navigation. #knowledge-base #structure
- Open [**Kenkeep directory layout**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) to learn about: Nodes use topical folders; sessions, conflicts and logs have separate directories. #kb #layout #paths
- Open [**Knowledge base configuration**](map-knowledge-base-config-locations.md) to learn about: Read project kenkeep configuration, with the user config fallback. #knowledge-base #config
- Open [**Knowledge node kinds and frontmatter**](map-knowledge-base-node-kinds-and-frontmatter.md) to learn about: Leaves use type, description and kk-prefixed identity, provenance and edge fields. #knowledge-base #nodes #schema
- Open [**Knowledge node placement**](map-knowledge-base-node-layout.md) to learn about: Stable node IDs live in topical folders, independent of practice/map kind. #knowledge-base #layout #nodes

## By topic

### #knowledge-base
- Open [**Kenkeep CLI**](../tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../bootstrap/discovery/map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
### #layout
- Open [**Keep all @self-review/types definitions in src/index.ts**](../../packages/types/practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.
- Open [**Kenkeep directory layout**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes use topical folders; sessions, conflicts and logs have separate directories.
- Open [**Knowledge node placement**](map-knowledge-base-node-layout.md) — Stable node IDs live in topical folders, independent of practice/map kind.
### #node-authoring
- Open [**Do not duplicate or overwrite existing nodes during bootstrap**](../bootstrap/admission/practice-never-overwrite-an-existing-node-during-bootstrap.md) — Skip and report candidates whose scope is already covered.
- Open [**Don't hallucinate rationale in node bodies**](practice-don-t-hallucinate-rationale-in-node-bodies.md) — Only include "because…" content that is actually present in the source doc; do not generate plausible-sounding rationale.
- Open [**Split combined content across practice and map nodes**](practice-split-combined-content-across-practice-and-map-nodes.md) — When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition.
### #nodes
- Open [**Knowledge node kinds and frontmatter**](map-knowledge-base-node-kinds-and-frontmatter.md) — Leaves use type, description and kk-prefixed identity, provenance and edge fields.
- Open [**Knowledge node placement**](map-knowledge-base-node-layout.md) — Stable node IDs live in topical folders, independent of practice/map kind.
### #cli
- Open [**Kenkeep CLI**](../tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Bootstrap document exclusions**](../tooling/map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Select the harness for harness-specific kenkeep commands**](../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
### #config
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](../../app/config/practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) — Higher-priority values override lower-priority values on a per-key shallow merge.
- Open [**Apply config precedence: project overrides user overrides defaults**](../../app/config/practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) — \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults.
- Open [**Knowledge base configuration**](map-knowledge-base-config-locations.md) — Read project kenkeep configuration, with the user config fallback.
### #git
- Open [**Apply curator conflicts using the selected reply**](../curate/practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept updates the target and removes the conflict; reject removes only the conflict.
- Open [**Review knowledge-base changes via git diff before committing**](practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
- Open [**Three startup modes: git, directory, welcome**](../../app/cli/map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #hooks
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**PRE_TASK_ASSIGNMENT hook**](../../planning/assignment/map-pre-task-assignment-hook.md) — Match task skills and domain to available agents in the active harness.
### #index
- Open [**Regenerate kenkeep navigation after node changes**](practice-do-not-hand-edit-index-md-or-graph-md.md) — Use index rebuild for ENTRY.md, GRAPH.md and topical index nodes.
- Open [**Report curation results after rebuilding navigation**](../curate/practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md) — Report counts, placements, structural actions and failures for review.
### #indexing
- Open [**Regenerate kenkeep navigation after node changes**](practice-refresh-index-md-and-graph-md-after-writing-nodes.md) — Use index rebuild for ENTRY.md, GRAPH.md and topical index nodes.
### #kb
- Open [**Kenkeep directory layout**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes use topical folders; sessions, conflicts and logs have separate directories.
- Open [**Kenkeep harness detector**](../tooling/map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) — The shipped helper resolves explicit hints, environment or CLI defaults.
### #ownership
- Open [**Split combined content across practice and map nodes**](practice-split-combined-content-across-practice-and-map-nodes.md) — When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition.
### #paths
- Open [**Kenkeep directory layout**](map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes use topical folders; sessions, conflicts and logs have separate directories.
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
- Open [**.ai/kenkeep directory**](map-ai-knowledge-base-directory.md) — Topical knowledge nodes, captured sessions, conflicts and generated navigation.
- Open [**Keep all @self-review/types definitions in src/index.ts**](../../packages/types/practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.