# kenkeep Index: knowledge-base / tooling

↑ Parent: [knowledge-base](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) to learn about: Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call. #knowledge-base #harness #cli

## Components (what exists)
- Open [**ai-knowledge-base CLI**](map-ai-knowledge-base-cli.md) to learn about: \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap. #knowledge-base #cli
- Open [**CLI static skip list**](map-cli-static-skip-list.md) to learn about: The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates. #knowledge-base #cli #skip-list
- Open [**KB harness detection script at /tmp/kb-detect-harness.mjs**](map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) to learn about: Node script that resolves the active KB harness id, mirroring src/harnesses/detect.ts resolveWithHint priority. #kb #harness #detection
- Open [**kb-detect-harness helper script**](map-kb-detect-harness-helper-script.md) to learn about: \`/tmp/kb-detect-harness.mjs\` resolves the active KB harness id by hint, env vars, or \`cliDefaultHarness\` in KB config. #knowledge-base #harness #detection

## By topic

### #knowledge-base
- Open [**ai-knowledge-base CLI**](map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../bootstrap/discovery/map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
### #cli
- Open [**ai-knowledge-base CLI**](map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**CLI static skip list**](map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
### #harness
- Open [**kb-detect-harness helper script**](map-kb-detect-harness-helper-script.md) — \`/tmp/kb-detect-harness.mjs\` resolves the active KB harness id by hint, env vars, or \`cliDefaultHarness\` in KB config.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
- Open [**Run kb curator via npx with explicit harness id**](../curate/practice-run-kb-curator-via-npx-with-explicit-harness-id.md) — Curate pending session logs with \`npx @e0ipso/ai-knowledge-base@latest curate --harness "$HARNESS"\` using the resolved harness id.
### #detection
- Open [**KB harness detection script at /tmp/kb-detect-harness.mjs**](map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) — Node script that resolves the active KB harness id, mirroring src/harnesses/detect.ts resolveWithHint priority.
- Open [**kb-detect-harness helper script**](map-kb-detect-harness-helper-script.md) — \`/tmp/kb-detect-harness.mjs\` resolves the active KB harness id by hint, env vars, or \`cliDefaultHarness\` in KB config.
### #kb
- Open [**KB harness detection script at /tmp/kb-detect-harness.mjs**](map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) — Node script that resolves the active KB harness id, mirroring src/harnesses/detect.ts resolveWithHint priority.
- Open [**Knowledge-base directory layout under .ai/knowledge-base/**](../structure/map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes live in nodes/<kind>/, conflicts in conflicts/<id>.md, curator state in .state/state.json, indexes are INDEX.md/GRAPH.md.
### #skip-list
- Open [**CLI static skip list**](map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**CLI static skip list for bootstrap candidates**](../bootstrap/discovery/map-cli-static-skip-list-for-bootstrap-candidates.md) — Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs.