---
id: 17
group: "serve"
dependencies: [15]
status: "completed"
created: 2026-10-01
skills:
  - node-http
  - secure-coding
complexity_score: 6
complexity_notes: "Session authorization design: private delivery, leak avoidance, and keeping SSH forwarding and browser protections intact."
execution_profile: "complex-architecture"
---
# Require a private per-session capability on sensitive serve routes (A2)

## Objective
`self-review-serve` generates a cryptographically random per-session capability, delivers it privately to the reviewer through the launch URL, and requires it on every sensitive API route (review/diff/file/image/attachment reads, apply, destination, submit/finish) in addition to the existing Host/Origin/Fetch-Metadata checks. Unauthenticated static/bootstrap responses never contain the token, and it does not leak through query strings, logs or referrers.

## Skills Required
Node HTTP authorization and secure-coding for local services.

## Acceptance Criteria
- [x] Token: `crypto.randomBytes(32)` base64url, generated per process; compared with `crypto.timingSafeEqual` on equal-length buffers.
- [x] Delivery: the launch URL printed to stderr (and opened in the browser if serve does that) is `http://127.0.0.1:<port>/#cap=<token>` — a URL fragment, so it is never sent to the server, never in `Referer`, never in server logs. The client reads it from `location.hash` at startup, keeps it in memory (React state/closure; no `localStorage`/`sessionStorage`), and immediately removes it from the address bar with `history.replaceState`.
- [x] The client adapter sends `Authorization: Bearer <token>` on every API request; the server rejects missing/incorrect tokens with 401 JSON (no body detail that echoes the token) before route handling; static assets and `index.html` are served without the token and contain no token. A reloaded tab without the fragment shows a clear "open the URL printed in the terminal" notice.
- [x] Existing protections stay: loopback binding, Host/Origin checks, Fetch Metadata. Apply/read membership checks in core remain authoritative after authentication.
- [x] `Referrer-Policy: no-referrer` is set on all responses; the server never logs request headers.
- [x] HTTP integration tests (real server, ephemeral port): each sensitive route returns 401 without a token and with a wrong token; succeeds with the right token; `GET /` and static JS contain no token; a request carrying `Host: 127.0.0.1:<port>` without browser headers but without the token is rejected (the audit's reproduction). A test simulates SSH forwarding by connecting through a local TCP proxy on a different port with the same `Host` header policy the README documents, and confirms authorized access still works (adjust Host allow-list docs if forwarding requires it).
- [x] Serve e2e (`npm run test:e2e:serve`) updated to open the capability URL and passes; `npm run test:unit` passes.
- [x] `packages/serve/README.md` documents the capability, how to open the printed URL (including over SSH forwarding), and that a lost URL requires restarting serve.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/serve/src/server.ts`, `packages/serve/src/cli.ts`/`startup.ts` (launch URL printing), `packages/serve/src/client/adapter.ts`, `packages/serve/src/client/index.tsx`, `packages/serve/src/validate.ts` if header checks live there, serve tests and e2e harness, `packages/serve/README.md`.

## Input Dependencies
Task 15 (same server/client files; durable submission contract).

## Output Artifacts
Authenticated serve API (task 18 then aligns route path resolution with core).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/security-audit-2026-10-01.md` A2, `docs/security-audit-2026-10-01-sol/p2-serve.txt`, and `packages/serve/README.md` around line 128 (current "no authentication" statement). Audit route locations: `server.ts:133,150,178,296,354,453,492`.
2. Find how serve opens/prints its URL (`grep -rn "127.0.0.1\|listen(" packages/serve/src`). stdout must stay unused — print to stderr.
3. If an "other OS user" check is feasible in this environment (e.g. `sudo -u nobody curl` is not available without a password), skip and document it as not exercised; the same-user unauthenticated test is mandatory.
4. Concurrency: tasks running in this phase do not touch serve. Re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (real HTTP server). Test authorization and leak absence; skip trivial helpers.
</details>
