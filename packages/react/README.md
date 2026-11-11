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
