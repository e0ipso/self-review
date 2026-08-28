---
id: 5
group: "serve-mode"
dependencies: [4]
status: "completed"
created: 2026-08-28
skills:
  - vite
  - react-components
complexity_score: 6
complexity_notes: "Build-tooling work whose packaged-asset location has no existing precedent in the repository; tests/webapp is only ever run from source."
execution_profile: "complex-architecture"
---
# Build the serve-mode browser client and its static assets

## Objective
Produce the browser application that mounts the existing review UI, supplies the HTTP
adapter, renders the surrounding chrome including the control that finishes a review, and builds to
static assets the server can serve from both a source checkout and a packaged build.

## Skills Required
`vite` for the build and its aliasing, and `react-components` to mount
`ReviewPanel` and `Toolbar` and wire the finish control through the panel's ref handle.

## Acceptance Criteria
- [ ] A Vite application exists with an entry document, an entry module and a build configuration, modelled on `tests/webapp/`.
- [ ] `@self-review/core` is aliased to `packages/core/src/browser.ts`, as both existing build configurations do.
- [ ] The application mounts `ReviewPanel` and `Toolbar` from `@self-review/react` and provides the task 4 adapter.
- [ ] A finish control reads review state via the panel's ref handle and submits it, matching the embedding pattern `tests/webapp/main.tsx` documents.
- [ ] No control for changing the output path is rendered, and its absence produces no console error.
- [ ] The build emits static assets, and the server locates them both when run from a source checkout and from a packaged build.
- [ ] Runnable: build the client, start serve mode, and `curl -s http://127.0.0.1:<port>/ | grep -c '<div id=' ` returns non-zero — the entry document is served.
- [ ] Runnable: `npm run package`, then start serve mode from the packaged output and confirm the same request succeeds.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Vite with `@vitejs/plugin-react` and `@tailwindcss/vite`, both already devDependencies.
`tests/webapp/vite.config.ts` is the working reference for plugins and aliasing. React 19.

## Input Dependencies
Task 4's adapter, and the routes it calls.

## Output Artifacts
Built static client assets served by the task 2 server; the artifact tasks 7 and 8
exercise and document.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

`tests/webapp/` already solves most of this and should be read first. Its header comment
describes it as demonstrating "the embedding pattern: the host app renders its own chrome (Toolbar,
Finish Review button) and uses the ref handle to read the review state when ready" — which is
precisely what this client needs to do. Its `vite.config.ts` shows the plugin set and the
`@self-review/core` alias to `packages/core/src/browser.ts`.

The difference from `tests/webapp` is that fixture data is replaced by the HTTP adapter, and the
finish control submits rather than merely reporting. Do not fork the UI: everything visual comes
from `@self-review/react`, and this application supplies only the mount point, the adapter and the
chrome.

Asset location is the part with no precedent and the plan names it as a risk. `tests/webapp` is only
ever run from source by Playwright, so it never had to answer where built assets live in a release.
Decide explicitly where the build emits and how the server resolves that directory in both cases,
and prove the packaged case with `npm run package` rather than assuming it follows from the source
case working.

The output path is displayed but not editable. `outputPathInfo` still arrives from the configuration
route, and `Toolbar` renders it along with an `outputPathWritable` warning — that display is correct
and should be kept. The server resolved the path at startup, so the UI is reporting a fact rather
than offering a control.

</details>
