---
id: 9
group: "app"
dependencies: [8]
status: "completed"
created: 2026-08-04
skills:
  - react
  - typescript
complexity_score: 4
---
# Renderer: splash-screen URL entry and drift warning

## Objective
Add the two genuinely new UI surfaces of remote mode: a PR/MR URL input on the
welcome/splash screen (beside the directory picker) that starts a remote session, and a
non-blocking warning banner when the reviewed PR/MR head has moved since the review was
recorded.

## Skills Required
React with shadcn/ui components; TypeScript against the preload bridge.

## Acceptance Criteria
- [x] `WelcomeScreen.tsx` gains a URL input + submit affordance using shadcn/ui
      components (Input/Button, matching the established welcome-screen pattern); a
      syntactically valid forge URL (validated with the same path-shape rules as
      `parseForgeUrl`) is sent to the main process over the URL-open IPC channel from
      task 8; invalid input shows inline feedback and sends nothing.
- [x] The preload bridge (`src/preload/preload.ts`) exposes the new channel(s) following
      the existing typed `electronAPI` pattern; the renderer never imports `electron`.
- [x] When drift information (task 8's payload/channel) indicates
      `recordedHeadSha !== liveHeadSha`, a non-blocking warning renders (banner pattern
      consistent with `UpdateBanner.tsx`): the PR/MR has moved and line anchors may be
      stale. It is dismissible and never blocks any review interaction.
- [x] No drift info or equal SHAs → no banner; purely local reviews render exactly as
      today (no new UI when not in remote mode) — asserted in tests.
- [x] Unit tests (jsdom) cover: URL validation feedback, IPC call on valid submit,
      banner shown on mismatch, banner absent on match/absence, banner dismissal.
- [x] Verification: `npm run test:unit:renderer` passes; `npm run test:unit` stays green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- shadcn/ui only — no raw HTML buttons/inputs per convention.
- URL validation in the renderer must not duplicate `parseForgeUrl` logic: import it from
  `@self-review/core` browser-safe surface (check `packages/core/src/browser.ts` for what
  the renderer may import) or, if the parse function is not browser-exported, export it
  there — it is pure.
- The drift warning is orientation, not a gate: no modal, no confirm.

## Input Dependencies
Task 8: IPC channels/types for URL-open and drift, main-side handlers.

## Output Artifacts
- Updated `WelcomeScreen.tsx`, drift banner component, preload additions. Referenced by
  docs (task 10).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `src/renderer/components/WelcomeScreen.tsx` and `UpdateBanner.tsx` first; follow
   their composition and styling exactly.
2. Preload: mirror an existing send-channel exposure (e.g. `output-path:change`) for
   `remote:open-url`, and an existing subscribe exposure (e.g.
   `version-update:available`) if drift arrives on its own channel; if drift rides the
   `resume:load` payload, no new subscription is needed — read it from the existing load
   path in context.
3. Keep state in React context per convention (no module-level state); the banner's
   dismissed flag is component/context state.
4. Wording suggestion for the banner: "This PR has changed since this review was
   recorded — line anchors may be stale." with the short SHAs shown.
</details>
