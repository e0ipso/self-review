---
schema_version: 3
nodes_hash: 'sha256:b8c499c5d457ed287cfb850a9d8091bcc6d4d6b750adb0b9f355174e5df05fdb'
node_count: 203
---
# kenkeep Graph

Total nodes: 203

## map-ai-knowledge-base-cli

- **kind:** map
- **title:** Kenkeep CLI
- **path:** knowledge-base/tooling/map-ai-knowledge-base-cli.md
- **tags:** knowledge-base, cli
- **relates_to:** map-cli-static-skip-list, map-kb-detect-harness-helper-script, map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs, practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call, map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md, .agents/skills/kk-curate/SKILL.md

## map-ai-knowledge-base-directory

- **kind:** map
- **title:** .ai/kenkeep directory
- **path:** knowledge-base/structure/map-ai-knowledge-base-directory.md
- **tags:** knowledge-base, structure
- **relates_to:** map-knowledge-base-config-locations, map-knowledge-base-directory-layout-under-ai-knowledge-base, map-knowledge-base-node-kinds-and-frontmatter, map-knowledge-base-node-layout, practice-do-not-hand-edit-index-md-or-graph-md, practice-don-t-hallucinate-rationale-in-node-bodies, practice-refresh-index-md-and-graph-md-after-writing-nodes, practice-review-knowledge-base-changes-via-git-diff-before-committing, practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo, practice-split-combined-content-across-practice-and-map-nodes, map-ai-knowledge-base-cli
- **derived_from:** .agents/skills/kk-curate/SKILL.md, .ai/kenkeep/scripts/kk-detect-root.mjs

## map-cli-static-skip-list

- **kind:** map
- **title:** Bootstrap document exclusions
- **path:** knowledge-base/tooling/map-cli-static-skip-list.md
- **tags:** knowledge-base, cli, skip-list
- **relates_to:** map-ai-knowledge-base-cli
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## map-cli-static-skip-list-for-bootstrap-candidates

- **kind:** map
- **title:** Bootstrap document exclusions
- **path:** knowledge-base/bootstrap/discovery/map-cli-static-skip-list-for-bootstrap-candidates.md
- **tags:** knowledge-base, cli, skip-list, bootstrap
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## map-comment-author-attribution

- **kind:** map
- **title:** Comment author attribution
- **path:** review-xml/comments/map-comment-author-attribution.md
- **tags:** strikethroo, comments, author
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** AGENTS.md

## map-css-build-pipeline-for-self-review-react

- **kind:** map
- **title:** CSS build pipeline for @self-review/react
- **path:** packages/styling/map-css-build-pipeline-for-self-review-react.md
- **tags:** css, build, tailwind
- **relates_to:** map-self-review-wrapper-div, practice-import-only-the-compiled-dist-styles-css-from-host-apps
- **derived_from:** packages/react/AGENTS.md

## map-curator-failure-modes-add-collision-and-modify-missing-target

- **kind:** map
- **title:** Curator persistence results
- **path:** knowledge-base/curate/map-curator-failure-modes-add-collision-and-modify-missing-target.md
- **tags:** kk-curate, failures, reasons
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## map-default-bootstrap-scope

- **kind:** map
- **title:** Default bootstrap scope
- **path:** knowledge-base/bootstrap/discovery/map-default-bootstrap-scope.md
- **tags:** knowledge-base, scope
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## map-default-critique-categories

- **kind:** map
- **title:** Default critique categories
- **path:** skills/critique/configuration/map-default-critique-categories.md
- **tags:** self-review, categories, critique
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate

- **kind:** map
- **title:** Kenkeep curation commands
- **path:** knowledge-base/curate/map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate.md
- **tags:** kk-curate, cli, subcommands
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## map-emoji-shortcode-support-in-comments

- **kind:** map
- **title:** Emoji shortcode support in comments
- **path:** app/ui/interactions/map-emoji-shortcode-support-in-comments.md
- **tags:** strikethroo, emoji, comments
- **relates_to:** map-self-review-react-package
- **derived_from:** AGENTS.md

## map-extract-task-skills-cjs

- **kind:** map
- **title:** Task skill extraction in PRE_TASK_ASSIGNMENT
- **path:** planning/assignment/map-extract-task-skills-cjs.md
- **tags:** scripts, strikethroo, skills
- **relates_to:** map-pre-task-assignment-hook
- **derived_from:** .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md

## map-finish-review-vs-window-close-behavior

- **kind:** map
- **title:** Finish Review vs window-close behavior
- **path:** app/ui/lifecycle/map-finish-review-vs-window-close-behavior.md
- **tags:** strikethroo, close-behavior, save
- **relates_to:** practice-differentiate-finish-review-from-window-close
- **derived_from:** AGENTS.md

## map-ipc-channel-contract-between-main-and-renderer

- **kind:** map
- **title:** IPC channel contract between main and renderer
- **path:** app/architecture/map-ipc-channel-contract-between-main-and-renderer.md
- **tags:** ipc, channels
- **relates_to:** map-two-process-electron-architecture
- **derived_from:** docs/PRD.md

## map-ipc-channel-registry

- **kind:** map
- **title:** IPC channel registry
- **path:** app/architecture/map-ipc-channel-registry.md
- **tags:** strikethroo, ipc, channels
- **relates_to:** map-two-process-electron-architecture, practice-never-import-electron-directly-in-the-renderer
- **derived_from:** AGENTS.md

## map-kb-bootstrap-skill

- **kind:** map
- **title:** kk-bootstrap skill
- **path:** knowledge-base/bootstrap/workflow/map-kb-bootstrap-skill.md
- **tags:** knowledge-base, skills
- **relates_to:** practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from, practice-default-node-confidence-to-medium-during-bootstrap, practice-never-auto-resolve-contradictions-during-bootstrap, practice-never-overwrite-an-existing-node-during-bootstrap, map-cli-static-skip-list-for-bootstrap-candidates, map-default-bootstrap-scope, practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run, practice-read-entry-points-first-then-sample-and-follow-cross-references, practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap, practice-conclude-bootstrap-with-a-structured-final-report, practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents, practice-run-kb-bootstrap-as-a-one-pass-supervised-operation, practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track, map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## map-kb-detect-harness-helper-script

- **kind:** map
- **title:** Kenkeep harness detector
- **path:** knowledge-base/tooling/map-kb-detect-harness-helper-script.md
- **tags:** knowledge-base, harness, detection
- **relates_to:** map-ai-knowledge-base-cli
- **derived_from:** .ai/kenkeep/scripts/kk-detect-harness.mjs

## map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs

- **kind:** map
- **title:** Kenkeep harness detector
- **path:** knowledge-base/tooling/map-kb-harness-detection-script-at-tmp-kb-detect-harness-mjs.md
- **tags:** kb, harness, detection
- **relates_to:** map-ai-knowledge-base-cli
- **derived_from:** .ai/kenkeep/scripts/kk-detect-harness.mjs

## map-knowledge-base-capture-curate-review-workflow

- **kind:** map
- **title:** Knowledge-base capture and curation workflow
- **path:** knowledge-base/curate/map-knowledge-base-capture-curate-review-workflow.md
- **tags:** knowledge-base, workflow, skills
- **relates_to:** map-curator-failure-modes-add-collision-and-modify-missing-target, map-e0ipso-ai-knowledge-base-cli-commands-used-by-kb-curate, practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts, practice-apply-curator-conflict-outcomes-via-targeted-git-commands, practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence, practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild, practice-run-kb-curator-via-npx-with-explicit-harness-id, practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures, practice-sort-and-group-pending-conflicts-before-resolving, map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## map-knowledge-base-config-locations

- **kind:** map
- **title:** Knowledge base configuration
- **path:** knowledge-base/structure/map-knowledge-base-config-locations.md
- **tags:** knowledge-base, config
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md, .ai/kenkeep/config.yaml

## map-knowledge-base-directory-layout-under-ai-knowledge-base

- **kind:** map
- **title:** Kenkeep directory layout
- **path:** knowledge-base/structure/map-knowledge-base-directory-layout-under-ai-knowledge-base.md
- **tags:** kb, layout, paths
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-curate/SKILL.md, .ai/kenkeep/scripts/kk-detect-root.mjs

## map-knowledge-base-node-kinds-and-frontmatter

- **kind:** map
- **title:** Knowledge node kinds and frontmatter
- **path:** knowledge-base/structure/map-knowledge-base-node-kinds-and-frontmatter.md
- **tags:** knowledge-base, nodes, schema
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## map-knowledge-base-node-layout

- **kind:** map
- **title:** Knowledge node placement
- **path:** knowledge-base/structure/map-knowledge-base-node-layout.md
- **tags:** knowledge-base, layout, nodes
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## map-large-payload-lazy-loading-mode

- **kind:** map
- **title:** Large-payload lazy-loading mode
- **path:** app/architecture/map-large-payload-lazy-loading-mode.md
- **tags:** strikethroo, large-payload, perf
- **relates_to:** map-two-process-electron-architecture, practice-lazy-load-file-hunks-in-large-payload-mode
- **derived_from:** AGENTS.md

## map-npm-workspaces-packages

- **kind:** map
- **title:** npm workspaces packages
- **path:** packages/architecture/map-npm-workspaces-packages.md
- **tags:** strikethroo, packages, workspace
- **relates_to:** map-self-review-react-package, map-self-review-types-package, practice-do-not-import-from-self-review-core-in-the-react-package
- **derived_from:** AGENTS.md

## map-post-phase-hook

- **kind:** map
- **title:** POST_PHASE hook
- **path:** planning/execution/map-post-phase-hook.md
- **tags:** hooks, workflow, strikethroo
- **relates_to:** practice-follow-the-allowed-task-status-transitions, practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing, practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase
- **derived_from:** .ai/strikethroo/config/hooks/POST_PHASE.md

## map-post-plan-hook

- **kind:** map
- **title:** POST_PLAN hook
- **path:** planning/authoring/map-post-plan-hook.md
- **tags:** hooks, strikethroo, planning
- **relates_to:** map-pre-plan-hook
- **derived_from:** .ai/strikethroo/config/hooks/POST_PLAN.md

## map-post-task-generation-all-hook

- **kind:** map
- **title:** POST_TASK_GENERATION_ALL hook
- **path:** planning/task-generation/map-post-task-generation-all-hook.md
- **tags:** strikethroo, hooks, lifecycle
- **relates_to:** practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan, practice-review-every-generated-task-for-complexity-vagueness-and-triviality
- **derived_from:** .ai/strikethroo/config/hooks/POST_TASK_GENERATION_ALL.md

## map-pre-plan-hook

- **kind:** map
- **title:** PRE_PLAN hook
- **path:** planning/authoring/map-pre-plan-hook.md
- **tags:** strikethroo, hooks, workflow
- **relates_to:** map-post-plan-hook, practice-check-plans-for-architecture-and-code-reuse-improvements, practice-review-plans-against-prd-and-test-features-updates, practice-write-prds-without-tasks-or-phases-during-plan-creation
- **derived_from:** .ai/strikethroo/config/hooks/PRE_PLAN.md

## map-pre-task-assignment-hook

- **kind:** map
- **title:** PRE_TASK_ASSIGNMENT hook
- **path:** planning/assignment/map-pre-task-assignment-hook.md
- **tags:** hooks, strikethroo, ai
- **relates_to:** map-extract-task-skills-cjs, practice-detect-sub-agents-across-claude-gemini-and-opencode-directories, practice-engage-relevant-assistant-skills-based-on-task-skills, practice-match-task-skills-to-sub-agents-during-pre-task-assignment
- **derived_from:** .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md

## map-rendered-file-previews

- **kind:** map
- **title:** Rendered file previews
- **path:** app/ui/previews/map-rendered-file-previews.md
- **tags:** strikethroo, rendered-preview, file-types
- **relates_to:** map-rendered-image-and-svg-previews-for-added-files, map-rendered-text-view-for-added-markdown-and-html-files, practice-force-unified-view-for-added-and-deleted-files, practice-use-prism-js-for-syntax-highlighting-with-theme-matching
- **derived_from:** AGENTS.md

## map-rendered-image-and-svg-previews-for-added-files

- **kind:** map
- **title:** Rendered image and SVG previews for added files
- **path:** app/ui/previews/map-rendered-image-and-svg-previews-for-added-files.md
- **tags:** preview, image, svg
- **relates_to:** map-rendered-file-previews
- **derived_from:** docs/PRD.md

## map-rendered-text-view-for-added-markdown-and-html-files

- **kind:** map
- **title:** Rendered text view for added Markdown and HTML files
- **path:** app/ui/previews/map-rendered-text-view-for-added-markdown-and-html-files.md
- **tags:** preview, markdown, html, rendered
- **relates_to:** map-rendered-file-previews
- **derived_from:** docs/PRD.md

## map-resume-from-for-continuing-a-prior-review

- **kind:** map
- **title:** --resume-from for continuing a prior review
- **path:** app/cli/map-resume-from-for-continuing-a-prior-review.md
- **tags:** resume, cli
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** docs/PRD.md

## map-review-xml-format-and-xsd

- **kind:** map
- **title:** review.xml format and XSD
- **path:** review-xml/schema/map-review-xml-format-and-xsd.md
- **tags:** self-review, schema, xml
- **relates_to:** map-comment-author-attribution, practice-preserve-review-body-whitespace-during-xml-parsing, practice-require-a-category-on-every-comment, practice-use-the-new-path-for-renamed-files-in-review-xml, practice-xml-escape-all-text-content-in-review-xml, practice-line-comments-reference-either-old-or-new-line-numbers-never-both, practice-pair-comment-line-numbers-as-either-new-or-old-never-both, practice-pair-line-number-attributes-correctly-in-review-comments, practice-pair-line-number-attributes-correctly-on-review-comments, practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type, map-self-review-v1-xsd-output-format, map-self-review-xml-schema-self-review-v1-xsd, map-self-review-xml-v1-schema, map-xsd-schema-location, practice-design-xml-output-to-be-parsed-by-llms, practice-emit-no-wrapper-elements-in-the-xml-output, practice-keep-the-xsd-schema-in-sync-across-its-two-locations, practice-validate-xml-output-against-the-xsd-before-writing
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## map-reviewadapter-interface

- **kind:** map
- **title:** ReviewAdapter interface
- **path:** packages/architecture/map-reviewadapter-interface.md
- **tags:** interface, adapter, platform
- **relates_to:** map-self-review-react-package, practice-use-the-reviewadapter-pattern-for-platform-specific-operations
- **derived_from:** packages/react/AGENTS.md

## map-reviewpanel-and-singlefilereview-entry-components

- **kind:** map
- **title:** ReviewPanel and SingleFileReview entry components
- **path:** packages/architecture/map-reviewpanel-and-singlefilereview-entry-components.md
- **tags:** component, entrypoint
- **relates_to:** map-self-review-react-package
- **derived_from:** packages/react/AGENTS.md

## map-self-review

- **kind:** map
- **title:** self-review
- **path:** app/map-self-review.md
- **tags:** strikethroo, app, overview
- **relates_to:** map-self-review-application, practice-keep-self-review-local-only-with-no-network-access, practice-limit-file-writes-to-the-review-xml-and-assets-directory, practice-make-no-network-connections-at-runtime, practice-make-zero-network-requests-except-the-startup-version-check, map-testing-layers-unit-e2e, practice-do-not-install-or-use-webpack, practice-run-the-webapp-e2e-project-in-the-dev-container, practice-don-t-support-windows, practice-exclude-generated-assistant-tooling-from-eslint, practice-extract-shared-logic-before-duplicating-across-call-sites, practice-favor-simple-maintainable-solutions-over-clever-ones, practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production, practice-implement-only-what-the-user-explicitly-requests, practice-lead-each-platform-installation-section-with-homebrew, practice-upload-release-zips-using-the-makerzip-filenames, practice-use-conventional-commit-naming-for-pr-titles
- **derived_from:** AGENTS.md

## map-self-review-application

- **kind:** map
- **title:** self-review application
- **path:** app/map-self-review-application.md
- **tags:** overview, app
- **relates_to:** map-self-review
- **derived_from:** docs/PRD.md

## map-self-review-apply-assistant-skill

- **kind:** map
- **title:** self-review-apply assistant skill
- **path:** skills/apply/map-self-review-apply-assistant-skill.md
- **tags:** skills, ai, workflow
- **relates_to:** map-self-review-apply-skill
- **derived_from:** README.md, .agents/skills/self-review-apply/SKILL.md

## map-self-review-apply-skill

- **kind:** map
- **title:** self-review-apply skill
- **path:** skills/apply/map-self-review-apply-skill.md
- **tags:** self-review, skills, apply
- **relates_to:** map-self-review-apply-assistant-skill, practice-apply-review-suggestions-bottom-to-top-by-line-number, practice-convert-v2-gate-reviews-to-v3-before-applying, practice-load-the-original-diff-context-before-applying-review-feedback, practice-parallelize-self-review-application-per-file-above-a-3-file-threshold, practice-treat-every-review-comment-as-actionable-including-questions, practice-validate-self-review-xml-against-the-xsd-before-applying, map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md, .agents/skills/self-review-apply/SKILL.md

## map-self-review-cli-invocations

- **kind:** map
- **title:** self-review CLI invocations
- **path:** app/cli/map-self-review-cli-invocations.md
- **tags:** cli, flags
- **relates_to:** map-resume-from-for-continuing-a-prior-review, map-three-startup-modes-git-directory-welcome, practice-hide-untracked-files-by-default-for-staged-cached-reviews, practice-never-write-to-stdout-in-the-main-process, practice-never-write-to-stdout-use-stderr-for-all-logging, practice-preserve-orphaned-comments-on-resume-never-silently-drop-them, practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg, practice-treat-self-review-as-a-cli-first-one-shot-tool
- **derived_from:** README.md, AGENTS.md

## map-self-review-critique-skill

- **kind:** map
- **title:** self-review-critique skill
- **path:** skills/critique/configuration/map-self-review-critique-skill.md
- **tags:** self-review, skills, critique
- **relates_to:** map-default-critique-categories, practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed, practice-read-categories-from-self-review-yaml-before-generating-critique, practice-use-categories-from-self-review-yaml-when-present, practice-set-author-to-your-model-name-on-every-generated-comment, practice-set-the-comment-author-attribute-to-the-model-name, practice-set-viewed-true-on-every-file-in-ai-generated-review-xml, practice-set-viewed-true-on-every-file-in-critique-output, practice-validate-generated-review-xml-against-the-xsd-before-finishing, practice-validate-generated-review-xml-against-the-xsd-with-xmllint, practice-prioritize-the-largest-diffs-when-reviewing-many-files, practice-read-full-file-contents-for-added-modified-files-when-critiquing, practice-skip-files-that-look-correct-do-not-force-comments-on-every-file, practice-skip-files-that-look-correct-rather-than-forcing-comments, practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible, practice-copy-original-code-verbatim-from-the-source-file, practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed, map-self-review-apply-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## map-self-review-react-package

- **kind:** map
- **title:** @self-review/react package
- **path:** packages/architecture/map-self-review-react-package.md
- **tags:** packages, react, ui
- **relates_to:** map-emoji-shortcode-support-in-comments, map-vimium-style-keyboard-navigation, map-vimium-style-keyboard-shortcuts, practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side, practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code, practice-use-shadcn-ui-components-instead-of-raw-html-for-ui, map-npm-workspaces-packages, map-reviewadapter-interface, map-reviewpanel-and-singlefilereview-entry-components, practice-do-not-import-from-self-review-core-in-the-react-package, practice-do-not-use-node-js-apis-in-self-review-react, practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages, practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react, practice-keep-review-comment-mutations-immutable, practice-use-the-reviewadapter-pattern-for-platform-specific-operations
- **derived_from:** packages/react/AGENTS.md

## map-self-review-types-package

- **kind:** map
- **title:** @self-review/types package
- **path:** packages/types/map-self-review-types-package.md
- **tags:** packages, types, workspace
- **relates_to:** practice-define-shared-data-structures-only-in-self-review-types, practice-do-not-import-sibling-packages-from-self-review-types, practice-keep-all-self-review-types-definitions-in-src-index-ts, practice-keep-self-review-types-free-of-runtime-dependencies, map-npm-workspaces-packages
- **derived_from:** packages/types/AGENTS.md

## map-self-review-v1-xsd-output-format

- **kind:** map
- **title:** self-review-v3 XSD output format
- **path:** review-xml/schema/map-self-review-v1-xsd-output-format.md
- **tags:** xml, schema, output
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** docs/PRD.md

## map-self-review-wrapper-div

- **kind:** map
- **title:** .self-review wrapper div
- **path:** packages/styling/map-self-review-wrapper-div.md
- **tags:** dom, scoping, theming
- **relates_to:** map-css-build-pipeline-for-self-review-react, practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps, practice-import-only-the-compiled-dist-styles-css-from-host-apps, practice-pass-portalcontainer-to-all-radix-shadcn-portal-components, practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div
- **derived_from:** packages/react/AGENTS.md

## map-self-review-xml-schema-self-review-v1-xsd

- **kind:** map
- **title:** self-review XML schema (self-review-v3.xsd)
- **path:** review-xml/schema/map-self-review-xml-schema-self-review-v1-xsd.md
- **tags:** self-review, xsd, schema
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .opencode/skills/self-review-apply/SKILL.md, .agents/skills/self-review-apply/SKILL.md

## map-self-review-xml-v1-schema

- **kind:** map
- **title:** self-review XML v3 schema
- **path:** review-xml/schema/map-self-review-xml-v1-schema.md
- **tags:** self-review, xml, schema
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md, .agents/skills/self-review-critique/SKILL.md

## map-self-review-yaml-configuration-options

- **kind:** map
- **title:** self-review YAML configuration options
- **path:** app/config/map-self-review-yaml-configuration-options.md
- **tags:** config, yaml
- **relates_to:** map-user-and-project-yaml-configuration
- **derived_from:** README.md

## map-self-review-yaml-project-config

- **kind:** map
- **title:** .self-review.yaml project config
- **path:** app/config/map-self-review-yaml-project-config.md
- **tags:** self-review, config
- **relates_to:** map-user-and-project-yaml-configuration
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## map-suggestion-apply-write-boundary

- **kind:** map
- **title:** Suggestion-apply write boundary
- **path:** app/map-suggestion-apply-write-boundary.md
- **tags:** core, apply-suggestion, file-writes, remote-mode
- **relates_to:** practice-limit-file-writes-to-the-review-xml-and-assets-directory, practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r

## map-testing-layers-unit-e2e

- **kind:** map
- **title:** Testing layers (unit + e2e)
- **path:** engineering/map-testing-layers-unit-e2e.md
- **tags:** strikethroo, testing, layers
- **relates_to:** map-self-review
- **derived_from:** AGENTS.md

## map-three-startup-modes-git-directory-welcome

- **kind:** map
- **title:** Three startup modes: git, directory, welcome
- **path:** app/cli/map-three-startup-modes-git-directory-welcome.md
- **tags:** mode, git, directory, welcome
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** docs/PRD.md

## map-two-process-electron-architecture

- **kind:** map
- **title:** Two-process Electron architecture
- **path:** app/architecture/map-two-process-electron-architecture.md
- **tags:** strikethroo, architecture, electron
- **relates_to:** map-ipc-channel-contract-between-main-and-renderer, map-ipc-channel-registry, map-large-payload-lazy-loading-mode, practice-do-not-store-renderer-state-outside-react-context, practice-lazy-load-file-hunks-in-large-payload-mode, practice-never-import-electron-directly-in-the-renderer, practice-trigger-large-payload-guard-at-configurable-file-line-thresholds, practice-use-es-module-imports-in-the-renderer-not-require, practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types
- **derived_from:** AGENTS.md

## map-type-check-programs-and-scripts

- **kind:** map
- **title:** Seven tsc programs behind five typecheck npm scripts
- **path:** engineering/map-type-check-programs-and-scripts.md
- **tags:** typescript, tsconfig, typecheck, ci, build
- **relates_to:** practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config

## map-user-and-project-yaml-configuration

- **kind:** map
- **title:** User and project YAML configuration
- **path:** app/config/map-user-and-project-yaml-configuration.md
- **tags:** config, yaml, files
- **relates_to:** map-self-review-yaml-configuration-options, map-self-review-yaml-project-config, practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults, practice-apply-config-precedence-project-overrides-user-overrides-defaults
- **derived_from:** docs/PRD.md

## map-vimium-style-keyboard-navigation

- **kind:** map
- **title:** Vimium-style keyboard navigation
- **path:** app/ui/interactions/map-vimium-style-keyboard-navigation.md
- **tags:** keyboard, navigation, vimium
- **relates_to:** map-self-review-react-package
- **derived_from:** docs/PRD.md

## map-vimium-style-keyboard-shortcuts

- **kind:** map
- **title:** Vimium-style keyboard shortcuts
- **path:** app/ui/interactions/map-vimium-style-keyboard-shortcuts.md
- **tags:** strikethroo, keyboard, vimium
- **relates_to:** map-self-review-react-package
- **derived_from:** AGENTS.md

## map-xsd-schema-location

- **kind:** map
- **title:** XSD schema location
- **path:** review-xml/schema/map-xsd-schema-location.md
- **tags:** self-review, xsd, schema
- **relates_to:** practice-keep-the-xsd-schema-in-sync-across-its-two-locations, map-review-xml-format-and-xsd
- **derived_from:** AGENTS.md

## practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts

- **kind:** practice
- **title:** Accept only y/n/s/k tokens when resolving curator conflicts
- **path:** knowledge-base/curate/practice-accept-only-y-n-s-k-tokens-when-resolving-curator-conflicts.md
- **tags:** kk-curate, conflicts, reply-contract
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan

- **kind:** practice
- **title:** Append a blueprint with dependency diagram and execution phases to the plan
- **path:** planning/task-generation/practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md
- **tags:** strikethroo, blueprint, dependencies
- **relates_to:** map-post-task-generation-all-hook
- **derived_from:** .ai/strikethroo/config/hooks/POST_TASK_GENERATION_ALL.md

## practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults

- **kind:** practice
- **title:** Apply config precedence: CLI > project YAML > user YAML > defaults
- **path:** app/config/practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md
- **tags:** config, precedence
- **relates_to:** map-user-and-project-yaml-configuration
- **derived_from:** docs/PRD.md

## practice-apply-config-precedence-project-overrides-user-overrides-defaults

- **kind:** practice
- **title:** Apply config precedence: project overrides user overrides defaults
- **path:** app/config/practice-apply-config-precedence-project-overrides-user-overrides-defaults.md
- **tags:** config, precedence
- **relates_to:** map-user-and-project-yaml-configuration
- **derived_from:** README.md

## practice-apply-curator-conflict-outcomes-via-targeted-git-commands

- **kind:** practice
- **title:** Apply curator conflicts using the selected reply
- **path:** knowledge-base/curate/practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md
- **tags:** kk-curate, outcomes, git
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## practice-apply-review-suggestions-bottom-to-top-by-line-number

- **kind:** practice
- **title:** Apply review suggestions bottom-to-top by line number
- **path:** skills/apply/practice-apply-review-suggestions-bottom-to-top-by-line-number.md
- **tags:** self-review, suggestions, ordering
- **relates_to:** map-self-review-apply-skill
- **derived_from:** .opencode/skills/self-review-apply/SKILL.md

## practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible

- **kind:** practice
- **title:** Attach a suggestion block whenever a concrete fix is possible
- **path:** skills/critique/suggestions/practice-attach-a-suggestion-block-whenever-a-concrete-fix-is-possible.md
- **tags:** self-review, critique, suggestions
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md

## practice-check-each-package-with-its-own-tsconfig

- **kind:** practice
- **title:** Check each package with its own tsconfig; the root program only follows imports
- **path:** engineering/practice-check-each-package-with-its-own-tsconfig.md
- **tags:** typescript, tsconfig, typecheck, packages, ci
- **relates_to:** map-type-check-programs-and-scripts, map-npm-workspaces-packages

## practice-check-plans-for-architecture-and-code-reuse-improvements

- **kind:** practice
- **title:** Keep architecture decisions within the requested plan scope
- **path:** planning/authoring/practice-check-plans-for-architecture-and-code-reuse-improvements.md
- **tags:** planning, architecture, code-reuse
- **relates_to:** map-pre-plan-hook
- **derived_from:** .ai/strikethroo/config/hooks/POST_PLAN.md, .ai/strikethroo/config/hooks/PRE_PLAN.md

## practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side

- **kind:** practice
- **title:** Clamp multi-line drag-selection to a single hunk and a single side
- **path:** app/ui/interactions/practice-clamp-multi-line-drag-selection-to-a-single-hunk-and-a-single-side.md
- **tags:** drag-select, hunks, split-view
- **relates_to:** map-self-review-react-package
- **derived_from:** docs/PRD.md

## practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence

- **kind:** practice
- **title:** Compute conflict-resolution defaults from diff ratio and confidence
- **path:** knowledge-base/curate/practice-compute-conflict-resolution-defaults-from-diff-ratio-and-confidence.md
- **tags:** kk-curate, conflicts, defaults
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## practice-conclude-bootstrap-with-a-structured-final-report

- **kind:** practice
- **title:** Report bootstrap writes and omissions
- **path:** knowledge-base/bootstrap/workflow/practice-conclude-bootstrap-with-a-structured-final-report.md
- **tags:** knowledge-base, reporting
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from

- **kind:** practice
- **title:** Consolidate overlapping bootstrap candidates
- **path:** knowledge-base/bootstrap/admission/practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from.md
- **tags:** knowledge-base, deduplication
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-convert-git-diff-args-only-through-format-and-tokenize

- **kind:** practice
- **title:** Convert git diff args only through format/tokenize
- **path:** app/cli/practice-convert-git-diff-args-only-through-format-and-tokenize.md
- **tags:** cli, git, review-xml, round-trip
- **relates_to:** map-review-xml-format-and-xsd, map-self-review-cli-invocations

## practice-convert-v2-gate-reviews-to-v3-before-applying

- **kind:** practice
- **title:** Convert v2 gate reviews to v3 before applying
- **path:** skills/apply/practice-convert-v2-gate-reviews-to-v3-before-applying.md
- **tags:** self-review, xml, compatibility, workflow
- **relates_to:** map-self-review-apply-skill, map-review-xml-format-and-xsd
- **derived_from:** .ai/kenkeep/_sessions/20260731-2121-77699372-867d-4d60-9007-5aa0b672863d.md

## practice-copy-original-code-verbatim-from-the-source-file

- **kind:** practice
- **title:** Copy original-code verbatim from the source file
- **path:** skills/critique/suggestions/practice-copy-original-code-verbatim-from-the-source-file.md
- **tags:** self-review, suggestions, xml
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed

- **kind:** practice
- **title:** Default critique to unstaged changes when no diff args are passed
- **path:** skills/critique/configuration/practice-default-critique-to-unstaged-changes-when-no-diff-args-are-passed.md
- **tags:** self-review, critique, cli
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-default-node-confidence-to-medium-during-bootstrap

- **kind:** practice
- **title:** Default node confidence to medium during bootstrap
- **path:** knowledge-base/bootstrap/admission/practice-default-node-confidence-to-medium-during-bootstrap.md
- **tags:** knowledge-base, confidence
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run

- **kind:** practice
- **title:** Discover bootstrap documents through finddocs
- **path:** knowledge-base/bootstrap/discovery/practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md
- **tags:** knowledge-base, cli, discovery
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-define-shared-data-structures-only-in-self-review-types

- **kind:** practice
- **title:** Define shared data structures only in @self-review/types
- **path:** packages/types/practice-define-shared-data-structures-only-in-self-review-types.md
- **tags:** types, single-source, shared
- **relates_to:** map-self-review-types-package
- **derived_from:** packages/types/AGENTS.md

## practice-design-xml-output-to-be-parsed-by-llms

- **kind:** practice
- **title:** Design XML output to be parsed by LLMs
- **path:** review-xml/schema/practice-design-xml-output-to-be-parsed-by-llms.md
- **tags:** output, xml, ai
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** README.md

## practice-detect-sub-agents-across-claude-gemini-and-opencode-directories

- **kind:** practice
- **title:** Discover agents through the active harness
- **path:** planning/assignment/practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md
- **tags:** agents, discovery, conventions
- **relates_to:** map-pre-task-assignment-hook
- **derived_from:** .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md

## practice-differentiate-finish-review-from-window-close

- **kind:** practice
- **title:** Differentiate Finish Review from window close
- **path:** app/ui/lifecycle/practice-differentiate-finish-review-from-window-close.md
- **tags:** exit, save, ux
- **relates_to:** map-finish-review-vs-window-close-behavior
- **derived_from:** docs/PRD.md

## practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps

- **kind:** practice
- **title:** Do not add Tailwind as a peer dependency for host apps
- **path:** packages/styling/practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md
- **tags:** css, tailwind, dependencies
- **relates_to:** map-self-review-wrapper-div
- **derived_from:** packages/react/AGENTS.md

## practice-do-not-hand-edit-index-md-or-graph-md

- **kind:** practice
- **title:** Regenerate kenkeep navigation after node changes
- **path:** knowledge-base/structure/practice-do-not-hand-edit-index-md-or-graph-md.md
- **tags:** knowledge-base, index, hooks
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-curate/SKILL.md, .lintstagedrc

## practice-do-not-import-from-self-review-core-in-the-react-package

- **kind:** practice
- **title:** Do not import from @self-review/core in the react package
- **path:** packages/architecture/practice-do-not-import-from-self-review-core-in-the-react-package.md
- **tags:** react, imports, bundling
- **relates_to:** map-self-review-react-package, map-npm-workspaces-packages
- **derived_from:** packages/react/AGENTS.md

## practice-do-not-import-sibling-packages-from-self-review-types

- **kind:** practice
- **title:** Do not import sibling packages from @self-review/types
- **path:** packages/types/practice-do-not-import-sibling-packages-from-self-review-types.md
- **tags:** types, imports, architecture
- **relates_to:** map-self-review-types-package
- **derived_from:** packages/types/AGENTS.md

## practice-do-not-install-or-use-webpack

- **kind:** practice
- **title:** Check the existing Forge bundler before changing build tooling
- **path:** engineering/practice-do-not-install-or-use-webpack.md
- **tags:** strikethroo, build, webpack
- **relates_to:** map-self-review
- **derived_from:** AGENTS.md, forge.config.ts, webpack.main.config.ts

## practice-do-not-store-renderer-state-outside-react-context

- **kind:** practice
- **title:** Do not store renderer state outside React context
- **path:** app/architecture/practice-do-not-store-renderer-state-outside-react-context.md
- **tags:** strikethroo, state, renderer
- **relates_to:** map-two-process-electron-architecture
- **derived_from:** AGENTS.md

## practice-do-not-use-node-js-apis-in-self-review-react

- **kind:** practice
- **title:** Do not use Node.js APIs in @self-review/react
- **path:** packages/architecture/practice-do-not-use-node-js-apis-in-self-review-react.md
- **tags:** react, browser, constraints
- **relates_to:** map-self-review-react-package
- **derived_from:** packages/react/AGENTS.md

## practice-don-t-hallucinate-rationale-in-node-bodies

- **kind:** practice
- **title:** Don't hallucinate rationale in node bodies
- **path:** knowledge-base/structure/practice-don-t-hallucinate-rationale-in-node-bodies.md
- **tags:** knowledge-base, node-authoring, rationale
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-don-t-support-windows

- **kind:** practice
- **title:** Don't support Windows
- **path:** engineering/practice-don-t-support-windows.md
- **tags:** platform, scope
- **relates_to:** map-self-review
- **derived_from:** docs/PRD.md

## practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom

- **kind:** practice
- **title:** Drive resizable panels through the imperative handle in jsdom
- **path:** engineering/practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom.md
- **tags:** testing, jsdom, react, panels
- **relates_to:** practice-restore-collapsed-panels-inside-flushsync, map-testing-layers-unit-e2e

## practice-emit-no-wrapper-elements-in-the-xml-output

- **kind:** practice
- **title:** Emit no wrapper elements in the XML output
- **path:** review-xml/schema/practice-emit-no-wrapper-elements-in-the-xml-output.md
- **tags:** xml, schema
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** docs/PRD.md

## practice-encode-diff-header-paths-with-quotegitpath

- **kind:** practice
- **title:** Encode diff header paths with quoteGitPath
- **path:** packages/architecture/practice-encode-diff-header-paths-with-quotegitpath.md
- **tags:** git, diff, paths, encoding
- **relates_to:** practice-convert-git-diff-args-only-through-format-and-tokenize

## practice-engage-relevant-assistant-skills-based-on-task-skills

- **kind:** practice
- **title:** Engage relevant assistant skills based on task skills
- **path:** planning/assignment/practice-engage-relevant-assistant-skills-based-on-task-skills.md
- **tags:** task-assignment, skills, assistant-skills
- **relates_to:** map-pre-task-assignment-hook
- **derived_from:** .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md

## practice-exclude-generated-assistant-tooling-from-eslint

- **kind:** practice
- **title:** Exclude generated assistant tooling from ESLint
- **path:** engineering/practice-exclude-generated-assistant-tooling-from-eslint.md
- **tags:** lint, tooling
- **relates_to:** map-self-review
- **derived_from:** .ai/kenkeep/_sessions/20260605-1109-549df86a-a0e7-445e-b9f7-06a3caf757f4.md

## practice-extract-shared-logic-before-duplicating-across-call-sites

- **kind:** practice
- **title:** Extract shared logic before duplicating across call sites
- **path:** engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md
- **tags:** strikethroo, code-reuse, duplication
- **relates_to:** map-self-review
- **derived_from:** AGENTS.md

## practice-favor-simple-maintainable-solutions-over-clever-ones

- **kind:** practice
- **title:** Favor simple, maintainable solutions over clever ones
- **path:** engineering/practice-favor-simple-maintainable-solutions-over-clever-ones.md
- **tags:** simplicity, code-quality, maintainability
- **relates_to:** map-self-review
- **derived_from:** .ai/strikethroo/config/hooks/PRE_PLAN.md

## practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production

- **kind:** practice
- **title:** Fix the root cause in tests, never write test-specific code in production
- **path:** engineering/practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production.md
- **tags:** strikethroo, testing, root-cause
- **relates_to:** map-self-review
- **derived_from:** AGENTS.md

## practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config

- **kind:** practice
- **title:** Fix webpack type-checking in the root tsconfig.json, not in a webpack config
- **path:** engineering/practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md
- **tags:** build, webpack, typescript, tsconfig

## practice-follow-the-allowed-task-status-transitions

- **kind:** practice
- **title:** Follow the allowed task status transitions
- **path:** planning/execution/practice-follow-the-allowed-task-status-transitions.md
- **tags:** workflow, task-status
- **relates_to:** map-post-phase-hook
- **derived_from:** .ai/strikethroo/config/hooks/POST_PHASE.md

## practice-force-unified-view-for-added-and-deleted-files

- **kind:** practice
- **title:** Force unified view for added and deleted files
- **path:** app/ui/previews/practice-force-unified-view-for-added-and-deleted-files.md
- **tags:** ui, diff-view
- **relates_to:** map-rendered-file-previews
- **derived_from:** docs/PRD.md

## practice-formatting-is-enforced-by-lint-staged-and-ci

- **kind:** practice
- **title:** Formatting is enforced by lint-staged and CI
- **path:** engineering/practice-formatting-is-enforced-by-lint-staged-and-ci.md
- **tags:** formatting, prettier, husky, ci
- **relates_to:** practice-use-conventional-commit-naming-for-pr-titles

## practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild

- **kind:** practice
- **title:** Report curation results after rebuilding navigation
- **path:** knowledge-base/curate/practice-hand-off-curate-runs-via-git-diff-and-optional-pre-commit-index-rebuild.md
- **tags:** kk-curate, handoff, index
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md, .lintstagedrc

## practice-hide-untracked-files-by-default-for-staged-cached-reviews

- **kind:** practice
- **title:** Hide untracked files by default for --staged/--cached reviews
- **path:** app/cli/practice-hide-untracked-files-by-default-for-staged-cached-reviews.md
- **tags:** staged, untracked, defaults
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** docs/PRD.md

## practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents

- **kind:** practice
- **title:** Use documented configuration when drafting bootstrap nodes
- **path:** knowledge-base/bootstrap/workflow/practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md
- **tags:** knowledge-base, config, subagents
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md, .ai/kenkeep/.config/prompts/sub-agent-delegation.md

## practice-implement-only-what-the-user-explicitly-requests

- **kind:** practice
- **title:** Implement only what the user explicitly requests
- **path:** engineering/practice-implement-only-what-the-user-explicitly-requests.md
- **tags:** scope, planning, yagni
- **relates_to:** map-self-review
- **derived_from:** .ai/strikethroo/config/hooks/PRE_PLAN.md

## practice-import-only-the-compiled-dist-styles-css-from-host-apps

- **kind:** practice
- **title:** Import only the compiled dist/styles.css from host apps
- **path:** packages/styling/practice-import-only-the-compiled-dist-styles-css-from-host-apps.md
- **tags:** css, build, imports
- **relates_to:** map-self-review-wrapper-div, map-css-build-pipeline-for-self-review-react
- **derived_from:** packages/react/AGENTS.md

## practice-install-libgtk-3-0-never-libgtk-3-0t64

- **kind:** practice
- **title:** Install libgtk-3-0, never libgtk-3-0t64
- **path:** engineering/practice-install-libgtk-3-0-never-libgtk-3-0t64.md
- **tags:** apt, ubuntu, debian, devcontainer, ci, electron
- **relates_to:** practice-run-the-webapp-e2e-project-in-the-dev-container

## practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run

- **kind:** practice
- **title:** Install Playwright's Chromium and its system libraries before the first e2e run
- **path:** engineering/practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run.md
- **tags:** testing, e2e, playwright, devcontainer, setup
- **relates_to:** practice-run-the-webapp-e2e-project-in-the-dev-container, map-testing-layers-unit-e2e

## practice-keep-all-self-review-types-definitions-in-src-index-ts

- **kind:** practice
- **title:** Keep all @self-review/types definitions in src/index.ts
- **path:** packages/types/practice-keep-all-self-review-types-definitions-in-src-index-ts.md
- **tags:** types, structure, layout
- **relates_to:** map-self-review-types-package
- **derived_from:** packages/types/AGENTS.md

## practice-keep-extra-worktrees-out-of-the-repo-root

- **kind:** practice
- **title:** Keep extra worktrees out of the repo root
- **path:** engineering/practice-keep-extra-worktrees-out-of-the-repo-root.md
- **tags:** worktree, tooling, lint, node-modules
- **relates_to:** practice-formatting-is-enforced-by-lint-staged-and-ci

## practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages

- **kind:** practice
- **title:** Keep file-type detection utilities duplicated across core and react packages
- **path:** packages/architecture/practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md
- **tags:** strikethroo, file-type-utils, duplication
- **relates_to:** map-self-review-react-package
- **derived_from:** AGENTS.md

## practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react

- **kind:** practice
- **title:** Keep file-type-utils.ts duplicates in sync across core and react
- **path:** packages/architecture/practice-keep-file-type-utils-ts-duplicates-in-sync-across-core-and-react.md
- **tags:** duplication, sync, utils
- **relates_to:** map-self-review-react-package
- **derived_from:** packages/react/AGENTS.md

## practice-keep-review-comment-mutations-immutable

- **kind:** practice
- **title:** Keep review comment mutations immutable
- **path:** packages/architecture/practice-keep-review-comment-mutations-immutable.md
- **tags:** react, review-state, callbacks, immutability
- **relates_to:** map-reviewpanel-and-singlefilereview-entry-components, map-self-review-react-package
- **derived_from:** .ai/kenkeep/_sessions/20260731-2121-77699372-867d-4d60-9007-5aa0b672863d.md

## practice-keep-self-review-local-only-with-no-network-access

- **kind:** practice
- **title:** Keep self-review local-only with no network access
- **path:** app/practice-keep-self-review-local-only-with-no-network-access.md
- **tags:** privacy, network, local
- **relates_to:** map-self-review
- **derived_from:** README.md

## practice-keep-self-review-types-free-of-runtime-dependencies

- **kind:** practice
- **title:** Keep @self-review/types free of runtime dependencies
- **path:** packages/types/practice-keep-self-review-types-free-of-runtime-dependencies.md
- **tags:** types, dependencies, packages
- **relates_to:** map-self-review-types-package
- **derived_from:** packages/types/AGENTS.md

## practice-keep-the-xsd-schema-in-sync-across-its-two-locations

- **kind:** practice
- **title:** Keep the v3 XSD schema in sync across its two locations
- **path:** review-xml/schema/practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md
- **tags:** self-review, xsd, sync
- **relates_to:** map-xsd-schema-location, map-review-xml-format-and-xsd
- **derived_from:** AGENTS.md

## practice-keep-walkthrough-guide-paths-portable-across-checkouts

- **kind:** practice
- **title:** Keep walkthrough guide paths portable across checkouts
- **path:** skills/practice-keep-walkthrough-guide-paths-portable-across-checkouts.md
- **tags:** guide, portability
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .ai/kenkeep/_sessions/20260802-0720-d5931451-b5f2-4282-9393-74e0b3c56a16.md

## practice-lazy-load-file-hunks-in-large-payload-mode

- **kind:** practice
- **title:** Lazy-load file hunks in large-payload mode
- **path:** app/architecture/practice-lazy-load-file-hunks-in-large-payload-mode.md
- **tags:** large-diff, performance, payload
- **relates_to:** map-two-process-electron-architecture, map-large-payload-lazy-loading-mode
- **derived_from:** docs/PRD.md

## practice-lead-each-platform-installation-section-with-homebrew

- **kind:** practice
- **title:** Lead each platform installation section with Homebrew
- **path:** engineering/practice-lead-each-platform-installation-section-with-homebrew.md
- **tags:** installation, docs
- **relates_to:** map-self-review
- **derived_from:** .ai/kenkeep/_sessions/20260708-1437-9647da26-51b1-4b65-98ac-0909f4a05935.md

## practice-limit-file-writes-to-the-review-xml-and-assets-directory

- **kind:** practice
- **title:** Limit file writes to the review XML and assets directory
- **path:** app/practice-limit-file-writes-to-the-review-xml-and-assets-directory.md
- **tags:** strikethroo, filesystem, scope
- **relates_to:** map-self-review, map-suggestion-apply-write-boundary
- **derived_from:** AGENTS.md

## practice-line-comments-reference-either-old-or-new-line-numbers-never-both

- **kind:** practice
- **title:** Line comments reference either old or new line numbers, never both
- **path:** review-xml/line-anchors/practice-line-comments-reference-either-old-or-new-line-numbers-never-both.md
- **tags:** xml, comments, line-numbers
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** docs/PRD.md

## practice-load-the-original-diff-context-before-applying-review-feedback

- **kind:** practice
- **title:** Load the reviewed source before applying feedback
- **path:** skills/apply/practice-load-the-original-diff-context-before-applying-review-feedback.md
- **tags:** self-review, git-diff, context
- **relates_to:** map-self-review-apply-skill
- **derived_from:** .agents/skills/self-review-apply/SKILL.md

## practice-make-no-network-connections-at-runtime

- **kind:** practice
- **title:** Make no network connections at runtime
- **path:** app/practice-make-no-network-connections-at-runtime.md
- **tags:** network, privacy, local-only
- **relates_to:** map-self-review
- **derived_from:** docs/PRD.md

## practice-make-zero-network-requests-except-the-startup-version-check

- **kind:** practice
- **title:** Make zero network requests except the startup version check
- **path:** app/practice-make-zero-network-requests-except-the-startup-version-check.md
- **tags:** strikethroo, network, privacy
- **relates_to:** map-self-review
- **derived_from:** AGENTS.md

## practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing

- **kind:** practice
- **title:** Mark completed phases and tasks in the blueprint before advancing
- **path:** planning/execution/practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md
- **tags:** workflow, progress-tracking, blueprint
- **relates_to:** map-post-phase-hook
- **derived_from:** .ai/strikethroo/config/hooks/POST_PHASE.md

## practice-match-task-skills-to-sub-agents-during-pre-task-assignment

- **kind:** practice
- **title:** Match task skills to sub-agents during PRE_TASK_ASSIGNMENT
- **path:** planning/assignment/practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md
- **tags:** task-assignment, agents, hooks
- **relates_to:** map-pre-task-assignment-hook
- **derived_from:** .ai/strikethroo/config/hooks/PRE_TASK_ASSIGNMENT.md

## practice-never-auto-resolve-contradictions-during-bootstrap

- **kind:** practice
- **title:** Never auto-resolve contradictions during bootstrap
- **path:** knowledge-base/bootstrap/admission/practice-never-auto-resolve-contradictions-during-bootstrap.md
- **tags:** knowledge-base, contradictions
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-never-import-electron-directly-in-the-renderer

- **kind:** practice
- **title:** Never import electron directly in the renderer
- **path:** app/architecture/practice-never-import-electron-directly-in-the-renderer.md
- **tags:** strikethroo, ipc, security
- **relates_to:** map-two-process-electron-architecture, map-ipc-channel-registry
- **derived_from:** AGENTS.md

## practice-never-overwrite-an-existing-node-during-bootstrap

- **kind:** practice
- **title:** Do not duplicate or overwrite existing nodes during bootstrap
- **path:** knowledge-base/bootstrap/admission/practice-never-overwrite-an-existing-node-during-bootstrap.md
- **tags:** knowledge-base, node-authoring, collision
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-never-write-to-stdout-in-the-main-process

- **kind:** practice
- **title:** Never write to stdout in the main process
- **path:** app/cli/practice-never-write-to-stdout-in-the-main-process.md
- **tags:** strikethroo, logging, stdout
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** AGENTS.md

## practice-never-write-to-stdout-use-stderr-for-all-logging

- **kind:** practice
- **title:** Never write to stdout; use stderr for all logging
- **path:** app/cli/practice-never-write-to-stdout-use-stderr-for-all-logging.md
- **tags:** logging, stdout, cli
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** docs/PRD.md

## practice-pair-comment-line-numbers-as-either-new-or-old-never-both

- **kind:** practice
- **title:** Pair comment line numbers as either new or old
- **path:** review-xml/line-anchors/practice-pair-comment-line-numbers-as-either-new-or-old-never-both.md
- **tags:** self-review, xml, line-numbers
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .agents/skills/self-review-apply/assets/self-review-v3.xsd, AGENTS.md

## practice-pair-line-number-attributes-correctly-in-review-comments

- **kind:** practice
- **title:** Pair line-number attributes correctly in review comments
- **path:** review-xml/line-anchors/practice-pair-line-number-attributes-correctly-in-review-comments.md
- **tags:** self-review, xml, comments
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-pair-line-number-attributes-correctly-on-review-comments

- **kind:** practice
- **title:** Pair line-number attributes correctly on review comments
- **path:** review-xml/line-anchors/practice-pair-line-number-attributes-correctly-on-review-comments.md
- **tags:** self-review, xml, comments
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md

## practice-parallelize-self-review-application-per-file-above-a-3-file-threshold

- **kind:** practice
- **title:** Parallelize self-review application per file above a 3-file threshold
- **path:** skills/apply/practice-parallelize-self-review-application-per-file-above-a-3-file-threshold.md
- **tags:** self-review, workflow, subagents
- **relates_to:** map-self-review-apply-skill
- **derived_from:** .opencode/skills/self-review-apply/SKILL.md

## practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase

- **kind:** practice
- **title:** Complete configured checks and commit each phase
- **path:** planning/execution/practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md
- **tags:** workflow, linting, commits
- **relates_to:** map-post-phase-hook
- **derived_from:** .ai/strikethroo/config/hooks/POST_PHASE.md

## practice-pass-portalcontainer-to-all-radix-shadcn-portal-components

- **kind:** practice
- **title:** Pass portalContainer to all Radix/shadcn portal components
- **path:** packages/styling/practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md
- **tags:** radix, portals, theming
- **relates_to:** map-self-review-wrapper-div
- **derived_from:** packages/react/AGENTS.md

## practice-pin-nix-fetchzip-hashes-to-the-unpacked-directory

- **kind:** practice
- **title:** Pin Nix fetchzip hashes to the unpacked directory
- **path:** engineering/practice-pin-nix-fetchzip-hashes-to-the-unpacked-directory.md
- **tags:** nix, packaging, flake, build
- **relates_to:** practice-upload-release-zips-using-the-makerzip-filenames

## practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code

- **kind:** practice
- **title:** Prefill the suggestion proposed-code editor with the original code
- **path:** app/ui/interactions/practice-prefill-the-suggestion-proposed-code-editor-with-the-original-code.md
- **tags:** suggestions, ux
- **relates_to:** map-self-review-react-package
- **derived_from:** docs/PRD.md

## practice-preserve-orphaned-comments-on-resume-never-silently-drop-them

- **kind:** practice
- **title:** Preserve orphaned comments on resume; never silently drop them
- **path:** app/cli/practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md
- **tags:** resume, comments, data-integrity
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** docs/PRD.md

## practice-preserve-review-body-whitespace-during-xml-parsing

- **kind:** practice
- **title:** Preserve review body whitespace during XML parsing
- **path:** review-xml/comments/practice-preserve-review-body-whitespace-during-xml-parsing.md
- **tags:** self-review, xml, parsing, markdown
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .ai/kenkeep/_sessions/20260731-2121-77699372-867d-4d60-9007-5aa0b672863d.md

## practice-prioritize-the-largest-diffs-when-reviewing-many-files

- **kind:** practice
- **title:** Prioritize the largest diffs when reviewing many files
- **path:** skills/critique/review-strategy/practice-prioritize-the-largest-diffs-when-reviewing-many-files.md
- **tags:** self-review, critique, performance
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-put-the-types-condition-first-in-every-package-exports-block

- **kind:** practice
- **title:** Put the types condition first in every package exports block
- **path:** packages/architecture/practice-put-the-types-condition-first-in-every-package-exports-block.md
- **tags:** packages, exports, typescript, packaging
- **relates_to:** map-npm-workspaces-packages

## practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff

- **kind:** practice
- **title:** Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff
- **path:** packages/architecture/practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md
- **tags:** core, remote-mode, ordering, gotcha

## practice-re-exec-with-headless-ozone-for-windowless-subcommands

- **kind:** practice
- **title:** Re-exec with headless Ozone for windowless subcommands
- **path:** app/cli/practice-re-exec-with-headless-ozone-for-windowless-subcommands.md
- **tags:** electron, cli, packaging, headless
- **relates_to:** map-self-review-cli-invocations

## practice-read-categories-from-self-review-yaml-before-generating-critique

- **kind:** practice
- **title:** Read categories from .self-review.yaml before generating critique
- **path:** skills/critique/configuration/practice-read-categories-from-self-review-yaml-before-generating-critique.md
- **tags:** self-review, critique, categories
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-read-entry-points-first-then-sample-and-follow-cross-references

- **kind:** practice
- **title:** Read entry points first, then sample and follow cross-references
- **path:** knowledge-base/bootstrap/discovery/practice-read-entry-points-first-then-sample-and-follow-cross-references.md
- **tags:** knowledge-base, reading-strategy
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-read-full-file-contents-for-added-modified-files-when-critiquing

- **kind:** practice
- **title:** Read full file contents for added/modified files when critiquing
- **path:** skills/critique/review-strategy/practice-read-full-file-contents-for-added-modified-files-when-critiquing.md
- **tags:** self-review, critique, context
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md

## practice-refresh-index-md-and-graph-md-after-writing-nodes

- **kind:** practice
- **title:** Regenerate kenkeep navigation after node changes
- **path:** knowledge-base/structure/practice-refresh-index-md-and-graph-md-after-writing-nodes.md
- **tags:** knowledge-base, cli, indexing
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-curate/SKILL.md, .lintstagedrc

## practice-require-a-category-on-every-comment

- **kind:** practice
- **title:** Require a category on every comment
- **path:** review-xml/comments/practice-require-a-category-on-every-comment.md
- **tags:** xml, categories
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** docs/PRD.md

## practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call

- **kind:** practice
- **title:** Select the harness for harness-specific kenkeep commands
- **path:** knowledge-base/tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md
- **tags:** knowledge-base, harness, cli
- **relates_to:** map-ai-knowledge-base-cli
- **derived_from:** .ai/kenkeep/scripts/kk-detect-harness.mjs, .agents/skills/kk-curate/SKILL.md, .agents/skills/kk-bootstrap/SKILL.md

## practice-restore-collapsed-panels-inside-flushsync

- **kind:** practice
- **title:** Restore collapsed panels inside flushSync
- **path:** app/ui/interactions/practice-restore-collapsed-panels-inside-flushsync.md
- **tags:** react, panels, dom, keyboard-navigation
- **relates_to:** map-vimium-style-keyboard-navigation

## practice-review-every-generated-task-for-complexity-vagueness-and-triviality

- **kind:** practice
- **title:** Score and refine generated task complexity
- **path:** planning/task-generation/practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md
- **tags:** strikethroo, planning, quality
- **relates_to:** map-post-task-generation-all-hook
- **derived_from:** .agents/skills/st-generate-tasks/SKILL.md

## practice-review-knowledge-base-changes-via-git-diff-before-committing

- **kind:** practice
- **title:** Review knowledge-base changes via git diff before committing
- **path:** knowledge-base/structure/practice-review-knowledge-base-changes-via-git-diff-before-committing.md
- **tags:** knowledge-base, git, review
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .ai/kenkeep/README.md

## practice-review-plans-against-prd-and-test-features-updates

- **kind:** practice
- **title:** Specify plan validation and documentation needs
- **path:** planning/authoring/practice-review-plans-against-prd-and-test-features-updates.md
- **tags:** planning, prd, tests
- **relates_to:** map-pre-plan-hook
- **derived_from:** .ai/strikethroo/config/hooks/POST_PLAN.md

## practice-run-kb-bootstrap-as-a-one-pass-supervised-operation

- **kind:** practice
- **title:** Run bootstrap as a supervised pass
- **path:** knowledge-base/bootstrap/workflow/practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md
- **tags:** knowledge-base, bootstrap, workflow
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-run-kb-curator-via-npx-with-explicit-harness-id

- **kind:** practice
- **title:** Run curation in the current session
- **path:** knowledge-base/curate/practice-run-kb-curator-via-npx-with-explicit-harness-id.md
- **tags:** kk-curate, cli, harness
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped

- **kind:** practice
- **title:** Run npm run prepare in a fresh worktree or the pre-commit hook silently skips
- **path:** engineering/practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md
- **tags:** git, worktree, husky, hooks, gotcha
- **relates_to:** practice-keep-extra-worktrees-out-of-the-repo-root, practice-formatting-is-enforced-by-lint-staged-and-ci

## practice-run-the-webapp-e2e-project-in-the-dev-container

- **kind:** practice
- **title:** Both e2e projects run in the dev container; the Electron tier needs two apt packages
- **path:** engineering/practice-run-the-webapp-e2e-project-in-the-dev-container.md
- **tags:** testing, e2e, playwright, devcontainer
- **relates_to:** map-testing-layers-unit-e2e, practice-install-libgtk-3-0-never-libgtk-3-0t64

## practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div

- **kind:** practice
- **title:** Scope styles and dark mode via the .self-review wrapper div
- **path:** packages/styling/practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md
- **tags:** css, scoping, theming
- **relates_to:** map-self-review-wrapper-div
- **derived_from:** packages/react/AGENTS.md

## practice-scrub-git-repository-env-vars-before-spawning-git-in-tests

- **kind:** practice
- **title:** Scrub git's repository env vars before spawning git in tests
- **path:** engineering/practice-scrub-git-repository-env-vars-before-spawning-git-in-tests.md
- **tags:** testing, git, hooks, hermetic-tests
- **relates_to:** map-testing-layers-unit-e2e

## practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo

- **kind:** practice
- **title:** _sessions/ is gitignored; provenance does not travel with the repo
- **path:** knowledge-base/structure/practice-sessions-is-gitignored-provenance-does-not-travel-with-the-repo.md
- **tags:** knowledge-base, sessions, provenance
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .ai/kenkeep/README.md

## practice-set-author-to-your-model-name-on-every-generated-comment

- **kind:** practice
- **title:** Set author to your model name on every generated comment
- **path:** skills/critique/output/practice-set-author-to-your-model-name-on-every-generated-comment.md
- **tags:** self-review, attribution, critique
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-set-the-comment-author-attribute-to-the-model-name

- **kind:** practice
- **title:** Set the comment `author` attribute to the model name
- **path:** skills/critique/output/practice-set-the-comment-author-attribute-to-the-model-name.md
- **tags:** self-review, attribution, author
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md

## practice-set-viewed-true-on-every-file-in-ai-generated-review-xml

- **kind:** practice
- **title:** Set `viewed="true"` on every file in AI-generated review.xml
- **path:** skills/critique/output/practice-set-viewed-true-on-every-file-in-ai-generated-review-xml.md
- **tags:** self-review, xml, attributes
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md

## practice-set-viewed-true-on-every-file-in-critique-output

- **kind:** practice
- **title:** Set viewed="true" on every file in critique output
- **path:** skills/critique/output/practice-set-viewed-true-on-every-file-in-critique-output.md
- **tags:** self-review, xml, critique
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures

- **kind:** practice
- **title:** Finish curation after reporting placements and rebalance
- **path:** knowledge-base/curate/practice-short-circuit-kb-curate-with-one-line-summary-when-no-conflicts-and-no-failures.md
- **tags:** kk-curate, fast-path, summary
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg

- **kind:** practice
- **title:** Show welcome screen when launched outside a git repo with no directory arg
- **path:** app/cli/practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md
- **tags:** startup, launcher, welcome
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** docs/PRD.md

## practice-skip-files-that-look-correct-do-not-force-comments-on-every-file

- **kind:** practice
- **title:** Skip files that look correct; do not force comments on every file
- **path:** skills/critique/review-strategy/practice-skip-files-that-look-correct-do-not-force-comments-on-every-file.md
- **tags:** self-review, critique, scope
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-skip-files-that-look-correct-rather-than-forcing-comments

- **kind:** practice
- **title:** Skip files that look correct rather than forcing comments
- **path:** skills/critique/review-strategy/practice-skip-files-that-look-correct-rather-than-forcing-comments.md
- **tags:** self-review, critique, scope
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md

## practice-sort-and-group-pending-conflicts-before-resolving

- **kind:** practice
- **title:** Sort and group pending conflicts before resolving
- **path:** knowledge-base/curate/practice-sort-and-group-pending-conflicts-before-resolving.md
- **tags:** kk-curate, conflicts, grouping
- **relates_to:** map-knowledge-base-capture-curate-review-workflow
- **derived_from:** .agents/skills/kk-curate/SKILL.md

## practice-spawn-git-with-an-argv-array-never-a-shell-string

- **kind:** practice
- **title:** Spawn git with an argv array, never a shell string
- **path:** engineering/practice-spawn-git-with-an-argv-array-never-a-shell-string.md
- **tags:** security, git, subprocess, shell-injection
- **relates_to:** practice-convert-git-diff-args-only-through-format-and-tokenize

## practice-split-combined-content-across-practice-and-map-nodes

- **kind:** practice
- **title:** Split combined content across practice and map nodes
- **path:** knowledge-base/structure/practice-split-combined-content-across-practice-and-map-nodes.md
- **tags:** knowledge-base, node-authoring, ownership
- **relates_to:** map-ai-knowledge-base-directory
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r

- **kind:** practice
- **title:** Split file text on \n only and keep each line's trailing \r
- **path:** packages/architecture/practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md
- **tags:** core, apply-suggestion, line-endings, diff-parser
- **relates_to:** practice-encode-diff-header-paths-with-quotegitpath

## practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap

- **kind:** practice
- **title:** Stick to markdown documentation; do not read code files during bootstrap
- **path:** knowledge-base/bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md
- **tags:** knowledge-base, scope
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track

- **kind:** practice
- **title:** Stop and ask the user when bootstrap conditions go off-track
- **path:** knowledge-base/bootstrap/workflow/practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md
- **tags:** knowledge-base, escalation
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** .agents/skills/kk-bootstrap/SKILL.md

## practice-strip-agent-attribution-from-commit-messages

- **kind:** practice
- **title:** Commitlint rejects agent attribution in the message and the author email
- **path:** engineering/practice-strip-agent-attribution-from-commit-messages.md
- **tags:** git, commitlint, husky, commits
- **relates_to:** practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped, practice-use-conventional-commit-naming-for-pr-titles

## practice-treat-every-review-comment-as-actionable-including-questions

- **kind:** practice
- **title:** Treat every review comment as actionable, including questions
- **path:** skills/apply/practice-treat-every-review-comment-as-actionable-including-questions.md
- **tags:** self-review, comments, questions
- **relates_to:** map-self-review-apply-skill
- **derived_from:** .opencode/skills/self-review-apply/SKILL.md

## practice-treat-self-review-as-a-cli-first-one-shot-tool

- **kind:** practice
- **title:** Treat self-review as a CLI-first, one-shot tool
- **path:** app/cli/practice-treat-self-review-as-a-cli-first-one-shot-tool.md
- **tags:** cli, workflow, output
- **relates_to:** map-self-review-cli-invocations
- **derived_from:** README.md

## practice-trigger-large-payload-guard-at-configurable-file-line-thresholds

- **kind:** practice
- **title:** Trigger large-payload guard at configurable file/line thresholds
- **path:** app/architecture/practice-trigger-large-payload-guard-at-configurable-file-line-thresholds.md
- **tags:** payload, performance, ux
- **relates_to:** map-two-process-electron-architecture
- **derived_from:** README.md

## practice-upload-release-zips-using-the-makerzip-filenames

- **kind:** practice
- **title:** Upload release ZIPs using the MakerZIP filenames
- **path:** engineering/practice-upload-release-zips-using-the-makerzip-filenames.md
- **tags:** release, packaging
- **relates_to:** map-self-review
- **derived_from:** .ai/kenkeep/_sessions/20260708-0612-8ba72cf2-8c9f-43fa-ae1b-570ec4ddab17.md

## practice-use-asar-unpack-not-asarunpack-in-forge-config

- **kind:** practice
- **title:** asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack
- **path:** engineering/practice-use-asar-unpack-not-asarunpack-in-forge-config.md
- **tags:** electron, forge, packaging, asar, xmllint
- **relates_to:** practice-do-not-install-or-use-webpack

## practice-use-categories-from-self-review-yaml-when-present

- **kind:** practice
- **title:** Use categories from .self-review.yaml when present
- **path:** skills/critique/configuration/practice-use-categories-from-self-review-yaml-when-present.md
- **tags:** self-review, critique, categories
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md

## practice-use-conventional-commit-naming-for-pr-titles

- **kind:** practice
- **title:** Use conventional commit naming for PR titles
- **path:** engineering/practice-use-conventional-commit-naming-for-pr-titles.md
- **tags:** strikethroo, pr, conventional-commits
- **relates_to:** map-self-review
- **derived_from:** AGENTS.md

## practice-use-es-module-imports-in-the-renderer-not-require

- **kind:** practice
- **title:** Use ES module imports in the renderer, not require()
- **path:** app/architecture/practice-use-es-module-imports-in-the-renderer-not-require.md
- **tags:** strikethroo, modules, imports
- **relates_to:** map-two-process-electron-architecture
- **derived_from:** AGENTS.md

## practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type

- **kind:** practice
- **title:** Use old vs new line numbers based on the commented line type
- **path:** review-xml/line-anchors/practice-use-old-vs-new-line-numbers-based-on-the-commented-line-type.md
- **tags:** strikethroo, line-numbers, comments
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** AGENTS.md

## practice-use-prism-js-for-syntax-highlighting-with-theme-matching

- **kind:** practice
- **title:** Use Prism.js for syntax highlighting with theme matching
- **path:** app/ui/previews/practice-use-prism-js-for-syntax-highlighting-with-theme-matching.md
- **tags:** strikethroo, syntax-highlighting, prism
- **relates_to:** map-rendered-file-previews
- **derived_from:** AGENTS.md

## practice-use-shadcn-ui-components-instead-of-raw-html-for-ui

- **kind:** practice
- **title:** Use shadcn/ui components instead of raw HTML for UI
- **path:** app/ui/interactions/practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md
- **tags:** strikethroo, ui, shadcn
- **relates_to:** map-self-review-react-package
- **derived_from:** AGENTS.md

## practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types

- **kind:** practice
- **title:** Use src/shared/types.ts as the single source of truth for shared types
- **path:** app/architecture/practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md
- **tags:** strikethroo, types, duplication
- **relates_to:** map-two-process-electron-architecture
- **derived_from:** AGENTS.md

## practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed

- **kind:** practice
- **title:** Use <suggestion> blocks whenever a concrete fix can be proposed
- **path:** skills/critique/suggestions/practice-use-suggestion-blocks-whenever-a-concrete-fix-can-be-proposed.md
- **tags:** self-review, suggestions, critique
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-use-the-new-path-for-renamed-files-in-review-xml

- **kind:** practice
- **title:** Use the new path for renamed files in review XML
- **path:** review-xml/comments/practice-use-the-new-path-for-renamed-files-in-review-xml.md
- **tags:** self-review, xml, renames
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-use-the-reviewadapter-pattern-for-platform-specific-operations

- **kind:** practice
- **title:** Use the ReviewAdapter pattern for platform-specific operations
- **path:** packages/architecture/practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md
- **tags:** architecture, adapter, platform
- **relates_to:** map-self-review-react-package, map-reviewadapter-interface
- **derived_from:** packages/react/AGENTS.md

## practice-validate-generated-review-xml-against-the-xsd-before-finishing

- **kind:** practice
- **title:** Validate generated review.xml against the XSD before finishing
- **path:** skills/critique/output/practice-validate-generated-review-xml-against-the-xsd-before-finishing.md
- **tags:** self-review, xml, validation
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .agents/skills/self-review-critique/SKILL.md

## practice-validate-generated-review-xml-against-the-xsd-with-xmllint

- **kind:** practice
- **title:** Validate generated review.xml against the XSD with xmllint
- **path:** skills/critique/output/practice-validate-generated-review-xml-against-the-xsd-with-xmllint.md
- **tags:** self-review, critique, validation
- **relates_to:** map-self-review-critique-skill
- **derived_from:** .opencode/skills/self-review-critique/SKILL.md, .agents/skills/self-review-critique/SKILL.md

## practice-validate-self-review-xml-against-the-xsd-before-applying

- **kind:** practice
- **title:** Validate self-review XML against the XSD before applying
- **path:** skills/apply/practice-validate-self-review-xml-against-the-xsd-before-applying.md
- **tags:** self-review, validation, xmllint
- **relates_to:** map-self-review-apply-skill
- **derived_from:** .opencode/skills/self-review-apply/SKILL.md, .agents/skills/self-review-apply/SKILL.md

## practice-validate-xml-output-against-the-xsd-before-writing

- **kind:** practice
- **title:** Validate XML output against the XSD before writing
- **path:** review-xml/schema/practice-validate-xml-output-against-the-xsd-before-writing.md
- **tags:** strikethroo, xml, validation
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** AGENTS.md

## practice-watch-css-sources-explicitly-with-tsup

- **kind:** practice
- **title:** Watch CSS sources explicitly with tsup
- **path:** packages/styling/practice-watch-css-sources-explicitly-with-tsup.md
- **tags:** build, tsup, css, dev-loop
- **relates_to:** map-css-build-pipeline-for-self-review-react

## practice-write-node-modules-without-a-trailing-slash-in-gitignore

- **kind:** practice
- **title:** Write node_modules without a trailing slash in .gitignore
- **path:** engineering/practice-write-node-modules-without-a-trailing-slash-in-gitignore.md
- **tags:** git, gitignore, worktree, tooling
- **relates_to:** practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped, practice-keep-extra-worktrees-out-of-the-repo-root

## practice-write-prds-without-tasks-or-phases-during-plan-creation

- **kind:** practice
- **title:** Write PRDs without tasks or phases during plan creation
- **path:** planning/authoring/practice-write-prds-without-tasks-or-phases-during-plan-creation.md
- **tags:** planning, prd, workflow
- **relates_to:** map-pre-plan-hook
- **derived_from:** .ai/strikethroo/config/hooks/PRE_PLAN.md

## practice-xml-escape-all-text-content-in-review-xml

- **kind:** practice
- **title:** XML-escape all text content in review.xml
- **path:** review-xml/comments/practice-xml-escape-all-text-content-in-review-xml.md
- **tags:** self-review, xml, escaping
- **relates_to:** map-review-xml-format-and-xsd
- **derived_from:** .agents/skills/self-review-critique/SKILL.md
