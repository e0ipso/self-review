# Cursor Cloud specific instructions

Durable, non-obvious setup/run caveats for developing this repo inside a Cursor Cloud Agent VM. Standard commands and conventions live in [`AGENTS.md`](../AGENTS.md).

Dependencies are installed automatically on VM startup (`npm install`, which also links the `packages/*` workspaces). Node 22+ and a virtual display (`DISPLAY=:1`, xvfb) are present.

- **The desktop commands build the workspace packages themselves.** `npm start`, `npm run package`, `npm run make` and `npm run publish` each run `npm run build:packages` first, which builds `packages/types`, then `core`, then `react`, in about 8 seconds. `npm install` does not produce those `dist/` directories, and the root `tsconfig.json` maps only `@self-review/core` to source, so the fork-ts-checker type check resolves `@self-review/types` through the package `exports` and fails with `Cannot find module '@self-review/types'` when `dist/` is missing. Run `npm run build:packages` by hand only when you want the outputs without launching the app. Unit tests never needed it, because those imports are type-only and the transform erases them.
- **Running the actual Electron app headless:** package it (`npm run package`), then launch the binary from inside the target git repo so its `git diff` runs there:
  `cd <repo-with-changes> && DISPLAY=:1 ELECTRON_DISABLE_SANDBOX=1 "/agent/repos/self-review/out/Self Review-linux-x64/self-review"`.
  Use the `ELECTRON_DISABLE_SANDBOX=1` **env var**, never the `--no-sandbox` flag — any unrecognized CLI arg is forwarded to `git diff` and breaks startup. The review is written to `./review.xml` in that cwd on "Finish Review".
  Caveat: the packaged binary's asar omits `xmllint.wasm`, so it emits XML *without* XSD validation (logs a warning); dev mode (`npm start`) ships the wasm under `.webpack/` and validates normally.
- **e2e browsers are separate per Playwright version.** `npm run test:e2e` (webapp, the CI suite, 51 tests) needs `npx playwright install chromium chromium-headless-shell` first — it does **not** auto-install. Electron e2e (`npm run test:e2e:electron`) additionally packages + uses xvfb. Unit suites (`npm run test:unit`, 187 tests) and `npm run lint` need no browser and pass green.
