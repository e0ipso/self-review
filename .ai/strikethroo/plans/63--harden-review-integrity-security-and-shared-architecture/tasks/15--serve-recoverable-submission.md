---
id: 15
group: "serve"
dependencies: [10]
status: "pending"
created: 2026-10-01
skills:
  - node-http
  - react
complexity_score: 6
complexity_notes: "Changes the documented acceptance-before-save contract to durable acknowledgement across server, lifecycle and client."
execution_profile: "complex-architecture"
---
# Make serve submission durable and recoverable (R02)

## Objective
The serve client renders a connection notice when config loading fails (no hook-order crash); a failed submission keeps the review UI and its `beforeunload` guard and can be retried; oversized submissions are caught before work is discarded; and the server acknowledges submission only after `publishReview` succeeds, returning an actionable error (and staying alive) when publication fails.

## Skills Required
Node HTTP server lifecycle and React client state.

## Acceptance Criteria
- [ ] `packages/serve/src/client/index.tsx:112–149`: all hooks run unconditionally before any early return; a rejected config request renders the intended connection notice (jsdom test with the real App and a rejecting adapter).
- [ ] Client submission state allows Finish from both `reviewing` and `failed`; `beforeunload` protection remains active in `failed`; the failure message includes the server's error message/code.
- [ ] Client computes the submission body size (JSON with base64 attachments) before POST and, if it exceeds the server's 32 MB limit (`server.ts:41` — share the constant from one place, e.g. export it from a small serve module used by both server and client build), shows an actionable error without sending and keeps the session. Server 413 responses are also mapped to the same actionable message.
- [ ] Server submit route: serializes and publishes via core `publishReview` before responding; success → 200 with `{ ok: true, outputPath }` and then the lifecycle exits as today; `ReviewPublishError` → 4xx/5xx JSON `{ ok: false, code, message }`, server and session remain available, and a subsequent corrected/ retried submission can succeed. The output path remains fixed for the serve session (no new path chooser).
- [ ] `packages/serve/src/lifecycle.ts` no longer terminates the process on write failure; it exits only after a successful publication acknowledgement has been flushed.
- [ ] Tests: jsdom client tests for config rejection, POST rejection then retry, 413 and pre-flight size check; HTTP integration test (real server on an ephemeral port) where the output path is a directory → error response, server still listening, then fix (remove directory) → retry succeeds and the file exists before exit. `npm run test:unit` and `npm run test:e2e:serve` pass.
- [ ] `packages/serve/README.md` describes the durable acknowledgement and retry behavior.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/serve/src/client/index.tsx`, `packages/serve/src/client/adapter.ts`, `packages/serve/src/server.ts` (submit route + body limit constant), `packages/serve/src/lifecycle.ts`, `packages/serve/README.md`, serve tests/e2e.

## Input Dependencies
Task 10 (`publishReview`).

## Output Artifacts
Durable submission protocol (task 17 adds capability auth to the same server/client).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R02 and `docs/codebase-audit-2026-10-01/serve.probe.test.tsx` (reproduces the hook-order crash and retry failure) — reproduce first.
2. Output origin for serve: if the output path came from `--output` it is `'explicit'`; if from project config/default it is `'inherited'` (task 21 finalizes provenance; pick what `startup.ts` currently knows and leave a typed field on the session/options).
3. Base64 expansion: size ≈ 4 * ceil(n/3) plus JSON overhead — computing `new Blob([JSON.stringify(body)]).size` is simplest and exact.
4. Concurrency: tasks 11 (core apply), 14 (Electron) and 16 (remote/forge) run in the same phase; no serve overlap expected. Re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (real HTTP server + jsdom client). Test failure/retry paths; skip trivial rendering.
</details>
