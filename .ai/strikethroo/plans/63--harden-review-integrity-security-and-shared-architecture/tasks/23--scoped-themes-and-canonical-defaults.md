---
id: 23
group: "architecture-cleanup"
dependencies: [7, 21]
status: "pending"
created: 2026-10-01
skills:
  - build-tooling
  - react
complexity_score: 5
execution_profile: "complex-architecture"
---
# Use scoped prebuilt Prism themes in desktop, canonicalize browser-safe defaults, fix the browser parser export (simplifications 6, 7)

## Objective
Desktop consumes the same scoped compiled Prism theme assets serve already uses; runtime global style injection and unneeded theme props are removed. Overlapping config defaults come from one small pure browser-safe source bundled by core and React (not the types package, no Node imports in React, no new package). The internal `packages/core/src/browser.ts` parse export either uses a portable UTF-8 decoder instead of Node `Buffer` or is removed along with its browser-safety claim.

## Skills Required
Build tooling (webpack/tsup/CSS bundling) and React.

## Acceptance Criteria
- [ ] Desktop renderer imports the scoped Prism CSS (`packages/react/src/vendor/prism-light-scoped.css`, `prism-dark-scoped.css` or their built equivalents) the same way serve does; the runtime `<style>` injection code and any theme-CSS props it needed are deleted (breaking prop removal allowed; update exported types and callers). Light/dark syntax highlighting still switches correctly in both desktop and serve (verify via `npm run test:e2e` theme scenario or a Playwright screenshot of each theme).
- [ ] One pure defaults module (e.g. `packages/react/src/config-defaults.ts` consumed by React, and imported by core via relative source path or duplicated-by-design only if the package boundary forbids — prefer a single file imported by both since core may import browser-safe code) defines overlapping defaults (categories, theme, view mode, font size, ignore patterns, thresholds); `packages/core/src/config.ts` and `packages/react/src/context/ConfigContext.tsx` both use it. The types package stays type-only; React has no Node imports (verify with `grep -rn "from 'fs'\|from 'path'\|from 'child_process'" packages/react/src` and a bundle inspection of `packages/react/dist`).
- [ ] `packages/core/src/browser.ts`: replace `Buffer` octal path decoding with `TextDecoder`-based decoding (shared with the Node parser so there is one implementation) and add a test that runs the parser with `Buffer` unavailable — or delete the export and its claim if unused (decide by checking `package.json` exports and callers).
- [ ] `npm run build:packages`, serve build, `npm run package`, `npm run typecheck:packages`, `npm run test:unit`, `npm run test:e2e` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: desktop renderer entry (`src/renderer.ts`/`src/renderer/App.tsx`), React theme provider code that injects styles (find with `grep -rn "createElement('style')\|<style" packages/react/src src/renderer`), `packages/serve/src/client` (reference), `packages/core/src/config.ts`, `packages/react/src/context/ConfigContext.tsx`, `packages/core/src/browser.ts`, `packages/core/src/diff-parser.ts` (path decoding helper), webpack renderer config only if CSS import support is missing.

## Input Dependencies
Task 7 (font-size wiring in ConfigContext), task 21 (config provenance changes in `config.ts`).

## Output Artifacts
Simplified theme and defaults architecture.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` "Simplification opportunities" items 6 and 7 and the `browser.ts` paragraph.
2. Check the package AGENTS.md files (`packages/react/AGENTS.md`, `packages/core/AGENTS.md`) for boundary rules before choosing where the defaults module lives. If core cannot import from the React package by the documented rules, place the pure module in core under a browser-safe entry and have React import it only if React already depends on core — otherwise keep the file in React and have core import it by relative path as the Electron app does. Record the decision in the module header.
3. Concurrency: task 22 (remote lifetime, core materializer/main.ts) runs in the same phase. Re-read before editing shared files (`index.ts`); never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration. Only the Buffer-free parser test is required; theme switching is covered by e2e.
</details>
