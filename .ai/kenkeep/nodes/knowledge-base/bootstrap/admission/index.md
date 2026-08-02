# kenkeep Index: knowledge-base / bootstrap / admission

↑ Parent: [bootstrap](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Consolidate multi-source candidates into a single node with multiple \`derived_from\`**](practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from.md) to learn about: When the same convention appears in multiple docs, write one node and list all source paths in \`derived_from\`. #knowledge-base #deduplication
- Open [**Default node confidence to medium during bootstrap**](practice-default-node-confidence-to-medium-during-bootstrap.md) to learn about: Use \`confidence: medium\` for bootstrap content by default; reserve \`high\` for explicitly-stated, actively-maintained docs. #knowledge-base #confidence
- Open [**Never auto-resolve contradictions during bootstrap**](practice-never-auto-resolve-contradictions-during-bootstrap.md) to learn about: If two docs disagree, write only one node and surface the conflict in your final report — do not write a second contradictory node. #knowledge-base #contradictions
- Open [**Never overwrite an existing node during bootstrap**](practice-never-overwrite-an-existing-node-during-bootstrap.md) to learn about: Bootstrap is conservative: if a target node file already exists, refine the title or skip the candidate and report it. #knowledge-base #node-authoring #collision

## Components (what exists)
_None yet._

## By topic

### #knowledge-base
- Open [**ai-knowledge-base CLI**](../../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../discovery/map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
### #collision
- Open [**Never overwrite an existing node during bootstrap**](practice-never-overwrite-an-existing-node-during-bootstrap.md) — Bootstrap is conservative: if a target node file already exists, refine the title or skip the candidate and report it.
### #confidence
- Open [**Default node confidence to medium during bootstrap**](practice-default-node-confidence-to-medium-during-bootstrap.md) — Use \`confidence: medium\` for bootstrap content by default; reserve \`high\` for explicitly-stated, actively-maintained docs.
### #contradictions
- Open [**Never auto-resolve contradictions during bootstrap**](practice-never-auto-resolve-contradictions-during-bootstrap.md) — If two docs disagree, write only one node and surface the conflict in your final report — do not write a second contradictory node.
### #deduplication
- Open [**Consolidate multi-source candidates into a single node with multiple \`derived_from\`**](practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from.md) — When the same convention appears in multiple docs, write one node and list all source paths in \`derived_from\`.
### #node-authoring
- Open [**Don't hallucinate rationale in node bodies**](../../structure/practice-don-t-hallucinate-rationale-in-node-bodies.md) — Only include "because…" content that is actually present in the source doc; do not generate plausible-sounding rationale.
- Open [**Never overwrite an existing node during bootstrap**](practice-never-overwrite-an-existing-node-during-bootstrap.md) — Bootstrap is conservative: if a target node file already exists, refine the title or skip the candidate and report it.
- Open [**Split combined content across practice and map nodes**](../../structure/practice-split-combined-content-across-practice-and-map-nodes.md) — When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition.