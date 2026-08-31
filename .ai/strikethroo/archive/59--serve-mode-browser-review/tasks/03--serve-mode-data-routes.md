---
id: 3
group: "serve-mode"
dependencies: [1, 2]
status: "completed"
created: 2026-08-28
skills:
  - node-http
  - typescript
complexity_score: 6
complexity_notes: "API surface design plus binary and large-payload correctness; several routes have encoding constraints that are easy to get subtly wrong."
execution_profile: "complex-architecture"
---
# Expose the shared handlers as serve-mode data routes

## Objective
Add the remaining HTTP routes over the shared handler module so the browser client can
load a diff, resume a prior review, expand context, lazily load file content, and read images and
attachments.

## Skills Required
`node-http` for request handling, content types and binary responses, and
`typescript` for typing the route contract against the existing payload types.

## Acceptance Criteria
- [x] `GET /api/diff` returns the diff payload AND the guide in the same response body; no separate guide route exists.
- [x] `GET /api/resume` returns previously saved comments and viewed files when a resumable review exists.
- [x] `POST /api/expand-context` accepts an expand-context request and returns the response shape the adapter interface declares, or a null-equivalent.
- [x] `GET /api/file/:path` returns hunks for a single file, supporting the existing large-payload lazy-loading path.
- [x] `GET /api/image/:path` returns an image result usable directly by the UI.
- [x] `GET /api/attachment/:path` returns raw bytes with a correct content type, byte-identical to the file on disk.
- [x] Routes reuse the task 1 module and the existing `preparePayload` path; no payload-preparation logic is reimplemented.
- [x] Runnable: `curl -s http://127.0.0.1:<port>/api/diff | python3 -c \"import json,sys; d=json.load(sys.stdin); print(len(d['files']))\"` prints a non-zero file count.
- [x] Runnable: `curl -s http://127.0.0.1:<port>/api/attachment/<path> | cmp - <path>` reports no difference.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`node:http`. Payload shapes come from `@self-review/types` and the existing
`DiffLoadPayload`, `ResumeLoadPayload`, `ExpandContextRequest`/`Response`, `DiffHunk` and
`ImageLoadResult` types. The large-payload mode and per-file lazy loading already exist on the IPC
side and are reused rather than replaced.

## Input Dependencies
Task 1's handler module for the logic, and task 2's server for the listener, routing
scaffold and startup-resolved state.

## Output Artifacts
The complete serve-mode API surface that task 4's adapter consumes.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

Each route should be a thin wrapper: parse inputs from the request, call the task 1
handler, serialize the result. If a route grows logic of its own, that logic probably belongs in the
shared module so the desktop path gets it too.

The diff route is the one with a deliberate design decision. The IPC `DIFF_REQUEST` handler sends
the diff and then the guide as two messages; over HTTP they become one response body, because the
guide is already resolved and cached at startup and there is nothing to wait for. This is what
removes the need for a push transport in v1 — do not add SSE or WebSocket to reproduce the
two-message shape.

Two routes need care beyond wrapping:

- `/api/attachment/:path` returns binary. The adapter interface declares `Promise<ArrayBuffer | null>`,
  so the response must be raw bytes with an appropriate content type, not base64 or JSON-wrapped.
  Verify with `cmp` against the file on disk rather than eyeballing a response.
- `/api/file/:path` participates in the large-payload path. Read how the existing
  `IPC.DIFF_LOAD_FILE` handler and `preparePayload` interact before implementing, and preserve that
  relationship. A large diff should still load lazily rather than arriving whole.

Path parameters carry filesystem paths and must be decoded before use. Reject or normalize paths
that escape the repository root rather than passing them through — the listener is loopback-only,
but a route that reads arbitrary paths is still worth not writing.

</details>
