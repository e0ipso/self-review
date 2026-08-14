# kenkeep Index: app / cli

↑ Parent: [app](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) to learn about: Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle. #staged #untracked #defaults
- Open [**Never write to stdout in the main process**](practice-never-write-to-stdout-in-the-main-process.md) to learn about: Use console.error() for logging in the main process; stdout is unused and reserved. #task-manager #logging #stdout
- Open [**Never write to stdout; use stderr for all logging**](practice-never-write-to-stdout-use-stderr-for-all-logging.md) to learn about: stdout is unused. XML goes to a file; all progress, warnings, errors go to stderr. #logging #stdout #cli
- Open [**Preserve orphaned comments on resume; never silently drop them**](practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md) to learn about: Comments from a resumed review that can't be mapped to current lines get orphaned="true" and a visual indicator, never deleted. #resume #comments #data-integrity
- Open [**Show welcome screen when launched outside a git repo with no directory arg**](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md) to learn about: Don't error-exit when launched from Finder or an app launcher; show the welcome screen with a directory picker instead. #startup #launcher #welcome
- Open [**Treat self-review as a CLI-first, one-shot tool**](practice-treat-self-review-as-a-cli-first-one-shot-tool.md) to learn about: self-review launches from the terminal, writes review output to a file, then exits. No servers or persistent state. #cli #workflow #output

## Components (what exists)
- Open [**--resume-from for continuing a prior review**](map-resume-from-for-continuing-a-prior-review.md) to learn about: CLI flag that loads a previously exported review XML and overlays comments onto the current diff. #resume #cli
- Open [**self-review CLI invocations**](map-self-review-cli-invocations.md) to learn about: CLI accepts git-diff-style arguments plus \`--staged\`, \`--resume-from\`, and bare invocation for working-tree review. #cli #flags
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) to learn about: git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context. #mode #git #directory #welcome

## By topic

### #cli
- Open [**ai-knowledge-base CLI**](../../knowledge-base/tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**CLI static skip list**](../../knowledge-base/tooling/map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](../../knowledge-base/tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
### #logging
- Open [**Never write to stdout in the main process**](practice-never-write-to-stdout-in-the-main-process.md) — Use console.error() for logging in the main process; stdout is unused and reserved.
- Open [**Never write to stdout; use stderr for all logging**](practice-never-write-to-stdout-use-stderr-for-all-logging.md) — stdout is unused. XML goes to a file; all progress, warnings, errors go to stderr.
### #resume
- Open [**--resume-from for continuing a prior review**](map-resume-from-for-continuing-a-prior-review.md) — CLI flag that loads a previously exported review XML and overlays comments onto the current diff.
- Open [**Preserve orphaned comments on resume; never silently drop them**](practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md) — Comments from a resumed review that can't be mapped to current lines get orphaned="true" and a visual indicator, never deleted.
### #stdout
- Open [**Never write to stdout in the main process**](practice-never-write-to-stdout-in-the-main-process.md) — Use console.error() for logging in the main process; stdout is unused and reserved.
- Open [**Never write to stdout; use stderr for all logging**](practice-never-write-to-stdout-use-stderr-for-all-logging.md) — stdout is unused. XML goes to a file; all progress, warnings, errors go to stderr.
### #welcome
- Open [**Show welcome screen when launched outside a git repo with no directory arg**](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md) — Don't error-exit when launched from Finder or an app launcher; show the welcome screen with a directory picker instead.
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #comments
- Open [**Pair line-number attributes correctly in review comments**](../../review-xml/line-anchors/practice-pair-line-number-attributes-correctly-in-review-comments.md) — Use exactly one complete new-line or old-line pair on line comments; omit both pairs for file-level comments.
- Open [**Pair line-number attributes correctly on review comments**](../../review-xml/line-anchors/practice-pair-line-number-attributes-correctly-on-review-comments.md) — A comment has exactly one pair: new-line-start/end for added/context lines OR old-line-start/end for deleted lines. Never both.
- Open [**Line comments reference either old or new line numbers, never both**](../../review-xml/line-anchors/practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md) — Comments on added/context lines use new-line-start/end; comments on deleted lines use old-line-start/end. File-level comments have neither.
### #data-integrity
- Open [**Preserve orphaned comments on resume; never silently drop them**](practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md) — Comments from a resumed review that can't be mapped to current lines get orphaned="true" and a visual indicator, never deleted.
### #defaults
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](../../knowledge-base/curate/practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #directory
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #flags
- Open [**self-review CLI invocations**](map-self-review-cli-invocations.md) — CLI accepts git-diff-style arguments plus \`--staged\`, \`--resume-from\`, and bare invocation for working-tree review.
### #git
- Open [**Apply curator conflict outcomes via targeted git commands**](../../knowledge-base/curate/practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept rewrites the node and restores the conflict file; reject restores it; skip leaves it; keep commits it.
- Open [**Review knowledge-base changes via git diff before committing**](../../knowledge-base/structure/practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #launcher
- Open [**Show welcome screen when launched outside a git repo with no directory arg**](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md) — Don't error-exit when launched from Finder or an app launcher; show the welcome screen with a directory picker instead.
### #mode
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #output
- Open [**Design XML output to be parsed by LLMs**](../../review-xml/schema/practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**self-review-v3 XSD output format**](../../review-xml/schema/map-self-review-v1-xsd-output-format.md) — Review output uses self-review-v3.xsd and urn:self-review:v3; v1 and v2 stay frozen, while the current version may gain optional attributes additively.
- Open [**Treat self-review as a CLI-first, one-shot tool**](practice-treat-self-review-as-a-cli-first-one-shot-tool.md) — self-review launches from the terminal, writes review output to a file, then exits. No servers or persistent state.
### #staged
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #startup
- Open [**Show welcome screen when launched outside a git repo with no directory arg**](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md) — Don't error-exit when launched from Finder or an app launcher; show the welcome screen with a directory picker instead.
### #task-manager
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #untracked
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #workflow
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Follow the allowed task status transitions**](../../planning/execution/practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.