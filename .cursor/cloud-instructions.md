# Cursor Cloud specific instructions

Durable, non-obvious setup/run caveats for developing this repo inside a Cursor Cloud Agent VM. Standard commands and conventions live in [`AGENTS.md`](../AGENTS.md).

Dependencies are installed automatically on VM startup (`npm install`, which also links the `packages/*` workspaces). Node 22+ and a virtual display (`DISPLAY=:1`, xvfb) are present.

- **Build the workspace packages before `npm start` / `npm run package`.** The webpack build imports the `@self-review/types` (and `core`/`react`) package specifiers, which resolve to each package's `dist/` — **not** built by `npm install`. Run once after a fresh install:
  `npm run build --workspace=packages/types && npm run build --workspace=packages/core && npm run build --workspace=packages/react`
  Skipping this fails the build with `Cannot find module '@self-review/types'`. Unit tests still pass without it because those are type-only imports (erased at transform).
- **Running the actual Electron app headless:** package it (`npm run package`), then launch the binary from inside the target git repo so its `git diff` runs there:
  `cd <repo-with-changes> && DISPLAY=:1 ELECTRON_DISABLE_SANDBOX=1 "/agent/repos/self-review/out/Self Review-linux-x64/self-review"`.
  Use the `ELECTRON_DISABLE_SANDBOX=1` **env var**, never the `--no-sandbox` flag — any unrecognized CLI arg is forwarded to `git diff` and breaks startup. The review is written to `./review.xml` in that cwd on "Finish Review".
  Caveat: the packaged binary's asar omits `xmllint.wasm`, so it emits XML *without* XSD validation (logs a warning); dev mode (`npm start`) ships the wasm under `.webpack/` and validates normally.
- **e2e browsers are separate per Playwright version.** `npm run test:e2e` (webapp, the CI suite, 51 tests) needs `npx playwright install chromium chromium-headless-shell` first — it does **not** auto-install. Electron e2e (`npm run test:e2e:electron`) additionally packages + uses xvfb. Unit suites (`npm run test:unit`, 187 tests) and `npm run lint` need no browser and pass green.
