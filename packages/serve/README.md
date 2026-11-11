# @self-review/serve

Runs the [self-review](../../README.md) interface in your browser instead of an Electron window.
Useful when a desktop app is not an option: a remote box, a container, a machine with no display.

It is the same review engine (`@self-review/core`) and the same UI (`@self-review/react`) as the
desktop application. Only the transport differs: HTTP and a browser tab in place of IPC and a
window.

## Run it

```bash
npx @self-review/serve --staged
```

Or install it if you use it often:

```bash
npm install -g @self-review/serve
self-review-serve --staged
```

Anything that is not one of the flags below goes straight to `git diff`. With no arguments you
review the unstaged working tree. Outside a git repository, pass a directory or a file.

```bash
npx @self-review/serve                          # unstaged changes
npx @self-review/serve --staged
npx @self-review/serve main..feature-branch
npx @self-review/serve --resume-from review.xml # continue a previous review
```

| Flag                   | What it does                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `-o, --output <file>`  | Where to write the review. Defaults to `./review.xml`, or `output-file` from `.self-review.yaml` |
| `--resume-from <file>` | Load a previous review and carry its comments in                                                 |
| `-h, --help`           | Print usage                                                                                      |
| `-v, --version`        | Print the version                                                                                |

`--output` and `--resume-from` also take the `--flag=value` form. A `--` ends these flags:
everything after it goes to `git diff` as written, and so does the value of a git option that takes
one, so `-S --output` searches for the text `--output`. The same rules apply to the desktop command
line.

## Run it from a checkout

If you have this repository cloned and want to try a change, one script from the repository root
builds and runs it. Arguments after `--` go to the program:

```bash
npm run start:serve -- --staged
npm run start:serve -- main..feature-branch -o /tmp/review.xml
```

That mirrors `npm start` for the desktop application, and takes a single `--` where the desktop
needs two. It always rebuilds first, which is a few seconds and is the point: `dist/` is not in git,
so running `dist/cli.js` on a fresh clone without building fails with `ERR_MODULE_NOT_FOUND`. The
build covers `@self-review/core` and `@self-review/react` as well as the server and the browser
bundle.

The build reviews whatever repository _this_ checkout is, because npm runs the script from the
package root. To review a different repository, install the package and run `self-review-serve`
there.

To skip the rebuild when you know `dist/` is current, call it directly:

```bash
node packages/serve/dist/cli.js --staged
```

`npm run dev --workspace @self-review/serve` watches the server only. Changes to anything under
`src/client` need `npm run build:client --workspace @self-review/serve` to show up in the browser.

## What to expect

The URL goes to stderr when the process starts. Open it in a browser, exactly as printed:

```
[serve] Review ready at http://127.0.0.1:41873/#cap=Qm9vIHRoaXMgaXMgbm90IGEgcmVhbCBrZXkgZWg
```

The part after `#` is this session's key. See [Access control](#access-control) for what it does and
how to carry it over an SSH forward; the short version is that the page needs it, a reloaded or
retyped address does not have it, and a lost URL means stopping the process and starting it again.

The output path is set once, when the process starts, by `-o` or by `output-file` in your config. No
route and no browser control changes it afterward.

Finishing the review writes that file and stops the process. The page says "Review saved" only once
the file is on disk: the server publishes the document before it answers, so that screen is a
written file, not a promise of one. The port closes right after, so there is no second review from
the same process: if you want to keep reviewing, start it again with `--resume-from`.

If the file cannot be written — the path has become a directory, the disk is full, the directory is
no longer writable, a symbolic link sits where the file should go — nothing stops. The page keeps
the review exactly as it was, shows the server's own error with its code (`output-is-directory`,
`no-space`, `permission-denied`, `unsafe-link`, ...), and the same lines go to the terminal. Fix the
problem and press Finish Review again; the retry sends the same review, and the close guard below
stays up until a save has been acknowledged. The output path itself cannot be changed from the
browser, so a path that can never work means stopping the server and starting it with another
`--output`.

A review over 32 MB on the wire is refused before it is sent, with its size in the message. Image
attachments are the usual cause — they travel base64-encoded, which adds a third — so remove or
shrink some and finish again. A server-side `413` for the same reason is reported the same way.

While Finish Review is pending, the review controls and keyboard shortcuts are blocked so the
submitted snapshot stays unchanged. A refusal restores editing with the review intact. Read requests
have a 30-second deadline, and Apply and Finish Review have a 60-second deadline, including reading
the response body. Failed initial diff loads can be retried; the retry also loads the walkthrough
guide.

A timeout, lost connection, malformed acknowledgement, or unexpected server error after sending a
mutation can leave its outcome unknown. The page says so instead of claiming that nothing was
written. After an uncertain Finish Review, comments remain editable and the close warning stays, but
Finish Review is unavailable to prevent a blind duplicate submission. Check the terminal and the
output file, stop the original process, and restart with `--resume-from` if the review was saved. An
uncertain Apply likewise requires checking the destination before continuing. Mutations are never
retried automatically. A publisher's explicit refusal remains safely retryable.

Closing the tab warns you after comments or viewed flags change, including deleting the last resumed
comment or clearing a viewed flag. The warning stays until the server acknowledges the save. Your
work lives only in that page until you finish, so closing without finishing loses it.

Only one submission can publish at a time. An overlapping authenticated `POST /api/review` receives
`409` with `{"error":"review submission already in progress or complete"}`. A failed attempt permits
retry. Successful acknowledgement still means the XML is on disk. After flushing that response, the
listener stops accepting connections and drains admitted operations and their responses for up to
five seconds before closing remaining connections and exiting 0. SIGINT and SIGTERM use the same
shutdown owner, including during startup and listener creation, and exit with 130 and 143
respectively. An observed signal takes precedence over completion success. Startup has a 45-second
deadline, and its git commands have a 30-second timeout. Cancellation reaches supported git and
snapshot operations. Local directory scanning, attachment filesystem reads, publication and
previous-core synchronous operations cannot be interrupted while in progress; they are drained until
the grace period expires. Cancellation does not roll back a committed file.

The server admits at most 32 operations and responses in total, with at most eight concurrent
expensive image or attachment reads. Excess requests receive `503` with
`{"error":"review server busy; retry after pending requests finish"}` before engine work starts.
This refusal is safely retryable. Apply, context expansion and publication are mutually exclusive. A
competing publication retains the existing `409` response above; a competing Apply or expansion gets
`409` with `{"error":"review source mutation or publication already in progress"}`. Wait for the
active operation before retrying. Publication cannot overtake an admitted source mutation.

Each admitted request has a 60-second server deadline. Expiry cancels supported work and answers
`503` with `{"error":"request deadline exceeded; operation outcome may be unknown"}` if headers have
not been sent, or closes a response already in progress. Disconnecting cancels the request's owned
work too. An operation keeps its admission slot until both work and response settle, including when
a filesystem operation ignores cancellation. Shutdown stops accepting and cancels admitted
operations, then drains them for up to five seconds.

Suggestion Apply requests have a separate 32 MiB JSON UTF-8 budget for original and proposed code,
matching the review upload budget. The browser refuses larger suggestions before sending them with
code `suggestion-too-large`; the server enforces the same bound. Desktop and library callers keep
their existing capabilities. When the installed core exports `applySuggestionForSessionAsync`, serve
awaits that writer with the request's `signal`. Its default destination input and output limits are
each 5,242,880 bytes, independent of the HTTP budget; exceeding either resolves as a typed engine
refusal. With core 2.0.4, serve uses the existing synchronous writer, which blocks and cannot
interrupt an in-progress write. The compatibility shim can be removed once the published minimum
core dependency provides the async operation. Context expansion requests retain their 64 KiB bound.

Apply's transport validation checks containers, primitive types and anchor side. A null anchor,
zero/fractional line number or inverted numeric range reaches core and resolves as its typed refusal
with HTTP 200, matching the desktop adapter. Reviewed-path authorization and the exact original-code
check still apply. Context expansion retains its 99,999-line limit.

Nested review JSON is validated after attachment decoding and before it enters the session.
Malformed containers, source kinds, anchors and optional metadata receive a recoverable `400`
`{"error":"Invalid review state: ..."}`; publication still performs XML validation.

The desktop application asks the same question with better options, offering to save on the way out.
A browser will not let a page do that: `beforeunload` is a yes or no prompt whose wording belongs to
the browser. Nothing is auto-saved in either front end.

The server keeps listening after you close the tab. Nothing tells it you left, so stop it with
Ctrl-C if you are not coming back.

## Walkthrough guides

Guides work the same way they do in the desktop application. If a guide sidecar sits next to your
output path, `review.guide.xml` for the default `review.xml`, it is picked up when the process
starts and the file tree opens in guided mode. Generate one with the `self-review-guide` skill
before starting the server.

The guide is read once at startup. Writing a sidecar while the server is already running has no
effect until you restart it.

## Access control

Three things keep the review yours: the listener binds to `127.0.0.1`, it refuses requests that name
anything but itself, and every API request has to carry this session's key.

### The session key

Each start draws a fresh key — 32 random bytes — and prints it once, as the `#cap=...` fragment of
the launch URL. That is the only copy the server ever gives out. A browser never sends a URL's
fragment anywhere: not in the request, not in `Referer`, not to a proxy. The page reads the key from
the fragment when it loads, keeps it in memory, and removes it from the address bar at once, so a
reload, a bookmark or a copied address does not carry it. From then on, every request the page makes
presents the key as `Authorization: Bearer ...`, and the server answers `401` to any `/api/` request
that does not. The page and its scripts are served without the key and contain nothing about it.

This is what separates you from another account on the same machine. Loopback is not scoped to a
user: anything on the host can connect to the port and name it correctly in `Host`, and before the
key that was enough to read the diff, read files under the repository, apply suggestions into it and
finish the review on your behalf. Now such a client gets `401` and nothing else.

A page opened without the fragment — reloaded, retyped, followed from a link that dropped it — shows
"Open the URL printed in the terminal" instead of the review. Copy the URL from the terminal again
and open it in that tab. If the URL is gone, so is the key: stop the process and start it again, and
a new URL is printed. The key is never written anywhere, so there is nothing to recover it from, by
design.

### Web pages

A _web page_ is a different matter, and binding to loopback on its own does not cover it: a page you
visit can make requests to a loopback port, and DNS rebinding — a hostname the page's author
controls, re-pointed at `127.0.0.1` after the page loads — would make those requests same-origin as
far as the browser is concerned. So the server also refuses any request whose `Host` or `Origin`
names something other than this listener, which is what separates a rebound request from a real one.
That check runs before the key is looked at, and a page that got past it would still need the key.

The page itself is served with a content security policy that forbids frames, plugins, inline script
and any origin but its own, and every response carries `Referrer-Policy: no-referrer`. That matters
because the page renders the diff under review, and reviewing code you do not trust yet is the whole
point of the program: rendered Markdown and HTML are sanitized before they become elements, and the
policy is the layer that holds if something gets past that.

### Over SSH

An `ssh -L` forward works and is the expected way to reach this from elsewhere. Forward the port the
process printed, then open the printed URL against the forwarded port, keeping the fragment:

```bash
# on the remote box
self-review-serve --staged
# [serve] Review ready at http://127.0.0.1:41873/#cap=Qm9vIHRoaXMgaXMgbm90...

# on your machine
ssh -L 9999:127.0.0.1:41873 devbox
# then open http://127.0.0.1:9999/#cap=Qm9vIHRoaXMgaXMgbm90...
```

Only the hostname in `Host` is checked, never its port against the port the process bound, so the
forward's own port is fine, and the key rides in a header the tunnel carries like any other. Reach
the forward by a name that is not loopback — an `ssh -L -g` bound on an interface and browsed as
`http://devbox:9999` — and it refuses, as it should. So does anything terminating HTTPS in front of
it.

`docker run -p` does **not** work, and cannot: the listener binds `127.0.0.1` inside the container's
network namespace, which a published port has no route to. Reaching a containerised review means a
forward into the namespace, not a published port.

Anyone who can reach the forwarded port _and has the URL_ has the same access you do. The key is a
session secret, not a login: treat the printed URL like a password, and securing the tunnel is still
yours to do.
