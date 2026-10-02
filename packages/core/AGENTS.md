# @self-review/core

Node.js library for diff parsing, git operations, XML serialization, configuration, and file system
utilities.

## Purpose

Headless business logic consumed by the Electron main process. Provides the complete pipeline from
CLI args → git diff → parsed AST → XML output.

## Constraints

- **Node.js only.** This package uses `child_process`, `fs`, and Node-only libraries
  (`xmllint-wasm`, `fast-xml-parser`, `yaml`, `ignore`). It cannot be imported in browser or
  renderer code.
- **No imports from `@self-review/react`.** Dependency flows one way: `core` depends on `types`,
  never on `react`. The one sanctioned exception is `src/config.ts` importing
  `packages/react/src/config-defaults.ts` by relative source path: a pure-data module (type-only
  import, no React, no DOM) that both packages bundle, so the YAML loader and the renderer's
  `ConfigProvider` merge over the same defaults. tsup inlines it; the published package has no
  runtime dependency on `@self-review/react`. Its header records why it lives there.
- **`file-type-utils.ts` is duplicated in `@self-review/react`.** The functions in this file
  (`getLanguageFromPath`, `isPreviewableImage`, `isPreviewableSvg`) are pure string utilities with
  no Node dependencies. They are intentionally duplicated in
  `packages/react/src/utils/file-type-utils.ts` to avoid forcing `react` to depend on this package.
  Keep both copies in sync when changing the logic.

## Structure

```
src/
├── index.ts              # Barrel export
├── types.ts              # Re-exports from @self-review/types
├── diff-parser.ts        # Unified diff → DiffFile[]
├── git.ts                # child_process wrappers for git
├── xml-serializer.ts     # ReviewState → { xml, assets } (pure; validates against XSD; refuses XML-illegal chars)
├── review-publisher.ts   # publishReview: validate → stage assets (unique, exclusive, no-follow) → atomic rename
├── attachment-origins.ts # Attachment provenance: resumed references resolve beside the resumed document; authorized, no-follow, bounded reads; relocation bytes for the publisher
├── safe-fs.ts            # No-follow primitives: writeExclusiveNoFollow, atomicReplace (mode/owner/identity-preserving), assertNoSymlinkAncestors, FsLayer
├── apply-suggestion.ts   # applySuggestion: anchor validated pre-I/O, .git refused, realpath root + lstat ancestors + O_NOFOLLOW, atomicReplace
├── source-identity.ts    # ReviewSourceIdentity resolution: which two snapshots a git diff argv compares (SHAs pinned at load), directory/file roots, the --relative pathPrefix; rootRelativeReviewedPath is the one session-path → root-path mapping
├── snapshot-reader.ts    # authorizeReviewedPath + readReviewedContent: the one path authorization and content read (index/commit blob via git cat-file, working/scanned file no-follow)
├── xml-parser.ts         # XML → ReviewState (lossless; downgrades bad anchors with diagnostics)
├── xml-text.ts           # The one escape/decode contract (CR/LF/TAB as char refs, single pass)
├── xml-errors.ts         # ReviewXmlError / XmlIllegalCharacterError (library never process.exits)
├── anchor-validation.ts  # validateLineAnchor / validateLineRange, shared by resume import and Apply
├── config.ts             # YAML config loading & merging over the shared defaults (packages/react/src/config-defaults.ts); loadConfigWithProvenance records each value's origin (user file / project file / default)
├── startup.ts            # The startup steps both front ends share: resolveOutputTarget (user output-file explicit, project/default inherited), resolveStartupDiffArgs (project default-diff-args may not name --output/--ext-diff/--textconv), loadLocalReview, loadResumeDocument; the two CLIs' intentional differences are tabled here
├── startup-mode.ts       # resolveStartupSource / determineMode: git, directory, file or welcome, from the classifier's first positional
├── cli-options.ts        # extractApplicationOptions: both CLIs' own flags out of a git argv (-- ends them, option values kept, --flag=value)
├── synthetic-diff.ts     # Diffs for non-git directories
├── directory-scanner.ts  # File/directory scanning
├── payload-sizing.ts     # Large-payload threshold checks
├── ignore-filter.ts      # .gitignore-style filtering
├── fs-utils.ts           # checkWritability, used by the publisher's inspectOutputPath (the startup hint every host probes through)
└── file-type-utils.ts    # File extension → language/preview detection
```

## Testing

```bash
npm run test:unit    # from package root, or
npm run test:unit --workspace @self-review/core   # from workspace root
```

Tests are colocated (`*.test.ts` next to source files). `npm run test:unit:main` from the workspace
root does not run these tests despite the similar name — that script targets
`vitest.config.main.ts`, which is scoped to the desktop main-process suite
(`src/main/**/*.test.ts`), a separate suite from this package.

Suites that spawn real git call `gitSync` from `src/test-support/git-env.ts` instead of
`execFileSync('git', ...)`, and `vitest.setup.ts` scrubs the same variables from the worker's own
environment. Git exports `GIT_DIR` and `GIT_INDEX_FILE` into hook processes, and they outrank both
`git -C <dir>` and the child's cwd — inheriting them made these suites commit to whatever repository
the `pre-commit` hook was running in (SR-0055).
