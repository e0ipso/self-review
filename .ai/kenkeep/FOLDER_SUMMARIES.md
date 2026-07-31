---
schema_version: 1
summaries:
  app: >-
    what the self-review desktop app is and the local-only runtime guarantees it
    makes; read when reasoning about the app's scope, privacy posture, or what
    it is allowed to write
  app/architecture: >-
    the two-process Electron model, IPC channel contract, renderer state rules,
    and large-payload lazy loading; read when changing the main/renderer
    boundary or how diffs are delivered
  app/cli: >-
    CLI invocation, startup modes, resume, and stderr-only logging; read when
    changing how the app is launched or what it emits
  app/config: >-
    the user and project .self-review.yaml files and their precedence rules;
    read when adding or resolving a configuration option
  app/ui: >-
    diff viewer rendering, rendered file previews, keyboard navigation, comment
    editing, and exit UX; read when changing renderer components or review
    interactions
  engineering: >-
    cross-cutting engineering conventions on scope, simplicity, code reuse,
    testing, and commits; read when deciding how to implement or verify any
    change
  knowledge-base/bootstrap: >-
    the bootstrap skill's scope, reading strategy, and node-authoring
    safeguards; read when seeding the knowledge base from existing documentation
  knowledge-base/curate: >-
    the curate skill's CLI invocation, conflict-resolution contract, and
    handoff; read when processing pending session logs
  knowledge-base/structure: >-
    the knowledge base's on-disk layout, node frontmatter, generated indices,
    and review workflow; read when authoring or reorganizing knowledge nodes
  knowledge-base/tooling: >-
    the knowledge-base CLI surface, harness detection, and skip lists; read when
    invoking knowledge-base commands from a skill
  packages: >-
    the npm workspace packages, their import boundaries, CSS build pipeline, and
    adapter pattern; read when changing shared package code or its dependencies
  planning: >-
    the plan and blueprint lifecycle, its lifecycle hooks, and task-quality
    rules; read when creating, decomposing, or executing a plan
  review-xml: >-
    the review.xml output format, its XSD schema, and the comment and suggestion
    attribute rules; read when producing, validating, or consuming a review
    document
  skills/apply: >-
    the self-review-apply skill's workflow for consuming review.xml feedback;
    read when applying review comments and suggestions to code
  skills/critique: >-
    the self-review-critique skill's diff selection, comment authoring, and
    validation rules; read when generating review.xml from a diff
---
# kenkeep Folder Summaries

- `app`: what the self-review desktop app is and the local-only runtime guarantees it makes; read when reasoning about the app's scope, privacy posture, or what it is allowed to write
- `app/architecture`: the two-process Electron model, IPC channel contract, renderer state rules, and large-payload lazy loading; read when changing the main/renderer boundary or how diffs are delivered
- `app/cli`: CLI invocation, startup modes, resume, and stderr-only logging; read when changing how the app is launched or what it emits
- `app/config`: the user and project .self-review.yaml files and their precedence rules; read when adding or resolving a configuration option
- `app/ui`: diff viewer rendering, rendered file previews, keyboard navigation, comment editing, and exit UX; read when changing renderer components or review interactions
- `engineering`: cross-cutting engineering conventions on scope, simplicity, code reuse, testing, and commits; read when deciding how to implement or verify any change
- `knowledge-base/bootstrap`: the bootstrap skill's scope, reading strategy, and node-authoring safeguards; read when seeding the knowledge base from existing documentation
- `knowledge-base/curate`: the curate skill's CLI invocation, conflict-resolution contract, and handoff; read when processing pending session logs
- `knowledge-base/structure`: the knowledge base's on-disk layout, node frontmatter, generated indices, and review workflow; read when authoring or reorganizing knowledge nodes
- `knowledge-base/tooling`: the knowledge-base CLI surface, harness detection, and skip lists; read when invoking knowledge-base commands from a skill
- `packages`: the npm workspace packages, their import boundaries, CSS build pipeline, and adapter pattern; read when changing shared package code or its dependencies
- `planning`: the plan and blueprint lifecycle, its lifecycle hooks, and task-quality rules; read when creating, decomposing, or executing a plan
- `review-xml`: the review.xml output format, its XSD schema, and the comment and suggestion attribute rules; read when producing, validating, or consuming a review document
- `skills/apply`: the self-review-apply skill's workflow for consuming review.xml feedback; read when applying review comments and suggestions to code
- `skills/critique`: the self-review-critique skill's diff selection, comment authoring, and validation rules; read when generating review.xml from a diff
