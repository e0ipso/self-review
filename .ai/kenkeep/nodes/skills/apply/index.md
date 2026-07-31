# kenkeep Index: skills / apply

↑ Parent: [skills](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Apply review suggestions bottom-to-top by line number**](practice-apply-review-suggestions-bottom-to-top-by-line-number.md) to learn about: Sort suggestions by line number descending before applying so earlier edits don't invalidate later line references. #self-review #suggestions #ordering
- Open [**Load the original diff context before applying review feedback**](practice-load-the-original-diff-context-before-applying-review-feedback.md) to learn about: Reconstruct the reviewer's view via git diff (git mode) or by reading source files (directory mode) before editing. #self-review #git-diff #context
- Open [**Parallelize self-review application per file above a 3-file threshold**](practice-parallelize-self-review-application-per-file-above-a-3-file-threshold.md) to learn about: For reviews with >3 commented files, spawn one subagent per file; for ≤3, apply changes directly. #self-review #workflow #subagents
- Open [**Treat every review comment as actionable, including questions**](practice-treat-every-review-comment-as-actionable-including-questions.md) to learn about: Question-category comments often imply a code change is needed; answer purely informational ones in the summary. #self-review #comments #questions
- Open [**Validate self-review XML against the XSD before applying**](practice-validate-self-review-xml-against-the-xsd-before-applying.md) to learn about: Run xmllint against assets/self-review-v2.xsd before processing review feedback; stop on failure. #self-review #validation #xmllint

## Components (what exists)
- Open [**self-review-apply assistant skill**](map-self-review-apply-assistant-skill.md) to learn about: Bundled AI assistant skill that reads review.xml and applies the feedback to the codebase. #skill #ai #workflow
- Open [**self-review-apply skill**](map-self-review-apply-skill.md) to learn about: Slash command that consumes a review.xml file and applies its suggestions/comments to the codebase. #self-review #skills #apply

## By topic

### #self-review
- Open [**Set viewed="true" on every file in critique output**](../critique/practice-set-viewed-true-on-every-file-in-critique-output.md) — When generating review.xml from /self-review-critique, mark all files with viewed="true" since the assistant "viewed" them all.
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../critique/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../critique/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
### #workflow
- Open [**POST_PHASE hook**](../../planning/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Follow the allowed task status transitions**](../../planning/practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.
### #ai
- Open [**Design XML output to be parsed by LLMs**](../../review-xml/practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**PRE_TASK_ASSIGNMENT hook**](../../planning/map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**self-review-apply assistant skill**](map-self-review-apply-assistant-skill.md) — Bundled AI assistant skill that reads review.xml and applies the feedback to the codebase.
### #apply
- Open [**self-review-apply skill**](map-self-review-apply-skill.md) — Slash command that consumes a review.xml file and applies its suggestions/comments to the codebase.
### #comments
- Open [**Pair line-number attributes correctly in review comments**](../../review-xml/practice-pair-line-number-attributes-correctly-in-review-comments.md) — A comment uses exactly one of new-line-start/end OR old-line-start/end; never both. Neither pair means file-level.
- Open [**Pair line-number attributes correctly on review comments**](../../review-xml/practice-pair-line-number-attributes-correctly-on-review-comments.md) — A comment has exactly one pair: new-line-start/end for added/context lines OR old-line-start/end for deleted lines. Never both.
- Open [**Line comments reference either old or new line numbers, never both**](../../review-xml/practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) — Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither.
### #context
- Open [**Load the original diff context before applying review feedback**](practice-load-the-original-diff-context-before-applying-review-feedback.md) — Reconstruct the reviewer's view via git diff (git mode) or by reading source files (directory mode) before editing.
- Open [**Read full file contents for added/modified files when critiquing**](../critique/practice-read-full-file-contents-for-added-modified-files-when-critiquing.md) — Read the current file (not just the diff hunks) to understand surrounding code; skip reading for deleted or binary files.
### #git-diff
- Open [**Load the original diff context before applying review feedback**](practice-load-the-original-diff-context-before-applying-review-feedback.md) — Reconstruct the reviewer's view via git diff (git mode) or by reading source files (directory mode) before editing.
### #ordering
- Open [**Apply review suggestions bottom-to-top by line number**](practice-apply-review-suggestions-bottom-to-top-by-line-number.md) — Sort suggestions by line number descending before applying so earlier edits don't invalidate later line references.
### #questions
- Open [**Treat every review comment as actionable, including questions**](practice-treat-every-review-comment-as-actionable-including-questions.md) — Question-category comments often imply a code change is needed; answer purely informational ones in the summary.
### #skill
- Open [**kb-bootstrap skill**](../../knowledge-base/bootstrap/map-kb-bootstrap-skill.md) — One-time, supervised skill that seeds the project knowledge base from existing markdown documentation.
- Open [**self-review-apply assistant skill**](map-self-review-apply-assistant-skill.md) — Bundled AI assistant skill that reads review.xml and applies the feedback to the codebase.
### #skills
- Open [**self-review-apply skill**](map-self-review-apply-skill.md) — Slash command that consumes a review.xml file and applies its suggestions/comments to the codebase.
- Open [**self-review-critique skill**](../critique/map-self-review-critique-skill.md) — Slash command that critiques a git diff and emits review.xml for human validation via self-review --resume-from.
- Open [**Engage relevant assistant skills based on task skills**](../../planning/practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
### #subagents
- Open [**Parallelize self-review application per file above a 3-file threshold**](practice-parallelize-self-review-application-per-file-above-a-3-file-threshold.md) — For reviews with >3 commented files, spawn one subagent per file; for ≤3, apply changes directly.
### #suggestions
- Open [**Attach a suggestion block whenever a concrete fix is possible**](../critique/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md) — For every critique comment where a fix can be proposed, include a \`<suggestion>\` so the human can accept or reject it individually.
- Open [**Use <suggestion> blocks whenever a concrete fix can be proposed**](../critique/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md) — For each comment with an actionable fix, include a <suggestion> so the human reviewer can accept or reject the change individually.
- Open [**Apply review suggestions bottom-to-top by line number**](practice-apply-review-suggestions-bottom-to-top-by-line-number.md) — Sort suggestions by line number descending before applying so earlier edits don't invalidate later line references.
### #validation
- Open [**Validate generated review.xml against the XSD before finishing**](../critique/practice-validate-generated-review-xml-against-the-xsd-before-finishing.md) — Run xmllint against .agents/skills/self-review-apply/assets/self-review-v2.xsd after writing the file; fix and re-validate on failure.
- Open [**Validate generated review.xml against the XSD with xmllint**](../critique/practice-validate-generated-review-xml-against-the-xsd-with-xmllint.md) — Run \`xmllint --schema ... --noout\` against the output. If validation fails, fix the XML and re-validate. If xmllint is missing, warn and continue.
- Open [**Validate self-review XML against the XSD before applying**](practice-validate-self-review-xml-against-the-xsd-before-applying.md) — Run xmllint against assets/self-review-v2.xsd before processing review feedback; stop on failure.
### #xmllint
- Open [**Validate self-review XML against the XSD before applying**](practice-validate-self-review-xml-against-the-xsd-before-applying.md) — Run xmllint against assets/self-review-v2.xsd before processing review feedback; stop on failure.