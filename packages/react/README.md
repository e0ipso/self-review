# React host integration

`ReviewProviders` exports the provider order used by `ReviewPanel`. Pass `adapter`, optional
`initialConfig`, `initialOutputPath` for the host output target, and the existing `ReviewProvider`
options `initialFiles`, `initialSource`, and `initialComments`. Children can render host chrome, a
welcome/loading view, or `Layout`, and can call all review, guide, configuration and navigation
hooks. The provider adds no layout or keyboard manager. Keep adapter identity stable. Static files
suppress diff loading and diff subscriptions; initial comments hydrate once. `ReviewPanel` retains
its children and imperative handle contracts.

## Session updates

The provider owns a single request controller for diff/resume ordering and snapshot-bound context
reads. The complete `useReview` projection remains available; comment mutations and file/progress
subscriptions do not depend on that projection. Standalone `ReviewProvider` compositions retain
their load-error and saved-feedback Retry controls.

A remote review's logical identity is its adapter object, source kind, forge and exact PR/MR URL. A
newer base/head SHA or a new materialization directory updates that review instead of clearing
comments and viewed flags. Local repository/diff-argument changes still replace a local review.
Every external snapshot replacement invalidates pending reads, resume responses and Apply ownership.

On remote snapshot changes, an existing line anchor survives only when the same path, side and
complete range contain identical text in both loaded diffs. A suggestion's recorded original must
also match exactly. Changed, moved, missing, unloaded or otherwise unverifiable anchors become
orphaned file-level feedback. The proposal and original code remain in the body as inert text;
replies, attachments, authors, classification and IDs stay intact. Diagnostics explain each
downgrade. No anchor is searched for or moved to another line. Reviewed-path membership and host
Apply checks continue to govern writes.

`loadResumedReview` belongs to the initial snapshot. A changed remote snapshot must receive its
feedback through `onResumeLoad` after its diff push; pending initial feedback is discarded rather
than attached to the new snapshot. A manual resume retry refuses cached feedback from an earlier
remote snapshot. Hosts with the push subscription must acknowledge the new snapshot before save,
including an empty feedback payload. Existing hosts without it keep their human feedback and do not
perform a cached initial resume pull for the new head.

## Read ownership

`ReviewAdapter.reads` optionally supplies `loadFileContent`, `expandContext`, `loadImage` and
`readAttachment` with an `AbortSignal` as their last argument. Each member is optional. The UI falls
back to the corresponding original adapter method when a member is absent, including manual retry.
The original members and their signatures remain supported. Internal helpers accept just the
corresponding modern/legacy read capability; callers can continue to pass their existing adapters.

Lazy hunks belong to the file, session and adapter that requested them. Collapse, replacement and
disposal abort pending work; reopening starts a new read. Ordinary loading rerenders keep the
request alive. Context expansion and image previews have the same ownership, and attachment reads
also release their blob URLs. A dismissed image-ingestion job cancels its decoder without cancelling
the next queued image. SVG previews read already-loaded hunks and make no host read.

Stale-result checks remain necessary. Legacy hosts can continue working after cancellation, and an
abort cannot preempt synchronous layout, structured cloning or a native decoder already running.
Obsolete success and failure results never replace current content. Genuine read failures retain
explicit retry; they do not trigger an automatic request loop. Attachment `null` means missing
content. Access, unsafe-path, size and I/O failures reject with a useful message.

## Review metadata services

`ReviewPanel` and `ReviewProviders` accept optional `services: Partial<ReviewServices>`. The
`createId` factory supplies published comment and reply IDs; its browser default remains
`crypto.randomUUID()`. `now` returns a valid `Date`, defaulting to `new Date()`, and supplies the
timestamps for `getReviewState()` and atomic `beginSave()` captures. It is also available through
`useReviewServices()`. Services inherit from an enclosing `ReviewServicesProvider`, so custom
compositions and `SingleFileReview` can opt in through that provider too. Keep supplied factories
stable and ensure IDs are unique within a review. Supplying services to one root does not change
another root.

```tsx
<ReviewPanel adapter={adapter} services={{ createId: () => crypto.randomUUID() }} />
```

These dependencies generate review metadata only. They never supply HTTP capabilities, credential
keys, attachment names or filesystem identifiers, and add no persisted configuration or browser
storage.

`ReviewAdapter.onResumeLoad(callback)` is an optional later-push subscription. Emit each payload
after its owning diff push. It supersedes an outstanding initial resume request; disposed
subscriptions and late responses cannot mutate a replacement session. Existing adapters using only
`loadResumedReview` continue to work. Hosts must not emit an old session's resume after a new
session's diff, because the existing resume payload contains no session identifier.

`submitReview` retains its host-specific legacy meaning: desktop state handoff and HTTP disk
publication. Prefer `handoffReview` or `publishReview` when the completion guarantee matters. A
legacy completion resolving does not give the library a stronger guarantee than the host's own
contract. `handoffReview` acknowledges receipt in host memory; `publishReview` acknowledges durable
publication. Neither mutation nor publication uses cancellable read handling, and an unknown write
outcome is never turned into an automatically retryable read error.

`ConfigAdapter` remains exported for source compatibility but is deprecated. Components never
consumed it. Load configuration in the host and pass the result through a config prop or provider.

Prefer focused customization hooks: `useAppearance`, `useCategories`, `useOutputPath`,
`usePortalContainer`, `useConfiguration`, `useFileReview` and `useReviewCommands`. Broad `useReview`
and `useConfig` remain compatibility APIs. `initialConfig` is merged once per provider mount;
`config` remains its deprecated initial-only alias. Existing required and optional adapter members,
legacy context exports and initial state semantics are preserved.

## Capturing a review

`ReviewHandle.getReviewState()` is a diagnostic read of the current rendered state. It returns while
diff loading or resume is pending or has failed, and while a save owns mutations. It neither checks
readiness nor reserves mutations, and retains the current source and file references. This supports
existing embedding code and read-only inspection. Reading it does not finish drafts or prove that
saved feedback has arrived.

For publication, use `ReviewHandle.beginSave?.()` or `useReviewSaveTransaction().begin()`. The
first-party desktop and HTTP flows use this transaction. It refuses unfinished drafts, pending or
failed loading/resume and competing saves, then captures from the synchronous owner and reserves
mutations. Check `capture.current()` before accepting a late host reply. A known refusal can release
`capture.unlock()` for a manual retry. Success and unknown outcomes retain ownership; inspect an
unknown outcome before explicitly unlocking or repeating a write.

`beginSave` remains optional on the public handle. A custom handle that only implements
`getReviewState` still works for inspection; its host owns readiness, draft handling and capture
coordination if it publishes through that older contract. `submitReview` also remains optional and
keeps its existing host-specific return behavior. These legacy calls alone cannot promise an atomic
capture or a durable publication acknowledgement.

## Preview composition

`ReviewPanel` and `ReviewProviders` accept optional `previewRenderer` and `diagramRenderer` props.
`PreviewRenderingProvider` supplies the same capabilities around lower-level compositions, including
`SingleFileReview`, without changing `ReviewAdapter`. Nested providers inherit omitted capabilities.
The focused `usePreviewRenderer` and `useDiagramRenderer` hooks read the current services. Keep
renderer objects and component identities stable to preserve local UI state.

A `PreviewRenderer` contains a pure `supports(file, builtIn)` predicate and a React `component`.
Matching runs only for added files. Existing format eligibility and initial modes remain the
default. A host-only format starts in raw mode unless the renderer sets `defaultMode: 'rendered'`.
Loading, omission and load-failure states precede preview dispatch, and Raw remains available.

```tsx
const previewRenderer: PreviewRenderer = {
  supports: (file, builtIn) => builtIn.kind === 'text',
  component: ({ filePath, children }) => (
    <section aria-label={`Preview of ${filePath}`}>{children}</section>
  ),
};

<ReviewPanel adapter={adapter} previewRenderer={previewRenderer} />;
```

The component receives the file, path, built-in preview discriminator, current comment range and
comment callbacks. `children` is the existing built-in preview, or null for a host-only format.
Render it to retain built-in source gutters and feedback. A replacement owns its source mapping,
keyboard operation and accessible names. Custom renderers are trusted host code; reviewed text,
HTML, CSS and SVG must remain passive. Do not inject reviewed HTML into the host DOM or introduce
network, storage or writes through a renderer. The built-ins retain passive-content filtering and
SVG image isolation.

Legacy deep-import users of `DiffContentArea` can still pass all four required eligibility fields,
with optional `preview` taking precedence. New compositions can use `PreviewContentArea` with one
`preview` discriminator. Both `FileSectionBody` overloads and their normalization remain supported;
removing the old fields requires a breaking release.

### Diagram services

`DiagramRenderService.render({ source, theme, signal })` returns a promise of `{ svg: string }`.
`source` is untrusted, `theme` is `light` or `dark`, and output is SVG text only. The view checks
source length and layout complexity before invoking any service, then checks output size, XML/SVG
shape and intrinsic dimensions before displaying a local data URI in an inert `<img>`. No service
may return live DOM, URLs or executable callbacks. Strict security and passive output remain the
service implementation's responsibility; the view's image boundary also contains supplied output.

Use `createDiagramRenderService(layout)` to give a supplied implementation serial, bounded
admission. It validates source before layout, admits eight active/queued requests, checks abort
before starting a queued request, and retains each slot until the layout promise actually settles.
The implementation must observe the signal, clean up its resources and resolve or reject only when
its actual work ends. An abort rejection must not conceal still-running layout. The view aborts on
source, theme or service replacement, unmount and wait timeout, drops stale results and retries only
after an explicit action. Services may be shared; the host owns their creation, configuration and
final disposal. Views never dispose a shared service. Configure an implementation outside React,
keeping security settings fixed and using the request theme for palette variation.

Omitting the service retains the lazily imported Mermaid implementation, one queue across reviews,
strict configuration and protected directive keys. Its DOM measurement container is removed on abort
and after actual completion. Neither an AbortSignal nor the view's timer can preempt its synchronous
layout. The factory provides bounded admission and cooperative cancellation, not a hard CPU
deadline. A terminable service needs a real host-owned execution context supporting DOM measurement;
this package adds no worker assets, network loading or CSP exceptions.

## Emoji input

Every comment/reply composer, including edits, uses the same autocomplete. The actual MDEditor
textarea keeps its native multiline textbox semantics and receives `aria-autocomplete`,
`aria-haspopup`, `aria-controls` and `aria-activedescendant` while its named listbox is open. A
linked live status announces result position, name and keyboard instructions through
`LocalizationProvider` with English fallback. `aria-expanded` and the single-line combobox role are
deliberately omitted because they are not valid for the native multiline textbox pattern. Closed
popups remove their control/active-option relationships. IDs are scoped per composer.

Up/Down selects, Enter/Tab inserts and Escape dismisses without leaving the editor. Pointer
selection preserves textarea focus; insertion replaces only the live shortcode and restores the
caret. Caret movement, text selection, scrolling, blur and IME composition update or dismiss the
popup. Composition keys do not insert a suggestion or submit the composer. Legacy hook return
members and popup props remain valid; custom hook consumers can pass the additive `popupId` to the
popup and spread `textareaProps` onto the focused textarea.

## Attachments and browser capabilities

Paste, drop, and picker selections use one serial decoder queue per composer. A composer retains at
most eight selected/attached images and 30 MiB of input or attachment data. Individual inputs are
limited to 10 MiB, 16 megapixels and 8192 pixels per dimension. PNG, JPEG, GIF, WebP, BMP and ICO
headers must identify the dimensions within the first 64 KiB before decoding. Other formats or
unreadable headers produce a visible per-file error. Existing stored attachment payloads and display
formats are unchanged. Images are resized to fit 1920 pixels and decoded bitmaps are closed. Pending
work blocks comment/reply submission. Successful images survive another file's failure; only
explicit Retry repeats a failed job. Dismiss removes it. Source/session replacement or unmount
invalidates queued and late results. Browser bitmap decoding cannot be interrupted; cancellation
drops its result and closes the eventual bitmap. Header limits bound accepted image sizes, not
decoder CPU time or the browser implementation's internal allocations.

Attachment images open in a scoped, named dialog with Escape and focus return. Load/decode failures
have a Retry button. `ReviewAdapter.writeClipboard(text)` optionally supplies a host clipboard; omit
it to use the browser Clipboard API. Rejections are shown next to the file header.

Application strings use `LocalizationProvider` with English fallback. Supplied group names,
categories, review content and host diagnostics remain verbatim. Route counts use locale-aware
numbers/plurals; routes mirror in RTL. Scoped reduced-motion styles suppress animations and smooth
scrolling. Structural axe tests in jsdom do not check contrast, zoom, visual layout or real image
and diagram rendering; those require the host's browser/Electron checks.

## Rendering work limits

Raw diff highlighting admits at most 1000 lines and 100,000 input characters per file. Both sides of
a suggestion share the same budget. No individual line or Markdown code fence longer than 2000
characters goes through Prism. Split view may highlight each admitted context line twice, at most
2000 calls and 200,000 characters. All skipped content remains literal escaped text. A status
message identifies limited file highlighting. These are input/work bounds, not elapsed CPU deadlines
for Prism's grammar implementation.

Raw rows use `content-visibility: auto` with an intrinsic line height to let supporting browsers
defer offscreen layout/paint. Every source row, gutter and comment remains mounted, preserving the
native Find/full-document contract and existing line anchors, keyboard actions and drag handling.
Unsupported browsers render normally. DOM creation, indexing and text transfer remain proportional
to total source size and can still pause on extremely large expanded files. Ordinary virtualization
would remove searchable source. Incremental DOM insertion would also make Find/navigation depend on
preparation progress; neither change is introduced here. Browser measurements and native Find,
wrapped-line scrolling and drag checks remain host integration work.

Split alignment is memoized by the loaded hunk collection. Empty raw rows reuse stable comment
arrays and skip mounting a feedback component; a draft or existing thread still mounts at its
original anchor. This reduces repeated React work without withholding searchable source or changing
readiness. It does not bound source-row DOM allocation or promise an elapsed-time improvement.

Mermaid admission checks run before library import, parsing or layout. In addition to the existing
50,000-character source limit, layout accepts at most 8000 characters, 120 non-empty statements, 800
lexical tokens, nesting depth 12, 512-character statements/quoted labels and 256 relation-work
units. Relation work conservatively charges the square of a relation statement's identifier count,
including grouped endpoints, rather than counting arrows. Mermaid also receives a secured 64-edge
limit. These conservative bounds may refuse a valid diagram; its source stays visible and can be
reviewed directly. Rendering is serial, with at most eight active/queued jobs across package roots.
A cancelled queued job never starts layout; a stalled active job keeps its slot until the library
settles. Output is limited to 1,000,000 SVG characters before XML parsing, and sized images to
16,384 pixels per axis and 64 megapixels. Strict Mermaid configuration and SVG image isolation
remain.

The 10-second timer bounds waiting after the event loop yields. It cannot preempt synchronous DOM
measurement/layout. Cancellation removes the measurement container and discards late output; Retry
is manual. A Web Worker cannot run this renderer's `getBBox`/DOM measurements. Actual interruptible
layout needs a separately owned document/process with locally bundled assets and verified host CSP
and lifecycle handling in both Electron and the HTTP bundle. No CSP or Node integration changes are
made here. This package does not claim a hard CPU deadline for Mermaid.

## Comment disclosure and editor commands

Comment disclosure buttons expose their expanded state and control a unique region in each mounted
review. Collapsing a comment hides that region while retaining its editors, reply drafts and Apply
controls. Bulk collapse uses the same behavior within the owning review. Markdown toolbar names and
tooltips use the enclosing localization provider, with English fallback, while preserving the
editor's native commands and shortcuts. IME composition and emoji key handling retain precedence.

Raw unified and split layouts share hunk gap controls and source-derived comment placement. Their
row markup, side ordering and selection geometry remain separate. The content dispatcher keeps
loading, omission and manual retry outside preview/raw composition; neither branch mounts until
content is available. Legacy public eligibility flags and preview services retain their contracts.

## Scoped display commands and navigation

Every `ReviewProvider` owns transient file expansion and comment disclosure, including bare custom
compositions and `SingleFileReview`. No extra provider argument is needed. `useReviewExpansion()`
exposes `expanded`, `setExpanded(path, value)` and `setAllExpanded(value, paths?)`.
`useCommentDisclosure()` exposes `isCollapsed(id)`, `allCollapsed`, `setCollapsed(id, value)` and
`setAllCollapsed(value)`. The toolbar and file tree use these typed commands. Mixed file expansion
offers Expand all; mixed comment disclosure offers Collapse all.

Large payloads and reviews above 50 files start collapsed. Each path keeps the default it first saw
through same-identity updates, including when the payload size changes. A replacement resets display
state before any new file can load. Bulk comment disclosure also supplies the default for newly
arriving comments. Individual comment disclosure updates the toolbar action, and hidden reply drafts
and Apply state stay mounted. `SingleFileReview` now honors its file's disclosure button.

`useNavigationReview()` returns a read-only path index containing only `viewed` and `commentCount`.
Repeated reads retain the same map until those values or membership change. Unaffected entries keep
their references. Canonical file/review selectors use store-local indexes; body and reply edits do
not render the file tree or progress controls. The exported `FileSectionHeaderProps.comments`
remains required for existing deep-import callers; the internal presentation receives only its
count.

Guide chapter counts and route completion use separate cached viewed-path sets. Chapter counts use
the first canonical entry for a path; route completion accepts any viewed duplicate. Comment edits,
replies and comment counts do not change these snapshots. Context-only legacy guide compositions
retain the same duplicate rules through the complete review context.

One compatibility bridge accepts `toggle-all-sections` with `{ expanded: boolean }` and
`toggle-all-comments` with `{ collapsed: boolean }`. Dispatch at the owning
`[data-review-display-root]`. Existing direct dispatch at a `ConfigProvider`'s `.self-review`
container remains supported when it contains exactly one review root. A container shared by several
reviews cannot identify the intended review, so its bulk events are ignored. Window/document events
are not review commands. Nested and sibling review roots remain isolated; first-party controls do
not emit DOM bulk events.

Built-in image and SVG preview failures use the localization catalog and named alerts. Image loading
has a named status. Host diagnostics remain visible below the localized failure message. Native
image decode failures now show an alert, and null image results remain failures. Previews retain
passive image data URIs and the original file path as their accessible identity.
