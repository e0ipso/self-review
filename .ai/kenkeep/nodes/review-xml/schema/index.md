# kenkeep Index: review-xml / schema

↑ Parent: [review-xml](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Keep the v3 XSD schema in sync across its two locations**](practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) to learn about: Keep the canonical v3 XSD and the serializer's embedded XSD byte-identical, and preserve the OpenCode skill symlinks. #self-review #xsd #sync
- Open [**Design XML output to be parsed by LLMs**](practice-design-xml-output-to-be-parsed-by-llms.md) to learn about: Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback. #output #xml #ai
- Open [**Emit no wrapper elements in the XML output**](practice-emit-no-wrapper-elements-in-the-xml-output.md) to learn about: file elements are direct children of review; no files or comments wrapper, no summary element. #xml #schema
- Open [**Validate XML output against the XSD before writing**](practice-validate-xml-output-against-the-xsd-before-writing.md) to learn about: Serializer must validate review output against the XSD; on failure, write to stderr and exit(1). #task-manager #xml #validation

## Components (what exists)
- Open [**review.xml format and XSD**](map-review-xml-format-and-xsd.md) to learn about: v3 XML review documents contain files, comments, suggestions, attachments, and ordered flat reply threads. #self-review #schema #xml
- Open [**XSD schema location**](map-xsd-schema-location.md) to learn about: The canonical v3 XSD is under the apply skill and must remain byte-identical to the serializer's embedded XSD; the OpenCode path is a symlink. #self-review #xsd #schema
- Open [**self-review XML schema (self-review-v3.xsd)**](map-self-review-xml-schema-self-review-v1-xsd.md) to learn about: The v3 XSD beside self-review-apply defines review metadata, files, comments, suggestions, attachments, and ordered replies. #self-review #xsd #schema
- Open [**self-review XML v3 schema**](map-self-review-xml-v1-schema.md) to learn about: The canonical v3 XSD defines files, comments, suggestions, attachments, and ordered reply threads. #self-review #xml #schema
- Open [**self-review-v3 XSD output format**](map-self-review-v1-xsd-output-format.md) to learn about: Review output uses self-review-v3.xsd and urn:self-review:v3; v1 and v2 stay frozen, while the current version may gain optional attributes additively. #xml #schema #output

## By topic

### #schema
- Open [**review.xml format and XSD**](map-review-xml-format-and-xsd.md) — v3 XML review documents contain files, comments, suggestions, attachments, and ordered flat reply threads.
- Open [**self-review XML v3 schema**](map-self-review-xml-v1-schema.md) — The canonical v3 XSD defines files, comments, suggestions, attachments, and ordered reply threads.
- Open [**Emit no wrapper elements in the XML output**](practice-emit-no-wrapper-elements-in-the-xml-output.md) — file elements are direct children of review; no files or comments wrapper, no summary element.
### #xml
- Open [**review.xml format and XSD**](map-review-xml-format-and-xsd.md) — v3 XML review documents contain files, comments, suggestions, attachments, and ordered flat reply threads.
- Open [**self-review XML v3 schema**](map-self-review-xml-v1-schema.md) — The canonical v3 XSD defines files, comments, suggestions, attachments, and ordered reply threads.
- Open [**Pair line-number attributes correctly in review comments**](../line-anchors/practice-pair-line-number-attributes-correctly-in-review-comments.md) — Use exactly one complete new-line or old-line pair on line comments; omit both pairs for file-level comments.
### #self-review
- Open [**Set viewed="true" on every file in critique output**](../../skills/critique/output/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../../skills/critique/suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../../skills/critique/suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
### #xsd
- Open [**XSD schema location**](map-xsd-schema-location.md) — The canonical v3 XSD is under the apply skill and must remain byte-identical to the serializer's embedded XSD; the OpenCode path is a symlink.
- Open [**self-review XML schema (self-review-v3.xsd)**](map-self-review-xml-schema-self-review-v1-xsd.md) — The v3 XSD beside self-review-apply defines review metadata, files, comments, suggestions, attachments, and ordered replies.
- Open [**Keep the v3 XSD schema in sync across its two locations**](practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) — Keep the canonical v3 XSD and the serializer's embedded XSD byte-identical, and preserve the OpenCode skill symlinks.
### #output
- Open [**Design XML output to be parsed by LLMs**](practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**self-review-v3 XSD output format**](map-self-review-v1-xsd-output-format.md) — Review output uses self-review-v3.xsd and urn:self-review:v3; v1 and v2 stay frozen, while the current version may gain optional attributes additively.
- Open [**Treat self-review as a CLI-first, one-shot tool**](../../app/cli/practice-treat-self-review-as-a-cli-first-one-shot-tool.md) — self-review launches from the terminal, writes review output to a file, then exits. No servers or persistent state.
### #ai
- Open [**Design XML output to be parsed by LLMs**](practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**PRE_TASK_ASSIGNMENT hook**](../../planning/assignment/map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**self-review-apply assistant skill**](../../skills/apply/map-self-review-apply-assistant-skill.md) — Bundled assistant skill that validates v3 review.xml feedback, reads reply threads, and applies the accepted comments.
### #sync
- Open [**Keep the v3 XSD schema in sync across its two locations**](practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md) — Keep the canonical v3 XSD and the serializer's embedded XSD byte-identical, and preserve the OpenCode skill symlinks.
- Open [**Keep file-type-utils.ts duplicates in sync across core and react**](../../packages/architecture/practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md) — The file is intentionally duplicated; both copies must be updated together.
### #task-manager
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #validation
- Open [**Validate generated review.xml against the XSD before finishing**](../../skills/critique/output/practice-validate-generated-review-xml-against-the-xsd-before-finishing.md) — Run xmllint against .agents/skills/self-review-apply/assets/self-review-v3.xsd after writing the file; fix and re-validate on failure.
- Open [**Validate generated review.xml against the XSD with xmllint**](../../skills/critique/output/practice-validate-generated-review-xml-against-the-xsd-with-xmllint.md) — Run \`xmllint --schema ... --noout\` against the v3 output; fix and re-validate failures, or warn and continue when xmllint is unavailable.
- Open [**Validate self-review XML against the XSD before applying**](../../skills/apply/practice-validate-self-review-xml-against-the-xsd-before-applying.md) — Run xmllint against assets/self-review-v3.xsd before processing review feedback; stop on failure.