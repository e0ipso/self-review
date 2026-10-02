# Hardening test map (2026-10-01 review)

Plan 63 (#164) worked through an internal review of `5fd7aea`. This file maps each item to the code
and tests that cover it.

Every test listed here ran green in the final verification: `npm run test:unit`, the five typecheck
scripts, `npm run lint`, `npm run format:check`, `npm run test:e2e` (webapp), `npm run test:e2e:serve`
and the Electron e2e tier. This host has no `xvfb-run`, so the Electron tier ran with the X11 recipe
in `AGENTS.md`.

## Reliability

| ID | Fix | Evidence |
| --- | --- | --- |
| R01 | `publishReview` validates first, stages assets no-follow, commits the XML by atomic rename. `QuitController` routes menu Quit and window close through Save & Quit / Discard / Cancel. A failed save keeps the window open. The empty-review pull fallback is gone. | `packages/core/src/review-publisher.test.ts`, `safe-fs.test.ts`, `src/main/quit-controller.test.ts`, `tests/features/15-quit-and-save-recovery.feature` |
| R02 | Serve hooks run before any early return. A failed submit stays guarded and can be retried. Oversized bodies are refused before sending. The server acknowledges only after the file is written. | `packages/serve/src/client/index.test.tsx`, `client/adapter.test.ts`, `lifecycle.test.ts`, `tests/serve/recoverable-submission.spec.ts` |
| R03 | Value coercion off, a single-pass entity decoder, CR/LF/TAB character references, typed `ReviewXmlError`, no `process.exit` in core. Invalid anchors are downgraded at import with diagnostics. | `xml-text.test.ts`, `xml-roundtrip.test.ts` (real xmllint and Python `xml.etree`), `xml-parser.test.ts`, `anchor-validation.test.ts`, `ImportDiagnosticsBanner.test.tsx` |
| R04 | Anchors are validated before I/O. An empty proposal deletes the range. `atomicReplace` preserves mode and owner and leaves the target untouched on failure. | `packages/core/src/apply-suggestion.test.ts` (including an injected ENOSPC) |
| R05 | GitLab positions carry `head_sha`. Only head-verified anchors produce a suggestion. | `gitlab-provider.test.ts`, `thread-mapper.test.ts` |
| R06 | Git output is forced into parser shape. The parser handles binary patches, copies and hunk accounting, and reports `diff --cc` and unsupported output flags as diagnostics. | `diff-fidelity.process.test.ts` (real git), `diff-parser.test.ts`, `git-diff-args.test.ts`, `EmptyDiffMessage.test.tsx` |
| R07 | Expansion re-runs the structured argv and keeps rename pairs. `pathPrefix` maps `--relative` paths for expansion, Apply and image previews alike. | `review-handlers.expand.test.ts` (real git), `source-identity.test.ts`, Electron `12-expand-context.feature` |
| R08 | Markdown block components are module-level. Ranges and actions flow through context. | `RenderedMarkdownView.drafts.test.tsx` |
| R09 | HTML anchors come from a positioned hast parse that survives passive filtering. | `RenderedMarkdownView.test.tsx` |
| R10 | A path-keyed element registry replaces selector interpolation. `PreviewErrorBoundary` contains a failing file. | `DiffNavigationContext.test.tsx`, `PreviewErrorBoundary.test.tsx` |
| R11 | Removing an attachment clears it, and stale async image results are cancelled. Resumed attachments resolve against their document and are copied when saving to another directory. | `CommentInput.test.tsx`, `AttachmentImage.test.tsx`, `attachment-origins.test.ts` |
| R12 | Tracked and untracked entries are deduplicated by path, and the tracked entry wins. | `git-diff-loader.test.ts`, `diff-fidelity.process.test.ts` |
| R13 | `ReviewSourceIdentity` plus `readReviewedContent`: image previews and line counts read the reviewed index or commit, not the working tree. | `review-handlers.snapshot.test.ts`, `snapshot-reader.test.ts` |
| R14 | Lazy loads have explicit states and a manual Retry. Large payloads start collapsed. Directories are pruned during the walk, and budgets apply before reading. | `lazy-file-content.test.tsx`, `DiffViewer.test.tsx`, `directory-scanner.test.ts`, `synthetic-diff.test.ts`, `guide-loader.budget.test.ts`, `xml-parser.file.test.ts` |
| R15 | `packages/core/src/startup.ts` and `cli-options.ts` are shared by desktop, serve and `fetch-comments`. | `startup.test.ts`, `cli-options.test.ts`, `src/main/cli.test.ts` and `packages/serve/src/args.test.ts` (one shared case table) |
| R16 | Each session gets its own refs (`refs/self-review/<uuid>/*`). Git runs cancellably with timeouts. One try/finally owns the clone. | `materializer.test.ts` (controlled interleaving, real git), `remote-mode.test.ts`, `src/main/cli-dispatch.test.ts` |
| R17 | Replacing the adapter or source starts a new session. `initialComments` hydrate once. | `ReviewContext.session.test.tsx`, `SingleFileReview.session.test.tsx` |
| R18 | Original code is substituted only when the whole range is visible. | `diff-utils.test.ts`, `CommentDisplay.test.tsx` |
| R19 | Deleted-file search, `font-size`, hint focus, and image rejection now behave correctly. | `FileTree.test.tsx`, `ConfigContext.test.tsx`, `useKeyboardNavigation.test.ts`, `RenderedImageView.test.tsx`, webapp `12-configured-font-size.feature` |

## Hardening

| ID | Fix | Evidence |
| --- | --- | --- |
| A1 | A provenance gate requires a same-repository push to `main` and a head reachable from `main` before any checkout. Build is split from publication, actions are SHA-pinned, and `persist-credentials: false` is set. | `scripts/test/release-provenance.test.sh` (synthetic events), `docs/release-security.md` |
| A2 | A per-process 256-bit capability, delivered in the URL fragment, is required as a Bearer token on every `/api/` route. | `packages/serve/src/server.test.ts`, `tests/serve/capability.spec.ts` |
| A3 | Apply checks membership in `reviewedPaths` and refuses any `.git` path. | `review-handlers.test.ts`, `apply-suggestion.test.ts` |
| A4 | `realpath`, an `lstat` walk over ancestors, `O_NOFOLLOW`, an identity check and atomic replace. | `apply-suggestion.test.ts`, `safe-fs.test.ts` |
| A5 | Configuration provenance: project `output-file` is inherited and contained, project diff args with `--output`, `--ext-diff` or `--textconv` are refused, and the publisher refuses links. | `startup.test.ts`, `packages/serve/src/startup.test.ts`, `review-publisher.test.ts` |
| A6 | Serve authorizes paths through core's `authorizeReviewedPath` against the session source root. | `packages/serve/src/source-identity.test.ts` (real HTTP, symlink escape) |
| A7 | Mermaid renders off-document into a data-URI `<img>` under a strict, secured config. Passive HTML drops `style` and non-language classes. | `MermaidBlock.test.tsx`, `passive-content.test.ts`, webapp `13-content-isolation.feature` |
| A8 | Front matter display has cycle, depth and node limits. | `front-matter.test.ts`, `FrontMatterTable.test.tsx` |
| A9 | Assets are written by exclusive no-follow creates under a verified asset directory. | `review-publisher.test.ts` |

## Simplifications

| # | Outcome | Where |
| --- | --- | --- |
| 1 | One safe output publisher | `packages/core/src/review-publisher.ts`, used by desktop, serve and `fetch-comments` |
| 2 | Structured source identity and shared startup | `source-identity.ts`, `snapshot-reader.ts`, `startup.ts`, `cli-options.ts` |
| 3 | One session boundary | `packages/react/src/context/ReviewContext.tsx` (`sessionId`, keyed replacement) |
| 4 | Stable previews and parser positions | `RenderedMarkdownView.tsx`, `passive-content.ts` |
| 5 | Shared remote helpers | `loadRemoteReview` in `remote-mode.ts`; the pre-diff mapping is removed |
| 6 | Scoped Prism themes | `src/index.css` imports the package stylesheet; runtime injection and theme props are removed |
| 7 | Canonical browser-safe defaults | `packages/react/src/config-defaults.ts`, read by core's config loader |
| 8 | Process-exiting and dead paths retired | `git.ts` sync helpers, `xml-parser` exits, the `review:request` pull fallback, the `src/main` serializer and fs shims, and the root `prism-themes` dependency are removed |

## Not covered here

- **Repository settings** the release workflow relies on are listed in `docs/release-security.md`.
- **Platforms.** Filesystem behaviour (no-follow, atomic rename, ownership) was tested on Linux only. macOS was not exercised.
- **Applied dependency advisories.** See `docs/dependency-advisory-classification-2026-10-01.md`. Electron 44.5.1, Mermaid 11.17.2, DOMPurify 3.4.16 and fast-xml-parser 5.11.2 now ship. The remaining `npm audit --omit=dev` entries resolve through release and build tooling.

## Breaking changes

- `@self-review/core`:
  - `runGitDiff`, `getRepoRoot`, `validateGitAvailable` and `readGitBlobAsync` are removed.
  - `parseReviewXml` and `parseReviewXmlString` throw `ReviewXmlError`.
  - `serializeReview` is pure and returns `{ xml, assets }`.
  - `loadGitDiffWithUntracked`, `scanDirectory`, `scanFile` and `generateSyntheticDiffs` return structured results with diagnostics.
  - `applySuggestion` has new refusal reasons and options.
  - `readAttachment` takes `(session, reference)`.
  - `commitDiffData` and `commitReviewStart` take the source identity.
  - `startRemoteSession` no longer maps threads.
  - `ForgeThreadAnchor.outdated` is optional.
  - `ForgeCommandRunner` takes `{ signal, timeoutMs }`.
  - `MaterializeResult.cleanup` is async.
  - `FetchCommentsDeps` changed shape.
  - `ReviewSourceIdentity` requires `pathPrefix`.
- `@self-review/types`: `ChangeType` gains `'copied'`. `DiffLoadPayload.diagnostics` and `ResumeLoadPayload.importDiagnostics` are new optional fields.
- `@self-review/react`:
  - Replacing the adapter starts a new session.
  - `ReviewPanel` and `SingleFileReview` drop `prismLightCss` and `prismDarkCss`.
  - Resumed suggestions on file-level comments are downgraded on import.
- `@self-review/serve`:
  - `ReviewServerOptions` requires `capability` and `output`, and drops `repositoryRoot`.
  - API clients must send `Authorization: Bearer`.
  - `POST /api/review` answers `{ ok, outputPath }` only after the write.
  - `GET /api/file` answers 400 for paths outside the reviewed diff.
- Desktop:
  - The `review:request` IPC channel is removed.
  - Menu Quit now asks to save.
  - A project `output-file` or default output that resolves outside the launch directory is refused at save.
- Behaviour:
  - Diff code text defaults to the documented 14px. It was a hard-coded 13px.
