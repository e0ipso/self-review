---
id: 2
group: "dependencies"
dependencies: []
status: "completed"
created: 2026-10-01
skills:
  - npm-dependencies
  - electron
complexity_score: 6
complexity_notes: "Electron major-version and Mermaid upgrades can ripple into build and runtime; verification needs packaged Electron e2e."
execution_profile: "complex-architecture"
---
# Classify shipped dependency advisories and update applicable runtime dependencies

## Objective
Classify the lockfile advisories against what actually ships (Electron app bundle, serve CLI bundle, published `@self-review/*` packages) and update the applicable runtime dependencies — at minimum the shipped Electron runtime, Mermaid (to a release containing GHSA-87f9-hvmw-gh4p, GHSA-ghcm-xqfw-q4vr and GHSA-6x64-9x62-f2gx fixes, i.e. ≥ 11.16.1 or the current maintained release), DOMPurify and fast-xml-parser — to maintained versions verified now, without blanket tooling upgrades.

## Skills Required
npm workspace dependency management and Electron runtime upgrade verification.

## Acceptance Criteria
- [x] `docs/dependency-advisory-classification-2026-10-01.md` records, for each advisory affecting a package present in a shipped artifact, whether the vulnerable API is reachable, the action taken, and the evidence (bundle inspection command/output). Tooling-only advisories are listed in aggregate as out of scope with the reason. Primary advisory sources are cited.
- [x] `npm ls electron mermaid dompurify fast-xml-parser` shows the updated versions; `npm audit --omit=dev --json` (or equivalent bundle-based inspection) no longer reports the addressed runtime advisories.
- [x] `npm run typecheck`, `npm run typecheck:packages`, `npm run lint`, `npm run test:unit`, `npm run build:packages` and the serve workspace build pass.
  - All exit 0 except `npm run lint` (exit 1): 2 errors in committed audit probe files that pre-date this task and are untouched by it — `docs/codebase-audit-2026-10-01/ui.probe.test.tsx:10` (unused import `FileTree`) and `docs/security-audit-2026-10-01-sol/claude-probe-apply.ts:12` (empty `catch {}`), both from commit `d353218`; `docs/` is not in eslint's ignore list. Not fixed here because those files are audit evidence outside this task's ownership. Resolution is a one-line decision for the orchestrator: add `'docs/**'` to the `ignores` in `eslint.config.*` (Prettier already exempts `docs/`), or touch the two lines.
- [x] `npm run package` succeeds and `npm run test:e2e:electron` passes (xvfb is available in this environment); `npm run test:e2e` passes.
  - xvfb is **not** installed on this host (no sudo); the Electron suite was run on the live `DISPLAY=:0` with `--ozone-platform=x11` added to a throwaway worktree copy of the harness: 37 passed, 1 flaky-then-passed, exit 0. Wayland launch hangs identically on Electron 40 and 44 (environment, not regression). See the doc, section 5.
- [x] No unrelated devDependency/tooling upgrades and no signing/notarization additions.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Root `package.json`, `packages/*/package.json`, `package-lock.json`.
- Inspect built outputs (`.webpack/`, `packages/serve/dist`, `packages/*/dist`) with `grep`/`npm ls --all --omit=dev` to determine what ships; release tooling declared as production dependencies must be identified explicitly.
- Electron: move to the latest maintained (supported) major available on npm today; adjust code only for real breaking changes (check Electron breaking-changes doc for each major crossed).

## Input Dependencies
None. Audit inputs: `docs/security-audit-2026-10-01/npm-audit.json`, `advisories.json`.

## Output Artifacts
Updated manifests/lockfile and the classification document (consumed by tasks 3, 8, 12 which rely on the updated fast-xml-parser/Mermaid, and by task 24).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/security-audit-2026-10-01.md` "Refresh runtime dependencies" and the A7 section.
2. Use `npm view <pkg> versions --json`/`npm view <pkg> dist-tags` to pick versions; prefer the latest stable within reason. For Mermaid, confirm the fix versions from the advisories (`gh api /advisories/GHSA-...` or `npm view mermaid` + advisory pages via WebFetch if available).
3. Update with `npm install <pkg>@<ver> -w <workspace>` (or root) so the lockfile stays consistent. Do NOT run `npm audit fix`.
4. fast-xml-parser: a later task (3) disables `parseTagValue` and changes entity handling; keep API usage compiling now — just upgrade and make existing tests pass.
5. Electron: Forge config (`forge.config.ts`) and `@electron/fuses` may need matching versions; check `npm run package` output. Run Electron e2e via `npm run test:e2e:electron` (needs xvfb-run, xauth, libgtk-3-0 — already installed per AGENTS.md; if missing, report it).
6. Playwright browsers: `npx playwright install chromium` may be needed for `npm run test:e2e`.
7. Do not commit; the orchestrator commits per phase. Other tasks in this phase edit React/core source files concurrently — only change source code when an upgrade forces it, re-read files before editing, and never revert others' changes or the unrelated uncommitted files (`.agents/`, `skills-lock.json`, `docs/*audit*`).

Test philosophy: write a few tests, mostly integration. No new tests are expected unless an upgrade changes behavior you must pin.
</details>
