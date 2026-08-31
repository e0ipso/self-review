---
id: 4
group: "serve-mode"
dependencies: [3]
status: "completed"
created: 2026-08-28
skills:
  - typescript
complexity_score: 5
execution_profile: "standard-implementation"
---
# Implement the HTTP ReviewAdapter

## Objective
Implement the `ReviewAdapter` interface over `fetch` so the existing React UI can be
driven by the serve-mode API instead of Electron IPC.

## Skills Required
`typescript`, implementing an existing documented interface against an HTTP API.

## Acceptance Criteria
- [x] A module exports an object satisfying `ReviewAdapter` from `packages/react/src/adapter.ts`.
- [x] `loadDiff`, `loadResumedReview`, `submitReview`, `expandContext`, `loadFileContent`, `loadImage` and `readAttachment` are implemented as requests against the task 3 routes.
- [x] `readAttachment` returns an `ArrayBuffer` (or null), not JSON or a base64 string.
- [x] `onGuideLoad` invokes its callback with the guide carried in the diff response and returns a working unsubscribe function.
- [x] `changeOutputPath` is absent from the object.
- [x] No `EventSource`, WebSocket or polling is used anywhere in the module.
- [x] Runnable: `npx tsc --noEmit` reports no type error for the module against the real `ReviewAdapter` type.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
TypeScript targeting the browser. The interface is
`packages/react/src/adapter.ts`. The existing Electron implementation in `src/renderer/App.tsx`
(twenty-one lines) is the reference for shape and naming.

## Input Dependencies
Task 3's routes, which define the contract this adapter calls.

## Output Artifacts
An adapter module that task 5's client application provides to `ReviewPanel`.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

Open `src/renderer/App.tsx` and read the `electronAdapter` object first. This task is
that object with `fetch` in place of `window.electronAPI`, and keeping the two visibly parallel is
worth more than any cleverness.

`loadDiff` is the only required method on the interface; everything else is optional and the library
degrades gracefully when a method is absent. That is what makes omitting `changeOutputPath` safe —
`packages/react/src/components/FileTree.tsx` already guards with `if (!adapter?.changeOutputPath) return;`
before offering the control, and `SingleFileReview` already ships a reduced adapter whose tests
assert the method is undefined. Do not add a stub that throws; omit the key entirely.

`onGuideLoad` keeps its subscribe-and-unsubscribe signature even though nothing pushes. The guide
arrives inside the diff response, so the implementation should invoke the callback with that value
and return a no-op (or genuinely deregistering) unsubscribe function. The interface documents the
unsubscribe as required because the subscribing effect re-runs when adapter identity changes — so
return a real function, never `undefined`.

`readAttachment` is the one method that is not JSON. Use `res.arrayBuffer()` and return `null` on a
non-OK response, matching the declared `Promise<ArrayBuffer | null>`.

Memoize or define the adapter object once at module scope rather than constructing it per render;
`SingleFileReview`'s documentation notes that the consumer should memoize the adapter to avoid
unnecessary re-renders, and the same applies here.

</details>
