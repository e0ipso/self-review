# @self-review/serve

Runs the [self-review](../../README.md) interface in your browser instead of an Electron window.
Useful when a desktop app is not an option: a remote box, a container, a machine with no display.

It is the same review engine (`@self-review/core`) and the same UI (`@self-review/react`) as the
desktop application. Only the transport differs: HTTP and a browser tab in place of IPC and a
window.

## Client read cancellation

The browser adapter supplies the optional `ReviewAdapter.reads` capability for lazy hunks, context
expansion, reviewed images and comment attachments. Caller cancellation composes with the page
lifetime and the read deadline, including response-body consumption. A pre-aborted read sends no
HTTP request. Disposal, success, failure and cancellation release listeners and deadline timers. The
capability remains in memory and authorization headers are preserved.

The original adapter methods and the requester's three- and four-argument call forms remain
supported. Read failures require an explicit retry. Publication and source Apply retain their
mutation semantics, including unknown outcomes and no automatic replay.

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

An Apply acknowledgement must carry the existing applied/refused discriminator, the requested file
path and all fields of that outcome. An applied result also needs a nonnegative integer
`replacedLines`; a refusal needs string `reason` and `detail` fields. An empty or malformed 2xx
reply keeps Apply locked behind the inspection step, including after collapsing the file.

A timeout, lost connection, malformed acknowledgement, or unexpected server error after sending a
mutation can leave its outcome unknown. The page says so instead of claiming that nothing was
written. After an uncertain Finish Review, the submitted snapshot stays locked and the close warning
stays, and Finish Review is unavailable to prevent a blind duplicate submission. Check the terminal
and the output file, stop the original process, and restart with `--resume-from` if the review was
saved. An uncertain Apply likewise requires checking the destination before continuing. Mutations
are never retried automatically. A publisher's explicit refusal remains safely retryable.

Closing the tab warns you after comments or viewed flags change, including deleting the last resumed
comment or clearing a viewed flag. The warning stays until the server acknowledges the save. Your
work lives only in that page until you finish, so closing without finishing loses it.

Only one submission can publish at a time. An overlapping authenticated `POST /api/review` receives
`409` with `{"error":"review submission already in progress or complete"}`. A failed attempt permits
retry. Successful acknowledgement still means the XML is on disk. After flushing that response, the
listener stops accepting connections and drains admitted operations and their responses for up to
five seconds before closing remaining connections. Exit 0 follows once admitted work and cleanup
settle; a pending native operation may delay final exit beyond that grace period. SIGINT and SIGTERM
use the same shutdown owner, including during startup and listener creation, and exit with 130 and
143 respectively. An observed signal takes precedence over completion success. Startup has a
45-second deadline, and its git commands have a 30-second timeout. With the current core,
cancellation reaches git, snapshot reads, directory and file loading, attachment preparation, and
asynchronous asset staging. Publication accepts at most 1,000 attachment occurrences, 10 MiB per
image and 64 MiB of newly staged assets, including resumed references that need copying. These
disk-derived limits are independent of the HTTP body limit. Cancellation does not roll back a
committed file. Synchronous/native work can still delay event-loop callbacks; the grace period is
not hard preemption of arbitrary code.

The listener accepts at most 64 TCP connections, including idle keepalive connections and peers that
have not finished sending HTTP headers. Excess connections close before parsing a request or logging
its bytes. Programmatic `createReviewServer` callers may supply a positive integer `maxConnections`;
the CLI uses 64. Normal keepalive, the 15-second header deadline and the 60-second request deadline
remain in effect.

Static bundle files stream from one opened regular-file descriptor per request in chunks of at most
64 KiB, waiting for response backpressure before reading more. Each asset is limited to 32 MiB; a
larger file receives `413` with `{"error":"static asset exceeds 32 MiB limit"}` before successful
headers. This limit accommodates the bundled scripts, styles, fonts and diagrams. The original file
size fixes both Content-Length and the read range, so file growth cannot extend the response. A
failed or shortened read after headers closes the response as incomplete. Missing files, directories
and unsafe paths retain the quiet `404` response. Unexpected I/O failures receive a generic `500`
and go to the injected diagnostic reporter. Containment inspection uses asynchronous metadata calls
before opening and during the inode recheck, with cancellation checkpoints between calls.
Missing-path inspection removes one requested path component per lookup and never enumerates a
directory. Descriptor opens use no-follow and nonblocking flags, reject non-regular files, and
recheck containment and inode identity. Disconnect, request expiry and shutdown cancel reads and
backpressure waits. Admission retains the operation until the descriptor closes and the response
settles. Already issued filesystem calls and kernel socket buffers may finish after cancellation;
cancellation does not preempt native I/O.

The server admits at most 32 operations and responses in total, with at most eight concurrent
expensive DTO, image or attachment reads. Excess requests receive `503` with
`{"error":"review server busy; retry after pending requests finish"}` before engine work starts.
This refusal is safely retryable. Apply, context expansion and publication are mutually exclusive. A
competing publication retains the existing `409` response above; a competing Apply or expansion gets
`409` with `{"error":"review source mutation or publication already in progress"}`. Wait for the
active operation before retrying. Publication cannot overtake an admitted source mutation.

Diff, file, config, resume, image and context-expansion JSON responses use bounded data-only DTO
encoding. Each response is limited to 64 MiB of encoded UTF-8, 2,000,000 visited values or object
properties, and 128 nesting levels. Limits include escaping and repeated references. A measuring
pass checks these bounds before successful headers; an over-limit DTO receives `413` without
omitting hunks. Encoding checks cancellation and yields after 2,048 tokens or 256 KiB of encoded
work. A second pass streams chunks to the socket and waits for backpressure. It applies the same
bounds again, so concurrent growth cannot extend delivery indefinitely. An encoding failure after
headers destroys the incomplete response. Admission stays owned until encoding and response cleanup
settle. Small Apply/publication acknowledgements and errors use the separate small-response writer,
which serializes before sending headers.

These limits bound transport encoding, not the engine's existing loaded representation. Native
string operations, object-key enumeration, JSON parsing and garbage collection cannot be preempted
by a JavaScript deadline. The supported older engine also retains the synchronous limitations below.

Each admitted request has a 60-second server deadline. Expiry cancels supported work and answers
`503` with `{"error":"request deadline exceeded; operation outcome may be unknown"}` if headers have
not been sent, or closes a response already in progress. Disconnecting cancels the request's owned
work too. An operation keeps its admission slot until both work and response settle, including when
a filesystem operation ignores cancellation. Shutdown stops accepting and cancels admitted
operations, then closes remaining connections after five seconds. Owned operations and cleanup
remain joined until they settle before process exit. Each expiry reports one bounded diagnostic with
the operation kind and elapsed milliseconds. It includes no request path, query, body or session
key. Disconnect and shutdown cancellation do not produce deadline diagnostics. Static responses
close on expiry rather than returning JSON, including before headers.

Suggestion Apply requests have a separate 32 MiB JSON UTF-8 budget for original and proposed code,
matching the review upload budget. The browser refuses larger suggestions before sending them with
code `suggestion-too-large`; the server enforces the same bound. Desktop and library callers keep
their existing capabilities. When the installed core exports `applySuggestionForSessionAsync`, serve
awaits that writer with the request's `signal`. Its default destination input and output limits are
each 5,242,880 bytes, independent of the HTTP budget; exceeding either resolves as a typed engine
refusal. With core 2.0.4, serve uses the existing synchronous writer, which blocks and cannot
interrupt an in-progress write. The compatibility shim can be removed once the published minimum
core dependency provides the async operation. Context expansion requests retain their 64 KiB bound.

Programmatic `createReviewServer` callers may supply a per-instance `reportDiagnostic(message)`
callback for submission success, known publication refusals, transport failures and deadlines.
`createPublicationOperations` also forwards its supplied reporter to Core publication diagnostics.
An installed older Core may still send its own diagnostics to stderr if it ignores that option.
`ReviewSubmission` also accepts it as an optional second constructor argument.
`createServeLifecycle` and `completeReviewOnSubmit` accept `reportDiagnostic` for completion and
shutdown-deadline messages; the CLI binds the same host reporter to its lifecycle. Defaults retain
the existing stderr messages and argument shapes. Reporter throws, rejected promises and pending
thenables are observational: they cannot change a committed success or interrupt exit code, delay
connection closing or owned cleanup, reopen completed admission or retry a write. Synchronous
reporter code must return control to the host; it cannot be preempted.

Core 2.0.4 remains a supported installed peer. On that peer, startup prints diagnostics for the
synchronous startup probe and Apply, local loading without signal support, and publication without
an aggregate disk-asset budget or cooperative staging cancellation. The old startup probe and Apply
block the event loop. A deadline or signal cannot interrupt them or enforce the shutdown grace while
they run. Serve checks cancellation before invoking legacy Apply and returns its actual outcome
afterward, including a committed success, without replay. If the response is lost, inspect the
destination before continuing. A synchronous wrapper cannot add interruption to that writer.

Serve bundles the canonical pure DTO validator and request decoder from the focused
`@self-review/core/validation` build entry. Only that entry is inlined; the root engine stays an
installed runtime dependency, so core 2.0.4 needs no new export. Current installed validators and
decoders are selected when present. Bundled validation failures are translated to the installed
root's `ReviewXmlError` class so existing error handling keeps its class identity.

This validator enforces the current attachment count and in-memory byte limits before session
storage on both peers. It cannot bound old core's disk-derived publication reads or add cancellation
inside the old writer. The runtime compatibility selectors must stay until a published minimum core
provides asynchronous startup/loading, asynchronous Apply and bounded cooperative publication. Then
raise that minimum and remove the corresponding fallbacks together. No unpublished minimum is
required today.

Apply's transport validation checks containers, primitive types and anchor side. A null anchor,
zero/fractional line number or inverted numeric range reaches core and resolves as its typed refusal
with HTTP 200, matching the desktop adapter. Reviewed-path authorization and the exact original-code
check still apply. Context expansion retains its 99,999-line limit.

A submitted source must match the loaded source kind and its required path, or its repository and
git diff arguments. Property order and supported source extension metadata do not affect ownership.
A mismatch receives a recoverable `422` validation refusal before cached state, XML or assets
change. Remote provenance and resumed attachment origins always come from the owned session.

Only missing attachment files receive `404` and become null in the browser. Unauthorized references,
unsafe links and non-regular files receive `400`, oversized files receive `413`, and operational I/O
failures receive `500`, preserving the useful read error.

Request JSON is decoded as strict UTF-8 after the complete bounded body arrives. Invalid byte
sequences receive the existing generic `400` `{"error":"body must be valid JSON"}` before review
publication, Apply or other operation execution. Valid multibyte characters may span request chunks;
encoded U+FFFD remains valid text. A leading UTF-8 BOM still receives the same refusal. Media type,
byte caps and cancellation handling are unchanged.

Nested review JSON is validated after attachment decoding and before it enters the session.
Malformed containers, source kinds, anchors and optional metadata receive a recoverable `400`
`{"error":"Invalid review state: ..."}`; publication still performs XML validation. Each comment's
`filePath` must exactly match its containing file's `path`, including the empty review-level path.
This check also runs through the bundled pure validator when the installed peer is Core 2.0.4; its
failures retain that peer's error class.

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
effect until you restart it. Programmatic startup may supply a launch directory, diagnostic reporter
and the six startup effect operations as the optional third `resolveSession` argument; existing one-
and two-argument calls still use process cwd and stderr. The CLI supplies these explicitly.
Configured guide paths resolve against that launch directory, including with core 2.0.4, whose
loader ignores the optional fourth argument. That peer still sends its own guide diagnostics to
stderr rather than the injected reporter.

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

## Engine and transport contracts

Current Core image-read diagnostics use the host's supplied reporter as well. Published Core 2.0.4
ignores that optional reporter and retains stderr output for image refusals.

Recognized API routes return `405` for an unsupported method with an `Allow` header listing only the
methods registered for that path. Host, origin and session-key checks still run first. This does not
add HEAD or OPTIONS handlers.

The CLI resolves installed Core capabilities once into a normalized engine contract. Core 2.0.4
remains supported without disabling Apply, resume or publication. Its synchronous source probe,
local loading and Apply can delay cancellation; its publication lacks the newer aggregate asset
budget and cooperative staging cancellation. The CLI reports those limitations at startup. Pure
request validation stays bundled, and fallback errors retain the installed Core error class.

`resolveServeEngine` accepts the capabilities its selectors use. Its `.core` retains the supplied
object and all inferred members, and the original `ServeEngine` and resolver return types retain the
complete root namespace. `createPublicationOperations` takes only its read, Apply, validation and
publication roles. It binds `requestValidation` and the publication error constructor from that same
engine. Route construction uses those validators for review, Apply and context requests. Original
operation sets may omit the added roles and retain the installed-engine defaults. The exported
`parseReviewStateBody`, `parseSuggestionApplyBody` and `parseExpandContextBody` remain default
compatibility entry points with the same strict field policy and error text.

Startup forwards its host reporter through `loadConfigWithProvenance` options. Reporter throws and
rejections cannot change loaded configuration or provenance. Core 2.0.4 ignores this option and
keeps its own configuration diagnostics on stderr, as it does for guide and image diagnostics.

First-party transport construction uses `createBoundReviewServer` with bound read operations and an
explicit publication role from `createPublicationOperations`. Publication owns its supplied state
and does not first mutate the session's handoff cache. The existing `createReviewServer` overloads,
`createReviewOperations`, `SubmissionOperations` and `ReviewSubmission` constructor retain the
original submit-then-publish sequence, including custom handoff side effects. The transport and
publication reporter contains both synchronous throws and asynchronous rejections; default route
failure details still go to stderr.

Startup's original required synchronous `loadResumeDocument` operation keeps its type and behavior
for injected operation sets. The optional `loadResumeDocumentAsync` takes the startup signal and
deadline. When replacing operations from a first-party host, clear that optional member to select
the original synchronous path. `createStartupHost` selects it for the CLI. It reads and parses XML
in a worker emitted as `dist/resume-parser-worker.js` beside `cli.js`, resolved relative to that
module, before loading the guide or opening the listener. Every success, error, deadline and
cancellation reaps that worker before adopting a result. Replacing an owner must abort its signal;
an optional `isCurrent` guard also refuses stale replies. Termination may wait for a native syscall.
Attachment-origin adoption still performs bounded synchronous metadata inspection on the host
thread. For Core 2.0.4, a small compatibility projection uses its public `recordResumedAttachments`;
no path or authorization policy is copied into serve.

Browser reads validate diff, guide, config, resume, lazy hunks, context and image DTOs before
delivery. A malformed read rejects with `malformed-read-response`, preserving existing data and
subscriptions for explicit repair. Valid null responses, optional fields, extension metadata,
duplicate paths and the full Core line budgets remain supported. Generic JSON helper call forms
remain available. Admission busy responses preserve their original error text and add
`code: "server-busy"`. Modern clients classify that code only on HTTP 503. The exact old uncoded
busy response remains supported by an isolated legacy policy; other failures keep mutation outcomes
uncertain and are never replayed.

The one-shot owner and resume reply policy are bundled from the build's
`@self-review/core/resume-worker` subpath. The installed Core root stays external, including with
Core 2.0.4; workers and hosts reconstruct detailed XML failures with that peer's constructors.
Timeouts omitted or set to zero use 30 seconds. Positive fractions round up to milliseconds and
large values clamp at 2,147,483,647 ms; negative and nonfinite values reject. The desktop host now
accepts these same forms. Cancellation never settles before termination. If termination itself
rejects, release is unconfirmed and the owner reports a termination failure retaining the original
failure/cancellation as its cause. Native syscalls can delay worker termination.

`createBoundApiRoutes` requires bound operations and complete request validation. It does not select
an engine or construct validators. Server composition supplies the operations' selected validation;
the original `createApiRoutes` facade and operation sets without `requestValidation` use the
compatibility composition factory. An explicit fourth validator still takes precedence. All original
server overloads remain available. Operations replaced after route construction remain observable.

The HTTP body cap applies to bytes received from the client. A resumed attachment reference can name
up to 10 MiB of disk content without sending those bytes in the request. Published Core 2.0.4 owns
those reads internally and has no aggregate publication budget or cooperative staging cancellation.
Pure request validation cannot derive authoritative disk sizes from references, and an extra host
filesystem probe would neither cover virtual effects nor prevent a later file change. Serve keeps
that peer's publication support and startup warning. Current Core enforces its aggregate budget
inside the authoritative reader and writer, preserving the prior document on refusal.
