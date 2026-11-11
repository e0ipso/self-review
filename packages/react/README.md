# React host integration

`ReviewProviders` exports the provider order used by `ReviewPanel`. Pass `adapter`, optional
`config`, and the existing `ReviewProvider` options `initialFiles`, `initialSource`, and
`initialComments`. Children can render host chrome, a welcome/loading view, or `Layout`, and can
call all review, guide, configuration and navigation hooks. The provider adds no layout or keyboard
manager. Keep adapter identity stable. Static files suppress diff loading and diff subscriptions;
initial comments hydrate once. `ReviewPanel` retains its children and imperative handle contracts.

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
