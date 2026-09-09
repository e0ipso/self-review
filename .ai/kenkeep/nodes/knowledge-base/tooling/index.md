# kenkeep Index: knowledge-base / tooling

↑ Parent: [knowledge-base](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Select the harness for harness-specific kenkeep commands**](practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) to learn about: Use explicit harness selection for launcher commands; deterministic commands need no override. #knowledge-base #harness #cli

## Components (what exists)
- Open [**Kenkeep CLI**](map-ai-knowledge-base-cli.md) to learn about: Deterministic commands discover documents, validate schemas and maintain nodes. #knowledge-base #cli
- Open [**Bootstrap document exclusions**](map-cli-static-skip-list.md) to learn about: finddocs applies gitignore, kkignore and its static filename exclusions. #knowledge-base #cli #skip-list
- Open [**Kenkeep harness detector**](map-kb-detect-harness-helper-script.md) to learn about: The shipped helper resolves explicit hints, environment or CLI defaults. #knowledge-base #harness #detection
- Open [**Kenkeep harness detector**](map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) to learn about: The shipped helper resolves explicit hints, environment or CLI defaults. #kb #harness #detection

## By topic

### #knowledge-base
- Open [**Kenkeep CLI**](map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../bootstrap/discovery/map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
### #cli
- Open [**Kenkeep CLI**](map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Bootstrap document exclusions**](map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Select the harness for harness-specific kenkeep commands**](practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
### #harness
- Open [**Kenkeep harness detector**](map-kb-detect-harness-helper-script.md) — The shipped helper resolves explicit hints, environment or CLI defaults.
- Open [**Select the harness for harness-specific kenkeep commands**](practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
- Open [**Run curation in the current session**](../curate/practice-run-kb-curator-via-npx-with-explicit-harness-id.md) — Use kk-curate and its deterministic primitives without spawning a nested CLI.
### #detection
- Open [**Kenkeep harness detector**](map-kb-detect-harness-helper-script.md) — The shipped helper resolves explicit hints, environment or CLI defaults.
- Open [**Kenkeep harness detector**](map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) — The shipped helper resolves explicit hints, environment or CLI defaults.
### #kb
- Open [**Kenkeep directory layout**](../structure/map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes use topical folders; sessions, conflicts and logs have separate directories.
- Open [**Kenkeep harness detector**](map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md) — The shipped helper resolves explicit hints, environment or CLI defaults.
### #skip-list
- Open [**Bootstrap document exclusions**](../bootstrap/discovery/map-cli-static-skip-list-for-bootstrap-candidates.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Bootstrap document exclusions**](map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.