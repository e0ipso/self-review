# kenkeep Index: knowledge-base / bootstrap / discovery

↑ Parent: [bootstrap](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Discover bootstrap documents through finddocs**](practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) to learn about: Use finddocs with hashes and compare prior bootstrap state before reading. #knowledge-base #cli #discovery
- Open [**Read entry points first, then sample and follow cross-references**](practice-read-entry-points-first-then-sample-and-follow-cross-references.md) to learn about: Read top-level entry points completely; sample other docs and follow inter-doc links rather than reading every file end-to-end. #knowledge-base #reading-strategy
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) to learn about: Bootstrap extracts what's already been written down — read only markdown docs, not source code. #knowledge-base #scope

## Components (what exists)
- Open [**Bootstrap document exclusions**](map-cli-static-skip-list-for-bootstrap-candidates.md) to learn about: finddocs applies gitignore, kkignore and its static filename exclusions. #knowledge-base #cli #skip-list #bootstrap
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) to learn about: Without a scope argument, finddocs scans from the repository root. #knowledge-base #scope

## By topic

### #knowledge-base
- Open [**Kenkeep CLI**](../../tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
### #cli
- Open [**Kenkeep CLI**](../../tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Bootstrap document exclusions**](../../tooling/map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Select the harness for harness-specific kenkeep commands**](../../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
### #scope
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](../../../skills/critique/review-strategy/practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.
### #bootstrap
- Open [**Bootstrap document exclusions**](map-cli-static-skip-list-for-bootstrap-candidates.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Run bootstrap as a supervised pass**](../workflow/practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) — Sample source documentation and let the user review each new node.
### #discovery
- Open [**Discover agents through the active harness**](../../../planning/assignment/practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Use the current harness agents directory, with general-purpose fallback.
- Open [**Discover bootstrap documents through finddocs**](practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) — Use finddocs with hashes and compare prior bootstrap state before reading.
### #reading-strategy
- Open [**Read entry points first, then sample and follow cross-references**](practice-read-entry-points-first-then-sample-and-follow-cross-references.md) — Read top-level entry points completely; sample other docs and follow inter-doc links rather than reading every file end-to-end.
### #skip-list
- Open [**Bootstrap document exclusions**](map-cli-static-skip-list-for-bootstrap-candidates.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Bootstrap document exclusions**](../../tooling/map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.