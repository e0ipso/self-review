---
id: 3
group: "serve-mode-node-cli-package"
dependencies: [1, 2]
status: "completed"
created: 2026-09-09
skills:
  - node-http
  - typescript
complexity_score: 6
complexity_notes: "Eight routes across the core API boundary plus static asset serving. Each route is individually trivial; the integration surface is what earns the score. Splitting per route would produce eight tasks that cannot be tested independently of the server."
execution_profile: "complex-architecture"
---
# The HTTP server and its eight routes

## Objective
Serve the review session over loopback HTTP: eight JSON routes, each validating
its input and then calling a function `@self-review/core` already exports, plus
static serving for the client bundle.

## Skills Required
`node-http` for the server; `typescript` for the route handlers.

## Acceptance Criteria
- [ ] A server built on `node:http` with no framework and no new runtime dependency in `packages/serve/package.json`.
- [ ] These eight routes exist and each returns the shape its core function produces: `GET /api/diff`, `GET /api/config`, `GET /api/resume`, `GET /api/file?path=`, `GET /api/image?path=`, `GET /api/attachment?path=`, `POST /api/expand-context`, `POST /api/review`.
- [ ] `GET /api/diff` returns the guide alongside the diff, so the client needs no second request and no server-initiated channel.
- [ ] Every route calls task 2's validators before reaching any core function; a malformed request returns 4xx and no core function runs.
- [ ] The listener binds to `127.0.0.1` only. A request to the machine's non-loopback address is refused.
- [ ] Static assets for the client are served from exactly one location, with no branch for a packaged-desktop layout.
- [ ] Tests drive the server over real HTTP and assert both success shapes and rejection of malformed input.
- [ ] `npm run test:unit --workspace @self-review/serve` exits 0.

## Technical Requirements
The handlers in `@self-review/core` take their session explicitly and read no
module-scope state, which is what makes them safe to hang off a request. Hold one
`ReviewSession` from `createReviewSession` for the process lifetime and pass it
into each handler.

Routes map to core exports as follows: `getDiffLoad`, `getConfigLoad`,
`getResumeLoad`, `getFileHunks`, `loadImage`, `readAttachment`, `expandContext`,
`submitReviewState`. All eight are exported from `packages/core/src/index.ts`;
verify with `grep` before writing against them.

## Input Dependencies
Task 1's package; task 2's validators, which every route must call.

## Output Artifacts
The server module and its route handlers, started by task 4 and consumed by
task 5's client.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. `packages/serve/src/server.ts` exporting a factory that takes a `ReviewSession` and a repository root and returns an `http.Server`. Taking them as arguments rather than reading module state is what makes the server testable without a real repository.
2. Route dispatch on `req.method` and `new URL(req.url, 'http://localhost').pathname`. A small table mapping method+path to a handler is enough; do not add a router dependency.
3. For each path-bearing route, read the parameter with `searchParams.get('path')` — already decoded once — then pass it through `containPath` from task 2. On `null`, respond 400 and return before touching core.
4. For `POST /api/expand-context`, read and JSON-parse the body, then run `parseExpandContextBody`. On failure respond 400. Cap the body size; an unbounded read is a trivial denial of service on a long-lived process.
5. `GET /api/diff` returns `{ diff, guide }` — call `getDiffLoad` and the guide resolution together so the client's `onDiffLoad` and `onGuideLoad` callbacks can both be satisfied from one response. This is what keeps the design request/response only.
6. Bind explicitly: `server.listen(port, '127.0.0.1')`. Not `0.0.0.0`, not the default.
7. Serve the client bundle from one resolved directory relative to this module. The plan is explicit that asset resolution has exactly one case and must not grow a second — there is no packaged-desktop layout to branch for, because this program never runs inside one.
8. `packages/serve/src/server.test.ts` starts the server on port 0, issues real requests with `fetch`, and asserts: each route's success shape; a 400 for a traversal path; a 400 for a non-integer `contextLines`; and that no core function was called in the rejection cases (inject spies through the session).

Write tests for the route contract and the rejection paths. Do not write a test
per field of every response shape — that tests `core`, which has its own suite.
</details>
