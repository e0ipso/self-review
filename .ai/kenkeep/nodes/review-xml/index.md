# kenkeep Index: review-xml

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Keep the XSD schema in sync across its three locations**](practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) to learn about: Schema lives at .agents/ and .opencode/ skill assets plus an embedded string in packages/core/src/xml-serializer.ts; a unit test enforces all three match. #task-manager #xsd #sync
- Open [**Design XML output to be parsed by LLMs**](practice-design-xml-output-to-be-parsed-by-llms.md) to learn about: Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback. #output #xml #ai
- Open [**Emit no wrapper elements in the XML output**](practice-emit-no-wrapper-elements-in-the-xml-output.md) to learn about: file elements are direct children of review; no files or comments wrapper, no summary element. #xml #schema
- Open [**Line comments reference either old or new line numbers, never both**](practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) to learn about: Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither. #xml #comments #line-numbers
- Open [**Pair comment line numbers as either new or old, never both**](practice-pair-comment-line-numbers-as-either-new-or-old-never-both.md) to learn about: Self-review comments use exactly one of new-line-start/end or old-line-start/end; file-level comments have neither. #self-review #xml #line-numbers
- Open [**Pair line-number attributes correctly in review comments**](practice-pair-line-number-attributes-correctly-in-review-comments.md) to learn about: A comment uses exactly one of new-line-start/end OR old-line-start/end; never both. Neither pair means file-level. #self-review #xml #comments
- Open [**Pair line-number attributes correctly on review comments**](practice-pair-line-number-attributes-correctly-on-review-comments.md) to learn about: A comment has exactly one pair: new-line-start/end for added/context lines OR old-line-start/end for deleted lines. Never both. #self-review #xml #comments
- Open [**Require a category on every comment**](practice-require-a-category-on-every-comment.md) to learn about: Every comment must have exactly one category, selected via radio-button semantics with the first configured category as default. #xml #categories
- Open [**Use old vs new line numbers based on the commented line type**](practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type.md) to learn about: Added/context lines use newLineStart/End; deleted lines use oldLineStart/End; exactly one pair, never both. #task-manager #line-numbers #comments
- Open [**Use the new path for renamed files in review XML**](practice-use-the-new-path-for-renamed-files-in-review-xml.md) to learn about: For change-type="renamed" entries, the path attribute carries the new path, not the original path. #self-review #xml #renames
- Open [**Validate XML output against the XSD before writing**](practice-validate-xml-output-against-the-xsd-before-writing.md) to learn about: Serializer must validate review output against the XSD; on failure, write to stderr and exit(1). #task-manager #xml #validation
- Open [**XML-escape all text content in review.xml**](practice-xml-escape-all-text-content-in-review-xml.md) to learn about: Escape &, <, >, ", and ' in body, code, and category text when constructing the XML by hand. #self-review #xml #escaping

## Components (what exists)
- Open [**XSD schema location**](map-xsd-schema-location.md) to learn about: Single source of truth at .agents/skills/self-review-apply/assets/self-review-v2.xsd, mirrored under .opencode/ and embedded in packages/core/src/xml-serializer.ts. #task-manager #xsd #schema
- Open [**Comment author attribution**](map-comment-author-attribution.md) to learn about: Critique-generated comments include an author attribute (model name); absent author shows 'You' with a person icon. #task-manager #comments #author
- Open [**review.xml format and XSD**](map-review-xml-format-and-xsd.md) to learn about: XML document with <review> root containing <file> entries; comments carry line ranges, categories, and optional suggestion blocks. #self-review #schema #xml
- Open [**self-review XML schema (self-review-v2.xsd)**](map-self-review-xml-schema-self-review-v1-xsd.md) to learn about: XSD schema at assets/self-review-v2.xsd defining the self-review XML format consumed by the apply skill. #self-review #xsd #schema
- Open [**self-review XML v2 schema**](map-self-review-xml-v1-schema.md) to learn about: XSD schema at .agents/skills/self-review-apply/assets/self-review-v2.xsd defining the review.xml format. #self-review #xml #schema
- Open [**self-review-v2 XSD output format**](map-self-review-v1-xsd-output-format.md) to learn about: Versioned XSD schema for review output; namespace urn:self-review:v2; file is bundled with the app. #xml #schema #output

## By topic

### #xml
- Open [**review.xml format and XSD**](map-review-xml-format-and-xsd.md) — XML document with <review> root containing <file> entries; comments carry line ranges, categories, and optional suggestion blocks.
- Open [**self-review XML v2 schema**](map-self-review-xml-v1-schema.md) — XSD schema at .agents/skills/self-review-apply/assets/self-review-v2.xsd defining the review.xml format.
- Open [**Pair line-number attributes correctly in review comments**](practice-pair-line-number-attributes-correctly-in-review-comments.md) — A comment uses exactly one of new-line-start/end OR old-line-start/end; never both. Neither pair means file-level.
### #self-review
- Open [**Set viewed="true" on every file in critique output**](../skills/critique/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../skills/critique/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../skills/critique/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
### #schema
- Open [**review.xml format and XSD**](map-review-xml-format-and-xsd.md) — XML document with <review> root containing <file> entries; comments carry line ranges, categories, and optional suggestion blocks.
- Open [**self-review XML v2 schema**](map-self-review-xml-v1-schema.md) — XSD schema at .agents/skills/self-review-apply/assets/self-review-v2.xsd defining the review.xml format.
- Open [**Emit no wrapper elements in the XML output**](practice-emit-no-wrapper-elements-in-the-xml-output.md) — file elements are direct children of review; no files or comments wrapper, no summary element.
### #comments
- Open [**Pair line-number attributes correctly in review comments**](practice-pair-line-number-attributes-correctly-in-review-comments.md) — A comment uses exactly one of new-line-start/end OR old-line-start/end; never both. Neither pair means file-level.
- Open [**Pair line-number attributes correctly on review comments**](practice-pair-line-number-attributes-correctly-on-review-comments.md) — A comment has exactly one pair: new-line-start/end for added/context lines OR old-line-start/end for deleted lines. Never both.
- Open [**Line comments reference either old or new line numbers, never both**](practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) — Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither.
### #task-manager
- Open [**POST_PHASE hook**](../planning/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../planning/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #line-numbers
- Open [**Line comments reference either old or new line numbers, never both**](practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) — Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither.
- Open [**Pair comment line numbers as either new or old, never both**](practice-pair-comment-line-numbers-as-either-new-or-old-never-both.md) — Self-review comments use exactly one of new-line-start/end or old-line-start/end; file-level comments have neither.
- Open [**Use old vs new line numbers based on the commented line type**](practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type.md) — Added/context lines use newLineStart/End; deleted lines use oldLineStart/End; exactly one pair, never both.
### #xsd
- Open [**XSD schema location**](map-xsd-schema-location.md) — Single source of truth at .agents/skills/self-review-apply/assets/self-review-v2.xsd, mirrored under .opencode/ and embedded in packages/core/src/xml-serializer.ts.
- Open [**Keep the XSD schema in sync across its three locations**](practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) — Schema lives at .agents/ and .opencode/ skill assets plus an embedded string in packages/core/src/xml-serializer.ts; a unit test enforces all three match.
- Open [**self-review XML schema (self-review-v2.xsd)**](map-self-review-xml-schema-self-review-v1-xsd.md) — XSD schema at assets/self-review-v2.xsd defining the self-review XML format consumed by the apply skill.
### #output
- Open [**Design XML output to be parsed by LLMs**](practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**self-review-v2 XSD output format**](map-self-review-v1-xsd-output-format.md) — Versioned XSD schema for review output; namespace urn:self-review:v2; file is bundled with the app.
- Open [**Treat self-review as a CLI-first, one-shot tool**](../app/cli/practice-treat-self-review-as-a-cli-first-one-shot-tool.md) — self-review launches from the terminal, writes review output to a file, then exits. No servers or persistent state.
### #ai
- Open [**Design XML output to be parsed by LLMs**](practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**PRE_TASK_ASSIGNMENT hook**](../planning/map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**self-review-apply assistant skill**](../skills/apply/map-self-review-apply-assistant-skill.md) — Bundled AI assistant skill that reads review.xml and applies the feedback to the codebase.
### #author
- Open [**Comment author attribution**](map-comment-author-attribution.md) — Critique-generated comments include an author attribute (model name); absent author shows 'You' with a person icon.
- Open [**Set the comment \`author\` attribute to the model name**](../skills/critique/practice-set-the-comment-author-attribute-to-the-model-name.md) — Every comment generated by the critique skill must include an \`author\` attribute identifying the model (e.g., "Claude Sonnet 4.6").
### #categories
- Open [**Default critique categories**](../skills/critique/map-default-critique-categories.md) — Six built-in comment categories used when .self-review.yaml is absent: question, bug, security, style, task, nit.
- Open [**Read categories from .self-review.yaml before generating critique**](../skills/critique/practice-read-categories-from-self-review-yaml-before-generating-critique.md) — If .self-review.yaml exists, use only its declared categories; otherwise fall back to the six built-in defaults.
- Open [**Use categories from .self-review.yaml when present**](../skills/critique/practice-use-categories-from-self-review-yaml-when-present.md) — If \`.self-review.yaml\` exists with a \`categories\` array, use only those category names. Otherwise, fall back to the documented defaults.
### #escaping
- Open [**XML-escape all text content in review.xml**](practice-xml-escape-all-text-content-in-review-xml.md) — Escape &, <, >, ", and ' in body, code, and category text when constructing the XML by hand.
### #renames
- Open [**Use the new path for renamed files in review XML**](practice-use-the-new-path-for-renamed-files-in-review-xml.md) — For change-type="renamed" entries, the path attribute carries the new path, not the original path.
### #sync
- Open [**Keep the XSD schema in sync across its three locations**](practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) — Schema lives at .agents/ and .opencode/ skill assets plus an embedded string in packages/core/src/xml-serializer.ts; a unit test enforces all three match.
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](../packages/practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #validation
- Open [**Validate generated review.xml against the XSD before finishing**](../skills/critique/practice-validate-generated-review-xml-against-the-xsd-before-finishing.md) — Run xmllint against .agents/skills/self-review-apply/assets/self-review-v2.xsd after writing the file; fix and re-validate on failure.
- Open [**Validate generated review.xml against the XSD with xmllint**](../skills/critique/practice-validate-generated-review-xml-against-the-xsd-with-xmllint.md) — Run \`xmllint --schema ... --noout\` against the output. If validation fails, fix the XML and re-validate. If xmllint is missing, warn and continue.
- Open [**Validate self-review XML against the XSD before applying**](../skills/apply/practice-validate-self-review-xml-against-the-xsd-before-applying.md) — Run xmllint against assets/self-review-v2.xsd before processing review feedback; stop on failure.