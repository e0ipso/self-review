---
schema_version: 3
nodes_hash: 'sha256:3b49bca508c6c49b8ee9fd68f18ab17ab5667712e31ac5e0f7f644dbb32cdb01'
node_count: 175
---
# kenkeep

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Branches
- Load [`app/`](nodes/app/index.md) for more information on what the self-review desktop app is and the local-only runtime guarantees it makes; read when reasoning about the app's scope, privacy posture, or what it is allowed to write.
- Load [`engineering/`](nodes/engineering/index.md) for more information on cross-cutting engineering conventions on scope, simplicity, code reuse, testing, and commits; read when deciding how to implement or verify any change.
- Load [`knowledge-base/`](nodes/knowledge-base/index.md) for more information on Knowledge Base.
- Load [`packages/`](nodes/packages/index.md) for more information on the npm workspace packages, their import boundaries, CSS build pipeline, and adapter pattern; read when changing shared package code or its dependencies.
- Load [`planning/`](nodes/planning/index.md) for more information on the plan and blueprint lifecycle, its lifecycle hooks, and task-quality rules; read when creating, decomposing, or executing a plan.
- Load [`review-xml/`](nodes/review-xml/index.md) for more information on the review.xml output format, its XSD schema, and the comment and suggestion attribute rules; read when producing, validating, or consuming a review document.
- Load [`skills/`](nodes/skills/index.md) for more information on Skills.
