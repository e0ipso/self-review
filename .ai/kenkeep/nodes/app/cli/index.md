# kenkeep Index: app / cli

↑ Parent: [app](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Convert git diff args only through format/tokenize**](practice-convert-git-diff-args-only-through-format-and-tokenize.md) to learn about: formatGitDiffArgs and tokenizeGitDiffArgs are the sanctioned argv-to-string conversion in both directions. #cli #git #review-xml #round-trip
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) to learn about: Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle. #staged #untracked #defaults
- Open [**Never write to stdout in the main process**](practice-never-write-to-stdout-in-the-main-process.md) to learn about: Use console.error() for logging in the main process; stdout is unused and reserved. #strikethroo #logging #stdout
- Open [**Never write to stdout; use stderr for all logging**](practice-never-write-to-stdout-use-stderr-for-all-logging.md) to learn about: stdout is unused. XML goes to a file; all progress, warnings, errors go to stderr. #logging #stdout #cli
- Open [**Preserve orphaned comments on resume; never silently drop them**](practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md) to learn about: Preserve and expose unmatched prior comments; complete orphan handling remains a PRD requirement. #resume #comments #data-integrity
- Open [**Show welcome screen when launched outside a git repo with no directory arg**](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md) to learn about: Don't error-exit when launched from Finder or an app launcher; show the welcome screen with a directory picker instead. #startup #launcher #welcome
- Open [**Treat self-review as a CLI-first, one-shot tool**](practice-treat-self-review-as-a-cli-first-one-shot-tool.md) to learn about: self-review launches from the terminal, writes review output to a file, then exits. No servers or persistent state. #cli #workflow #output
- Open [**Re-exec with headless Ozone for windowless subcommands**](practice-re-exec-with-headless-ozone-for-windowless-subcommands.md) to learn about: Packaged fuses disable RunAsNode, so ELECTRON_RUN_AS_NODE cannot make a subcommand headless; cli-dispatch re-execs. #electron #cli #packaging #headless

## Components (what exists)
- Open [**self-review CLI invocations**](map-self-review-cli-invocations.md) to learn about: Review local diffs, directories or forge URLs, or fetch comments headlessly. #cli #flags
- Open [**--resume-from for continuing a prior review**](map-resume-from-for-continuing-a-prior-review.md) to learn about: Resume overlays recorded comments and viewed state; line remapping is not implemented. #resume #cli
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) to learn about: git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context. #mode #git #directory #welcome

## By topic

### #cli
- Open [**Kenkeep CLI**](../../knowledge-base/tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Bootstrap document exclusions**](../../knowledge-base/tooling/map-cli-static-skip-list.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Select the harness for harness-specific kenkeep commands**](../../knowledge-base/tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Use explicit harness selection for launcher commands; deterministic commands need no override.
### #git
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](../../engineering/practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) — core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning.
- Open [**Apply curator conflicts using the selected reply**](../../knowledge-base/curate/practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept updates the target and removes the conflict; reject removes only the conflict.
- Open [**Review knowledge-base changes via git diff before committing**](../../knowledge-base/structure/practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
### #logging
- Open [**Never write to stdout in the main process**](practice-never-write-to-stdout-in-the-main-process.md) — Use console.error() for logging in the main process; stdout is unused and reserved.
- Open [**Never write to stdout; use stderr for all logging**](practice-never-write-to-stdout-use-stderr-for-all-logging.md) — stdout is unused. XML goes to a file; all progress, warnings, errors go to stderr.
### #resume
- Open [**--resume-from for continuing a prior review**](map-resume-from-for-continuing-a-prior-review.md) — Resume overlays recorded comments and viewed state; line remapping is not implemented.
- Open [**Preserve orphaned comments on resume; never silently drop them**](practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md) — Preserve and expose unmatched prior comments; complete orphan handling remains a PRD requirement.
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
- Open [**Preserve orphaned comments on resume; never silently drop them**](practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md) — Preserve and expose unmatched prior comments; complete orphan handling remains a PRD requirement.
### #defaults
- Open [**Compute conflict-resolution defaults from diff ratio and confidence**](../../knowledge-base/curate/practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md) — Default \`y\` for small high-confidence diffs (<5 lines), \`n\` for >50% changed, otherwise \`s\`; \`s\` when no target node exists.
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #directory
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #electron
- Open [**Re-exec with headless Ozone for windowless subcommands**](practice-re-exec-with-headless-ozone-for-windowless-subcommands.md) — Packaged fuses disable RunAsNode, so ELECTRON_RUN_AS_NODE cannot make a subcommand headless; cli-dispatch re-execs.
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](../../engineering/practice-use-asar-unpack-not-asarunpack-in-forge-config.md) — Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither.
- Open [**Two-process Electron architecture**](../architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
### #flags
- Open [**self-review CLI invocations**](map-self-review-cli-invocations.md) — Review local diffs, directories or forge URLs, or fetch comments headlessly.
### #headless
- Open [**Re-exec with headless Ozone for windowless subcommands**](practice-re-exec-with-headless-ozone-for-windowless-subcommands.md) — Packaged fuses disable RunAsNode, so ELECTRON_RUN_AS_NODE cannot make a subcommand headless; cli-dispatch re-execs.
### #launcher
- Open [**Show welcome screen when launched outside a git repo with no directory arg**](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md) — Don't error-exit when launched from Finder or an app launcher; show the welcome screen with a directory picker instead.
### #mode
- Open [**Three startup modes: git, directory, welcome**](map-three-startup-modes-git-directory-welcome.md) — git mode reviews a git diff; directory mode treats all files as new additions; welcome mode shows a picker when launched without context.
### #output
- Open [**Design XML output to be parsed by LLMs**](../../review-xml/schema/practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**self-review-v3 XSD output format**](../../review-xml/schema/map-self-review-v1-xsd-output-format.md) — Review output uses self-review-v3.xsd and urn:self-review:v3; v1 and v2 stay frozen, while the current version may gain optional attributes additively.
- Open [**Treat self-review as a CLI-first, one-shot tool**](practice-treat-self-review-as-a-cli-first-one-shot-tool.md) — self-review launches from the terminal, writes review output to a file, then exits. No servers or persistent state.
### #packaging
- Open [**Re-exec with headless Ozone for windowless subcommands**](practice-re-exec-with-headless-ozone-for-windowless-subcommands.md) — Packaged fuses disable RunAsNode, so ELECTRON_RUN_AS_NODE cannot make a subcommand headless; cli-dispatch re-execs.
- Open [**Upload release ZIPs using the MakerZIP filenames**](../../engineering/practice-upload-release-zips-using-the-makerzip-filenames.md) — Upload MakerZIP archives directly by glob without renaming them.
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](../../engineering/practice-use-asar-unpack-not-asarunpack-in-forge-config.md) — Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither.
### #review-xml
- Open [**Convert git diff args only through format/tokenize**](practice-convert-git-diff-args-only-through-format-and-tokenize.md) — formatGitDiffArgs and tokenizeGitDiffArgs are the sanctioned argv-to-string conversion in both directions.
### #round-trip
- Open [**Convert git diff args only through format/tokenize**](practice-convert-git-diff-args-only-through-format-and-tokenize.md) — formatGitDiffArgs and tokenizeGitDiffArgs are the sanctioned argv-to-string conversion in both directions.
### #staged
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #startup
- Open [**Show welcome screen when launched outside a git repo with no directory arg**](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md) — Don't error-exit when launched from Finder or an app launcher; show the welcome screen with a directory picker instead.
### #strikethroo
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../../planning/authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #untracked
- Open [**Hide untracked files by default for --staged/--cached reviews**](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md) — Index-vs-HEAD reviews hide untracked files by default since they aren't part of the index; users can reveal them via toolbar toggle.
### #workflow
- Open [**PRE_PLAN hook**](../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**Knowledge-base capture and curation workflow**](../../knowledge-base/curate/map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.