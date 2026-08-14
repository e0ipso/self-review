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
  app/ui/interactions: >-
    review input and navigation interactions; read when changing comment
    controls, selection, or keyboard behavior
  app/ui/lifecycle: >-
    review save and exit behavior; read when changing Finish Review or
    window-close flows
  app/ui/previews: >-
    rendered previews and diff presentation rules; read when changing preview
    modes or syntax highlighting
  engineering: >-
    cross-cutting engineering conventions on scope, simplicity, code reuse,
    testing, and commits; read when deciding how to implement or verify any
    change
  knowledge-base/bootstrap: >-
    the bootstrap skill's scope, reading strategy, and node-authoring
    safeguards; read when seeding the knowledge base from existing documentation
  knowledge-base/bootstrap/admission: >-
    bootstrap candidate admission and collision handling; read when deciding
    which extracted nodes to keep
  knowledge-base/bootstrap/discovery: >-
    bootstrap discovery and source selection; read when choosing documentation
    scope or candidate files
  knowledge-base/bootstrap/workflow: >-
    bootstrap execution and supervision; read when running or reporting a
    knowledge-base bootstrap
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
  packages/architecture: >-
    workspace and browser-package architecture; read when changing package
    boundaries, adapters, or review state
  packages/styling: >-
    react package styling and theme isolation; read when changing CSS builds,
    Tailwind, or portal rendering
  packages/types: >-
    shared type package constraints; read when changing cross-package data
    structures
  planning: >-
    the plan and blueprint lifecycle, its lifecycle hooks, and task-quality
    rules; read when creating, decomposing, or executing a plan
  planning/assignment: >-
    task assignment and skill matching; read when selecting agents or assistant
    skills for work
  planning/authoring: plan authoring gates and PRD scope; read when creating or reviewing a plan
  planning/execution: >-
    phase execution and completion gates; read when updating task status,
    validating, or committing a phase
  planning/task-generation: >-
    task generation and blueprint construction; read when decomposing a plan
    into executable phases
  review-xml: >-
    the review.xml output format, its XSD schema, and the comment and suggestion
    attribute rules; read when producing, validating, or consuming a review
    document
  review-xml/comments: >-
    review comment content and metadata rules; read when parsing or emitting
    comment bodies, categories, attribution, or renames
  review-xml/line-anchors: >-
    review comment line-anchor rules; read when mapping comments to old or new
    diff lines
  review-xml/schema: >-
    review XML schema and validation contract; read when changing the document
    format or XSD
  skills/apply: >-
    the self-review-apply skill's workflow for consuming review.xml feedback;
    read when applying review comments and suggestions to code
  skills/critique: >-
    the self-review-critique skill's diff selection, comment authoring, and
    validation rules; read when generating review.xml from a diff
  skills/critique/configuration: >-
    critique skill invocation and category configuration; read when starting a
    critique or choosing output categories
  skills/critique/output: >-
    AI-generated review XML output requirements; read when emitting attribution,
    viewed state, or validating critique output
  skills/critique/review-strategy: >-
    critique context and signal-selection strategy; read when deciding what code
    to inspect or comment on
  skills/critique/suggestions: >-
    actionable critique suggestions; read when constructing exact replacement
    suggestions
---
# kenkeep Folder Summaries

- `app`: what the self-review desktop app is and the local-only runtime guarantees it makes; read when reasoning about the app's scope, privacy posture, or what it is allowed to write
- `app/architecture`: the two-process Electron model, IPC channel contract, renderer state rules, and large-payload lazy loading; read when changing the main/renderer boundary or how diffs are delivered
- `app/cli`: CLI invocation, startup modes, resume, and stderr-only logging; read when changing how the app is launched or what it emits
- `app/config`: the user and project .self-review.yaml files and their precedence rules; read when adding or resolving a configuration option
- `app/ui`: diff viewer rendering, rendered file previews, keyboard navigation, comment editing, and exit UX; read when changing renderer components or review interactions
- `app/ui/interactions`: review input and navigation interactions; read when changing comment controls, selection, or keyboard behavior
- `app/ui/lifecycle`: review save and exit behavior; read when changing Finish Review or window-close flows
- `app/ui/previews`: rendered previews and diff presentation rules; read when changing preview modes or syntax highlighting
- `engineering`: cross-cutting engineering conventions on scope, simplicity, code reuse, testing, and commits; read when deciding how to implement or verify any change
- `knowledge-base/bootstrap`: the bootstrap skill's scope, reading strategy, and node-authoring safeguards; read when seeding the knowledge base from existing documentation
- `knowledge-base/bootstrap/admission`: bootstrap candidate admission and collision handling; read when deciding which extracted nodes to keep
- `knowledge-base/bootstrap/discovery`: bootstrap discovery and source selection; read when choosing documentation scope or candidate files
- `knowledge-base/bootstrap/workflow`: bootstrap execution and supervision; read when running or reporting a knowledge-base bootstrap
- `knowledge-base/curate`: the curate skill's CLI invocation, conflict-resolution contract, and handoff; read when processing pending session logs
- `knowledge-base/structure`: the knowledge base's on-disk layout, node frontmatter, generated indices, and review workflow; read when authoring or reorganizing knowledge nodes
- `knowledge-base/tooling`: the knowledge-base CLI surface, harness detection, and skip lists; read when invoking knowledge-base commands from a skill
- `packages`: the npm workspace packages, their import boundaries, CSS build pipeline, and adapter pattern; read when changing shared package code or its dependencies
- `packages/architecture`: workspace and browser-package architecture; read when changing package boundaries, adapters, or review state
- `packages/styling`: react package styling and theme isolation; read when changing CSS builds, Tailwind, or portal rendering
- `packages/types`: shared type package constraints; read when changing cross-package data structures
- `planning`: the plan and blueprint lifecycle, its lifecycle hooks, and task-quality rules; read when creating, decomposing, or executing a plan
- `planning/assignment`: task assignment and skill matching; read when selecting agents or assistant skills for work
- `planning/authoring`: plan authoring gates and PRD scope; read when creating or reviewing a plan
- `planning/execution`: phase execution and completion gates; read when updating task status, validating, or committing a phase
- `planning/task-generation`: task generation and blueprint construction; read when decomposing a plan into executable phases
- `review-xml`: the review.xml output format, its XSD schema, and the comment and suggestion attribute rules; read when producing, validating, or consuming a review document
- `review-xml/comments`: review comment content and metadata rules; read when parsing or emitting comment bodies, categories, attribution, or renames
- `review-xml/line-anchors`: review comment line-anchor rules; read when mapping comments to old or new diff lines
- `review-xml/schema`: review XML schema and validation contract; read when changing the document format or XSD
- `skills/apply`: the self-review-apply skill's workflow for consuming review.xml feedback; read when applying review comments and suggestions to code
- `skills/critique`: the self-review-critique skill's diff selection, comment authoring, and validation rules; read when generating review.xml from a diff
- `skills/critique/configuration`: critique skill invocation and category configuration; read when starting a critique or choosing output categories
- `skills/critique/output`: AI-generated review XML output requirements; read when emitting attribution, viewed state, or validating critique output
- `skills/critique/review-strategy`: critique context and signal-selection strategy; read when deciding what code to inspect or comment on
- `skills/critique/suggestions`: actionable critique suggestions; read when constructing exact replacement suggestions
