# kenkeep Index: knowledge-base / bootstrap / discovery

↑ Parent: [bootstrap](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Defer file discovery to the CLI's bootstrap-incremental dry run**](practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) to learn about: Use \`npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run\` to list candidate files; do not rebuild discovery yourself. #knowledge-base #cli #discovery
- Open [**Read entry points first, then sample and follow cross-references**](practice-read-entry-points-first-then-sample-and-follow-cross-references.md) to learn about: Read top-level entry points completely; sample other docs and follow inter-doc links rather than reading every file end-to-end. #knowledge-base #reading-strategy
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) to learn about: Bootstrap extracts what's already been written down — read only markdown docs, not source code. #knowledge-base #scope

## Components (what exists)
- Open [**CLI static skip list for bootstrap candidates**](map-cli-static-skip-list-for-bootstrap-candidates.md) to learn about: Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs. #knowledge-base #cli #skip-list #bootstrap
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) to learn about: With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files. #knowledge-base #scope

## By topic

### #knowledge-base
- Open [**ai-knowledge-base CLI**](../../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
### #cli
- Open [**ai-knowledge-base CLI**](../../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**CLI static skip list**](../../tooling/map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](../../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
### #scope
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](../../../skills/critique/review-strategy/practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.
### #bootstrap
- Open [**CLI static skip list for bootstrap candidates**](map-cli-static-skip-list-for-bootstrap-candidates.md) — Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs.
- Open [**Run kb-bootstrap as a one-pass, supervised operation**](../workflow/practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) — Bootstrap is a one-time, supervised pass — work judgmentally by sampling and following cross-references, not exhaustively.
### #discovery
- Open [**Defer file discovery to the CLI's bootstrap-incremental dry run**](practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) — Use \`npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run\` to list candidate files; do not rebuild discovery yourself.
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](../../../planning/assignment/practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
### #reading-strategy
- Open [**Read entry points first, then sample and follow cross-references**](practice-read-entry-points-first-then-sample-and-follow-cross-references.md) — Read top-level entry points completely; sample other docs and follow inter-doc links rather than reading every file end-to-end.
### #skip-list
- Open [**CLI static skip list**](../../tooling/map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**CLI static skip list for bootstrap candidates**](map-cli-static-skip-list-for-bootstrap-candidates.md) — Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs.