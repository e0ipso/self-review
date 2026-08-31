---
id: 2
group: "serve-mode"
dependencies: [1]
status: "completed"
created: 2026-08-28
skills:
  - node-http
  - typescript
complexity_score: 6
complexity_notes: "Server and process-lifecycle design on the standard library; no framework to lean on and the exit semantics are load-bearing."
execution_profile: "complex-architecture"
---
# Add the serve-mode HTTP server bootstrap, CLI flags, and session lifecycle

## Objective
Stand up the serve-mode process: parse the serve flags and `--output`, resolve the diff,
guide and configuration at startup exactly as the Electron main process does, serve the built client
assets as static files, bind loopback, and own session end.

## Skills Required
`node-http` to build the listener, routing and static file serving on the standard
library, and `typescript` for the CLI wiring in the existing argument parser.

## Acceptance Criteria
- [x] `self-review serve --output=<path> <base>` starts a listener and prints the URL it is reachable at.
- [x] The server binds `127.0.0.1` by default; an optional host and port may be supplied with the flag.
- [x] Diff, guide and configuration are resolved during startup using the module from task 1, before the listener accepts requests.
- [x] Built client assets are served as static files, with an unknown path falling back to the client entry document.
- [x] `GET /api/config` returns the resolved configuration including the output path, marked read-only.
- [x] `POST /api/review` writes the XML via the same `@self-review/core` serializer the desktop app uses, responds, and then stops the server so the process exits.
- [x] Nothing is written to the output path before a review is submitted.
- [x] An unwritable `--output` path fails at startup with a clear message, not after a completed review.
- [x] Runnable: `self-review serve --output=/tmp/t.xml` then `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/api/config` prints `200`.
- [x] Runnable: `git diff package.json` shows no addition to `dependencies`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`node:http` only — no new runtime dependency. CLI flags extend the existing parser in
`src/main/cli.ts`. `output-file` already exists as a configuration key resolved against the working
directory in `src/main/main.ts`; `--output` surfaces that existing value rather than introducing a
new one.

## Input Dependencies
Task 1's transport-agnostic handler module, used for startup resolution and for the
review-submission path.

## Output Artifacts
A runnable serve-mode entry point with static serving, configuration and lifecycle in
place, into which task 3 adds the remaining data routes.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

Build on `node:http`. The project's PRE_PLAN guidance asks for minimal dependencies
while warning against reinventing wheels; roughly ten routes with no middleware needs sit inside the
standard library, and adding a server framework to a desktop application that otherwise has none is
not justified at this size. If you find yourself wanting a router abstraction, a switch on
`req.method` and `req.url` is sufficient and is what the plan intends.

Startup order matters and mirrors Electron's: resolve configuration, resolve the diff, resolve the
guide, and only then listen. `src/main/guide-loader.ts` documents that guide discovery is one-shot
and resolved from the startup output path — keep that property. Do not re-discover the guide later.

Session end is the part to get exactly right. `POST /api/review` must: write the XML, respond
successfully, and then close the server so the process exits. Respond BEFORE closing so the browser
receives the response; closing first produces a failed request on a review that actually succeeded.
Nothing is auto-saved at any other point, which matches the desktop application discarding on quit
unless the reviewer saves. A closed tab therefore costs nothing.

Validate the output path at startup — attempt to establish writability before listening — so a
reviewer never completes a review only to discover it cannot be saved. This is called out in the
plan's Self Validation and is not optional.

Bind `127.0.0.1`. In the motivating environment the VM's port forwarding carries the connection to
the host, so loopback is sufficient. Do not add an option to bind a routable interface: the plan
places that out of scope precisely because it would require an authentication design this work does
not attempt.

</details>

---

**Shipped as `serve`, not `--serve`.** This task was executed against the flag form. Review
feedback afterwards moved it to a subcommand with `--address`, matching `fetch-comments`, so the
criteria above read against the shape as built at the time. See the plan's follow-ups.
