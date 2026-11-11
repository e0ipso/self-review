# React host integration

`ReviewProviders` exports the provider order used by `ReviewPanel`. Pass `adapter`, optional
`config`, `initialOutputPath` for the host output target, and the existing `ReviewProvider` options
`initialFiles`, `initialSource`, and `initialComments`. Children can render host chrome, a
welcome/loading view, or `Layout`, and can call all review, guide, configuration and navigation
hooks. The provider adds no layout or keyboard manager. Keep adapter identity stable. Static files
suppress diff loading and diff subscriptions; initial comments hydrate once. `ReviewPanel` retains
its children and imperative handle contracts.

`ReviewAdapter.onResumeLoad(callback)` is an optional later-push subscription. Emit each payload
after its owning diff push. It supersedes an outstanding initial resume request; disposed
subscriptions and late responses cannot mutate a replacement session. Existing adapters using only
`loadResumedReview` continue to work. Hosts must not emit an old session's resume after a new
session's diff, because the existing resume payload contains no session identifier.

`ConfigAdapter` remains exported for source compatibility but is deprecated. Components never
consumed it. Load configuration in the host and pass the result through a config prop or provider.

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
