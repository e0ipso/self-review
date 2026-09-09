---
id: 5
group: "serve-mode-node-cli-package"
dependencies: [3]
status: "completed"
created: 2026-09-09
skills:
  - react
  - typescript
complexity_score: 6
complexity_notes: "Third implementation of a ten-method interface plus a client build that must emit assets the server can serve. The interface contract is well defined and two implementations already exist to copy from, which keeps it from scoring higher."
execution_profile: "standard-implementation"
---
# The browser client and its fetch adapter

## Objective
Mount the existing React review interface in a browser against the HTTP
transport, with an adapter implementing `ReviewAdapter` over `fetch`.

## Skills Required
`react` for the client entry point; `typescript` for the adapter.

## Acceptance Criteria
- [ ] A client entry point mounts `ReviewPanel` from `@self-review/react` and supplies the chrome around it.
- [ ] An adapter implements `ReviewAdapter` over `fetch`, satisfying `loadDiff`, `loadResumedReview`, `submitReview`, `expandContext`, `loadFileContent`, `readAttachment`, `loadImage`, `onGuideLoad` and `onDiffLoad`.
- [ ] `changeOutputPath` is omitted entirely, not stubbed — the path is fixed at startup and there is no browser save dialog.
- [ ] `onGuideLoad` and `onDiffLoad` are satisfied from the single `GET /api/diff` response and invoked on mount. No SSE, no WebSocket, no polling.
- [ ] The file tree renders without an inert output-path control, which the omission of `changeOutputPath` is supposed to produce.
- [ ] The client build emits its assets into the directory task 3's server serves, as part of `npm run build --workspace @self-review/serve`.
- [ ] A test asserts the adapter against the interface contract, including the methods it deliberately omits.
- [ ] `submitReview` treats a 200 as *accepted, not written*. `submitReviewState` only stores state on the session; `packages/serve/src/lifecycle.ts` serialises and writes on the response's `finish` event, mirroring the desktop at `src/main/main.ts:439-441`. Do not report success to the user on the status code alone.
- [ ] The adapter sends `Content-Type: application/json` on POST requests. The server requires it and answers 415 without it.
- [ ] Attachments survive the round trip. `Attachment.data` is an `ArrayBuffer`, and `JSON.stringify` turns one into `{}` — submitting a review with an attachment through the JSON body would write empty files. Encode it (base64) on the way out and decode it server-side, and cover it with a test that asserts non-empty bytes on disk.
- [ ] The client build emits into the directory the server serves from, and runs after tsup rather than before it, since `clean: true` wipes `dist/`.
- [ ] `npm run test:unit --workspace @self-review/serve` exits 0.

## Technical Requirements
`ReviewAdapter` is declared in `packages/react/src/adapter.ts` and already has
two implementations: the Electron renderer in `src/renderer/App.tsx` over IPC,
and the webapp end-to-end harness in `tests/webapp/main.tsx` over fixtures. This
is the third. Read both before writing; the harness one is the closer model,
since it also runs in a real browser.

The two adapters must not drift. Test this one against the interface directly
rather than against a snapshot of its behaviour.

## Input Dependencies
Task 3's routes, which the adapter calls.

## Output Artifacts
The client entry point, the fetch adapter and its test, plus the built assets the
server serves.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `packages/react/src/adapter.ts` for the interface, then `tests/webapp/main.tsx` for how the harness mounts `ReviewPanel` and supplies an adapter. Copy that shape.
2. `packages/serve/src/client/adapter.ts`: each method is a `fetch` to its route from task 3's table. Path-bearing methods pass the path as a query parameter — `?path=${encodeURIComponent(p)}` — which is what makes the server's decode-once containment correct.
3. `onGuideLoad` and `onDiffLoad`: `GET /api/diff` returns `{ diff, guide }`. Call it once, then invoke both callbacks with their halves. Do not open a second request or any streaming channel.
4. Omit `changeOutputPath` from the object entirely. The interface marks it optional; the file tree checks for its presence to decide whether to render the control, which is what makes the omission render correctly rather than leaving a dead button.
5. `packages/serve/src/client/index.tsx`: mount `ReviewPanel` with the adapter, and import the compiled stylesheet from `@self-review/react/styles.css` — the package declares it in `sideEffects`, so it must be imported explicitly.
6. Client build: add the client bundle to the package build so `npm run build` produces both the server and the assets. Emit into the single directory task 3 serves from. Do not add a second resolution case.
7. `packages/serve/src/client/adapter.test.ts`: assert every implemented method issues the expected request and returns the promised shape, and assert `changeOutputPath` is absent. Mock `fetch`; this is a contract test, not an integration test — task 6 covers the real round trip.

Do not reimplement any review UI. Every component already exists in
`@self-review/react`; this task supplies a transport and a mount point.
</details>
