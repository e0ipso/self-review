# Dependency advisory classification and runtime refresh (2026-10-01)

This document classifies the advisories recorded by the 2026-10-01 security audit
(`docs/security-audit-2026-10-01/npm-audit.json`, 99 vulnerable package entries;
`docs/security-audit-2026-10-01/advisories.json`, 197 advisories across 46 packages) against what
the project actually ships, and records the runtime dependency updates made in response. It is the
output of plan 63, task 02. The audit counts are package/advisory counts, not 99 demonstrated
defects; the point of this document is to say, per shipped package, whether the vulnerable code is
present in a shipped artifact and whether the vulnerable API is reachable.

Baseline: commit `d353218` (app 1.45.0), lockfile as committed. All commands below were run on
2026-10-01 against the npm registry and the GitHub advisory database as mirrored by `npm audit`.

## 1. What ships

There are three shipped artifacts. Each was built and inspected rather than inferred from the
lockfile.

| Artifact                                    | Build                                       | What is inside                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron desktop app (`out/…/app.asar`)     | `npm run package` (Forge + webpack)         | 144 entries: `.webpack/main/index.js` (main bundle, includes `@self-review/core` and its deps by relative import), `.webpack/main/native_modules/xmllint{-node.js,.wasm}`, `.webpack/renderer/**` (eager `main_window/index.js` + 67 lazy chunks), `package.json`. **Zero `node_modules` entries.** Plus the Electron runtime binary itself. |
| `@self-review/serve` CLI (`packages/serve/dist`) | `npm run build --workspace @self-review/serve` | `cli.js` (externals: `@self-review/core` and Node builtins only) and `dist/client/` (Vite bundle of `@self-review/react`, including Mermaid as lazy chunks).                                                                                                 |
| Published packages (`packages/*/dist`)      | `npm run build:packages`                    | `@self-review/core` externalizes `fast-xml-parser`, `xmllint-wasm`, `yaml`, `ignore`; `@self-review/react` externalizes its runtime deps and keeps `import('mermaid')` dynamic. Consumers resolve those at install time.                                              |

Evidence (asar listing; run after `npm run package`):

```
$ node -e 'const a=require("@electron/asar");const l=a.listPackage("out/Self Review-linux-x64/resources/app.asar");
  console.log(l.length, l.filter(p=>p.includes("/node_modules/")).length)'
144 0
$ cat "out/Self Review-linux-x64/version"
44.5.1
```

Evidence (serve CLI externals and core/react externals):

```
$ grep -ohE "(require\(|from )['\"][^'\"./][^'\"]*['\"]" packages/serve/dist/cli.js | sort | uniq -c
      3 from "@self-review/core"   3 from "fs"   3 from "path"   1 from "http"   1 from "module"   1 from "url"
$ grep -ohE "from \"[^\".][^\"]*\"" packages/core/dist/index.js | sort | uniq -c
  … "fast-xml-parser" (2) "xmllint-wasm" (2) "yaml" (1) "ignore" (1) + node builtins
```

Release and build tooling declared under `dependencies` in the root `package.json` (so `npm audit
--omit=dev` still reports it) was identified explicitly and confirmed absent from every bundle:
`semantic-release`, `@semantic-release/{github,npm}`, `@commitlint/{cli,config-conventional}`,
`prettier`, `postcss`, `autoprefixer`, `tailwindcss`, `@tailwindcss/postcss`. The only occurrence
of any of those names in a shipped bundle is inside the `package.json` manifest string that
`src/main/cli.ts` and `src/main/version-checker.ts` embed for `--version` and the update check:

```
$ grep -o -E ".{70}semantic-release.{40}" .webpack/x64/main/index.js | head -1
fuses":"^1.8.0","@eslint/js":"^9.39.2","@playwright/test":"^1.58.2","@semantic-release/git":"^10.0.1","@tailwindcss/typography
$ cat packages/serve/dist/client/assets/*.js | grep -c -F "semantic-release"
0
```

Moving those entries to `devDependencies` is out of this task's scope (no unrelated tooling
changes); it is recorded here so the next person does not read `--omit=dev` as "what ships".

## 2. Shipped packages: per-advisory classification

Reachability was determined by reading the call sites in `src/` and `packages/*/src/` (not tests)
and, for transitive packages, the calling code inside the dependency's `dist`.

### 2.1 Electron runtime — 39 advisories (12 high, 21 moderate, 6 low)

- **Present in artifact:** yes, the whole runtime (`out/…/version` = locked Electron).
- **Before:** 40.4.0 (published 2026-02-11). Every advisory range tops out at `<40.10.6` or
  `<41.10.6`; `npm audit` range `<=41.10.5 || 42.0.0-alpha.1 - 42.3.3 || 43.0.0-alpha.1 - 43.0.0-beta.8`.
- **Reachable surface (source inspection of `src/main/*.ts`, `src/preload.ts`):** the app uses
  `contextBridge.exposeInMainWorld`, loads the renderer from `file:`, uses
  `webContents.setWindowOpenHandler` (one permitted attachment popup), `will-navigate`, `dialog`,
  `shell.openExternal`, `net.request` (version check), `Menu`, `nativeImage.createFromPath`. So the
  contextBridge isolation bypasses (GHSA-jfqg-hf23-qpw2, GHSA-h7rp-cf8h-j98x, GHSA-ff2p-hmqr-hxm4),
  the file/http protocol cross-origin reads (GHSA-j84w-jfhq-vhvj, GHSA-v3j7-r9gq-3gjw), the popup /
  sandbox-inheritance issues (GHSA-hq2x-r82h-9wj4, GHSA-gr2m-v5gq-v685, GHSA-9f4c-93c8-jc8g,
  GHSA-f3pv-wv63-48x8, GHSA-v93f-fgjr-hjrj), `shell.openPath` null byte (GHSA-5c9j-mhmv-5xgx; the app
  uses `openExternal`, same module) and the download save-dialog UAF (GHSA-9w97-2464-8783) are on
  code paths the app exercises, conditional on hostile renderer content the audit did not
  demonstrate. Not reachable by construction: `<webview>` (`webviewTag: false`), offscreen
  rendering, extensions/`chrome.*`, USB, PowerMonitor, `clipboard.readImage`,
  `setLoginItemSettings`, `moveToApplicationsFolder`, `setAsDefaultProtocolClient`, Squirrel.Mac
  updater, DevTools dock state (dev only), custom protocol handlers (none registered).
- **Action:** upgraded to **44.5.1** (latest stable on npm, published 2026-09-30; Node 24.21.0,
  Chromium 152.0.7977.130). This is the latest supported major; it clears every listed advisory.
- **Breaking changes crossed (41 → 44), checked against the API list above:** 41 (PDF in-process,
  cookie change cause), 42 (macOS `UNNotification`, offscreen scale factor, `electron` no longer
  downloads in `postinstall`, `clearStorageData` `quotas`, `hslShift` array), 43 (Linux rounded
  corners/WCO, `toBitmap` color space, `chrome.scripting`, **dialogs default to Downloads when no
  `defaultPath`**, `showHiddenFiles` removed), 44 (subframe workers need
  `nodeIntegrationInSubFrames`, DevTools preload scope, `select-client-certificate`, macOS 12 /
  Unity / 32-bit dropped, ANGLE static, `net.request` frame mode, **`clipboard` removed from the
  renderer and made Promise-based**, `openAsHidden` removed). None applies: the renderer never
  imports `electron` (preload bridge only), no `clipboard` use, every `dialog` call passes
  `defaultPath` except `showOpenDialog` on the welcome screen which passes `app.getPath('home')`.
  No main-process source change was required. Two Chromium 152 behaviour changes that are not in
  the breaking-changes list did surface through the Electron e2e suite and were fixed
  (section 5): the first window is handed to Playwright while it still shows its initial empty
  document, and a find-in-page session started from the focused find input reports the input's
  own text as active match 0. The one operational consequence of 42's on-demand download is that
  a fresh `npm ci` no longer fetches the binary; `electron-forge package` and the first
  `npx electron` run do.
- **Evidence:** `npm ls electron` → `electron@44.5.1`; `npm audit --omit=dev --json` → `electron`
  absent; `ELECTRON_RUN_AS_NODE=1 npx electron -p process.versions` →
  `{"electron":"44.5.1","node":"24.21.0","chrome":"152.0.7977.130"}`.

### 2.2 Mermaid — 9 advisories (all moderate/low)

- **Present in artifact:** yes. `@self-review/react` does `await import('mermaid')` in
  `packages/react/src/components/DiffViewer/MermaidBlock.tsx`; webpack emits it as lazy renderer
  chunks (`.webpack/x64/renderer/2300/index.js` carries the `11.17.2` version string), Vite emits
  it as `packages/serve/dist/client/assets/mermaid.core-*.js`. It is not in the eager
  `main_window/index.js` and not in the main process.
- **Before:** 11.12.3. **Reachable:** yes — `mermaid.initialize({ startOnLoad: false, … })` then
  `mermaid.render(id, code)` on fenced `mermaid` blocks from added Markdown files and guide
  overviews (the audit's A7 reproduction). Per advisory: configuration CSS injection
  GHSA-87f9-hvmw-gh4p and classDef CSS/HTML injection GHSA-xcj9-5m2h-648r / GHSA-ghcm-xqfw-q4vr
  (reachable: diagram text is reviewed content), sibling CSS injection GHSA-6x64-9x62-f2gx
  (reachable), Gantt / XY-chart / radar DoS GHSA-6m6c-36f7-fhxh / GHSA-2v8p-3f2j-5mp7 /
  GHSA-rhh3-jpg6-66xh (reachable: any diagram type renders), prototype pollution via configuration
  APIs / architecture diagrams GHSA-c4c3-pg64-4m4v / GHSA-3rrr-jr9j-h3q3 (configuration is not
  content-controlled; architecture diagrams are; retained as maintenance context per the audit).
- **Action:** upgraded to **11.17.2** (latest 11.x, published 2026-08-25). Every Mermaid range ends
  at `<=11.14.0` or `<11.16.1`, so 11.17.2 contains all fixes. 12.0.0 (published 2026-09-10) was
  not taken: it is a three-week-old major that changes the default layout engine (bundles ELK),
  the default theme/look, and removes `defaultRenderer`; diagram isolation is task 12's job and a
  security refresh should not also change how every existing diagram renders. The Mermaid
  advisories do not require 12.
- **Side effect worth knowing:** 11.17.2's `@mermaid-js/parser@1.2.1` no longer depends on
  `langium`/`chevrotain` at runtime (it inlines them at its own build; its only dependency is
  `@chevrotain/types`). `langium`, `chevrotain`, `chevrotain-allstar`, `@chevrotain/*` and the
  `vscode-languageserver-*` family left the lockfile entirely (17 packages removed).
- **Evidence:** `npm ls mermaid --all` → `mermaid@11.17.2` (root and `@self-review/react`);
  `grep -l -F '11.17.2' .webpack/x64/renderer/*/index.js` → `2300/index.js`, `3566/index.js`;
  `grep -l -F 'elkjs' .webpack/x64/renderer/*/index.js` → none.

### 2.3 DOMPurify — 14 advisories (10 moderate, 4 low)

- **Present in artifact:** yes, transitively — only Mermaid pulls it; the app has no direct
  `dompurify` import (`grep -rn dompurify packages/*/src src` → nothing outside tests). It lives in
  the same lazy Mermaid chunk (`renderer/2300/index.js` and `serve …/mermaid.core-*.js` carry
  `3.4.16`).
- **Before:** 3.3.3 (Mermaid's `^3.3.3` range, which `npm install mermaid@…` alone would not have
  moved). **Reachable API:** Mermaid calls `DOMPurify.sanitize(code, { ADD_TAGS, ADD_ATTR })` once,
  on diagram text. It uses neither `IN_PLACE`, `RETURN_DOM`, `SAFE_FOR_TEMPLATES`,
  `CUSTOM_ELEMENT_HANDLING`, `RETURN_TRUSTED_TYPE`, hooks nor the function form of `ADD_TAGS`
  (`grep -oE "(IN_PLACE|RETURN_DOM|SAFE_FOR_TEMPLATES|CUSTOM_ELEMENT_HANDLING|RETURN_TRUSTED_TYPE|ADD_TAGS|ADD_ATTR|FORBID_TAGS)" node_modules/mermaid/dist/mermaid.core.mjs`
  → only `ADD_ATTR`, `ADD_TAGS`). So of the 14, the ones about `IN_PLACE`
  (GHSA-x4vx-rjvf-j5p4, GHSA-hpcv-96wg-7vj8, GHSA-r47g-fvhr-h676, GHSA-rp9w-3fw7-7cwq,
  GHSA-55q2-fjhq-7xh7), `RETURN_DOM`/`SAFE_FOR_TEMPLATES` (GHSA-crv5-9vww-q3g8, GHSA-gvmj-g25r-r7wr),
  `CUSTOM_ELEMENT_HANDLING` (GHSA-c2j3-45gr-mqc4, GHSA-v9jr-rg53-9pgp), the `ADD_TAGS` function form
  (GHSA-h7mw-gpvr-xq4m, GHSA-39q2-94rc-95cp), Trusted Types (GHSA-vxr8-fq34-vvx9) and hook pollution
  (GHSA-76mc-f452-cxcm, GHSA-cmwh-pvxp-8882) are not on the exercised path. Updated anyway: it is
  one `npm update` and the sanitizer is the last line between reviewed content and the document.
- **Action:** `npm update dompurify` → **3.4.16** (latest, published 2026-09-23; all ranges end at
  `<=3.4.12`).
- **Evidence:** `npm ls dompurify --all` → `mermaid@11.17.2 └── dompurify@3.4.16`;
  `grep -l -F '3.4.16' .webpack/x64/renderer/*/index.js` → `2300/index.js`.

### 2.4 fast-xml-parser — 3 advisories (+ 1 on its `fast-xml-builder` dependency)

- **Present in artifact:** yes, in the Electron main bundle (`grep -c -F 'fast-xml-parser'
  .webpack/x64/main/index.js` → 1, and the 5.5.5+ `onDangerousProperty` option name is present) and
  as a runtime dependency of `@self-review/core` (externalized, so the serve CLI and package
  consumers resolve it from their own install). Not in any renderer/browser bundle.
- **Before:** 5.5.3. **Reachable:** `new XMLParser({...}).parse(string)` in
  `packages/core/src/xml-parser.ts` (resume documents, `--resume-from`) and
  `packages/core/src/guide-parser.ts` (guide sidecar). Both inputs are local files the reviewer
  chose or that sit next to the output path. GHSA-8gc5-j5rx-235r (numeric entity expansion bypass,
  `<5.5.6`) is on that path: `processEntities` is on by default and the parsers do not disable it.
  GHSA-jp2q-39xq-3w4g (`<5.5.7`, limits set to zero) is not: no caller sets an expansion limit to
  `0`. GHSA-gh4j-gqv2-49f6 and GHSA-5wm8-gmm8-39j9 (`XMLBuilder` / `fast-xml-builder` output
  injection) are not: `grep -rn XMLBuilder packages src` → nothing; the serializer is hand-written
  (`packages/core/src/xml-serializer.ts`). The audit had already rejected the amplification claim
  empirically; the upgrade is still the right maintenance.
- **Action:** upgraded to **5.11.2** (latest, published 2026-09-29) in root and
  `@self-review/core`; `fast-xml-builder` followed to 1.3.1. Behavioural changes between 5.5.3 and
  5.11.2 that matter to these callers (from the upstream changelog): entity handling moved to
  `@nodable/entities` (5.6.0/5.7.0: single entity scan, numeric external entities rejected, error
  messages changed), dangerous tag/attribute names are sanitized and critical property names
  (`__proto__` and friends) error (5.5.5), DOCTYPE entity names are validated (5.8.0/5.9.0).
  The `addEntity` method is deprecated (5.7.3); it is not used here. The 31-file core suite (587
  tests, including the XML parser, guide parser and XSD sync tests) passes unchanged, so no
  behaviour this project pins moved. Task 3 will separately disable `parseTagValue` and revisit
  entity handling; nothing here pre-empts it.
- **Evidence:** `npm ls fast-xml-parser --all` → 5.11.2 (root, core); `npm audit --omit=dev` →
  `fast-xml-parser`, `fast-xml-builder` absent.

### 2.5 Transitive runtime packages flagged through Mermaid

| Package | Advisory | Before → after | Shipped? | Classification |
| --- | --- | --- | --- | --- |
| `lodash-es` | GHSA-r5fr-rjxr-66jc (`_.template` code injection, high), GHSA-f23m-r3pf-42rh (`_.unset`/`_.omit` prototype pollution, moderate) | 4.17.23 → 4.18.1 (`npm update`) | Yes, in the Mermaid chunks via `dagre-d3-es` and via the langium/chevrotain code inlined in `@mermaid-js/parser` | Not reachable: chevrotain 11.1.2 imports `map, isEmpty, forEach, isArray, has, clone, flatten, includes, values, reduce, keys, isUndefined, reject, isFunction, find, filter, dropRight, difference, last, isString, first, every, drop, compact, assign, uniq, some, pickBy, noop` (`npm pack chevrotain@11.1.2` + grep) — neither `template`, `unset` nor `omit`. The copy inlined in `@mermaid-js/parser@1.2.1` cannot be bumped from here; it is the same function set. Updated the resolvable copy. |
| `langium`, `chevrotain`, `chevrotain-allstar`, `@chevrotain/{gast,cst-dts-gen}` | no own advisory; flagged only as paths to `lodash-es` | 4.2.1 / 11.1.1 → removed from the tree | Code still ships inlined inside `@mermaid-js/parser@1.2.1` (`grep -c langium packages/serve/dist/client/assets/cynefin-*.js` → 29) | Same `lodash-es` analysis as above; no separate action possible or needed. |
| `uuid` | GHSA-w5hq-g745-h8pq (v3/v5/v6 `buf` bounds, moderate, `<11.1.1`) | 11.1.0 → 14.0.2 (`npm update`) | Yes, Mermaid chunk | Not reachable: Mermaid uses `v4`/`v5` without a caller-supplied `buf` (bounds check applies to the `buf` argument). Updated. |

### 2.6 Shipped packages with no advisory

For completeness, the other runtime packages in the bundles (`react`, `react-dom`,
`react-markdown`, `rehype-raw`, `remark-gfm`, `prismjs`, `prism-themes`, `@uiw/react-md-editor`,
`@base-ui/react`, `@radix-ui/*`, `lucide-react`, `yaml`, `ignore`, `xmllint-wasm`,
`react-resizable-panels`, `@emoji-mart/data`, `clsx`, `tailwind-merge`, `class-variance-authority`,
`electron-squirrel-startup`) had no entry in the audit and were not touched.

## 3. Tooling-only advisories: out of scope, in aggregate

Everything else in the 99-entry audit is build, test, lint, release or packaging tooling that is
never in an artifact (section 1 shows zero `node_modules` in the asar, builtin-only externals in the
serve CLI, and no tooling names in any bundle beyond the manifest string). Not updated by this
task, by design ("no blanket tooling upgrades"):

- **Electron Forge 7.11.1 and its tree** (`@electron-forge/*`, `@electron/packager`,
  `@electron/rebuild`, `@electron/node-gyp`, `extract-zip`, `tar`, `cacache`, `make-fetch-happen`,
  `tmp`, `external-editor`, `@inquirer/*`, `sockjs`, `webpack-dev-server`,
  `webpack-dev-middleware`, `uuid@8` under sockjs). Fix is Forge 8.0.1, a major; packaging with 7.11.1
  and Electron 44.5.1 was verified to work (`npm run package` exit 0, fuses applied), so the major
  is deferred.
- **Test tooling**: `vitest`, `@vitest/{ui,coverage-v8,mocker}`, `vite`, `esbuild`, `fflate`,
  `flatted`, `playwright-bdd`, `@cucumber/*`, `jsdom`'s `@xmldom/xmldom`, `ws`,
  `websocket-driver`, `http-proxy-middleware`, `launch-editor`, `shell-quote`, `body-parser`,
  `path-to-regexp`, `qs`, `follow-redirects`, `node-forge`, `@tootallnate/once`, `undici`.
- **Build/lint tooling**: `copy-webpack-plugin`/`serialize-javascript`, `@babel/core`,
  `browserslist`, `baseline-browser-mapping`, `picomatch`, `brace-expansion`, `@humanfs/node`,
  `postcss`, `postcss-selector-parser`, `nanoid` (via postcss; `nanoid` is absent from every
  bundle: `cat .webpack/x64/renderer/*/index.js packages/serve/dist/client/assets/*.js | grep -c -F nanoid` → 0).
- **Release tooling declared as production dependencies** (see section 1): `semantic-release`,
  `@semantic-release/*`, `@commitlint/*` and their `npm`, `pacote`, `@npmcli/*`, `libnpm*`,
  `sigstore`/`@sigstore/*`, `ip-address`, `js-yaml`, `fast-uri`, `lodash` chains. These are the 25
  entries `npm audit --omit=dev` still reports after this task; every one of them resolves through
  `semantic-release`, `@semantic-release/npm`, `@semantic-release/github`, `@commitlint/cli`,
  `autoprefixer`, `postcss` or `@tailwindcss/postcss` (path map computed from
  `npm ls --omit=dev --all --json`).

## 4. Versions before and after

| Package           | Declared range before | after      | Resolved before | after    | Where declared                          |
| ----------------- | --------------------- | ---------- | --------------- | -------- | --------------------------------------- |
| `electron`        | `^40.4.0`             | `^44.5.1`  | 40.4.0          | 44.5.1   | root `devDependencies`                  |
| `mermaid`         | `^11.12.3`            | `^11.17.2` | 11.12.3         | 11.17.2  | root `dependencies`, `packages/react`   |
| `fast-xml-parser` | `^5.3.5`              | `^5.11.2`  | 5.5.3           | 5.11.2   | root `dependencies`, `packages/core`    |
| `dompurify`       | (transitive)          |            | 3.3.3           | 3.4.16   | via `mermaid`                           |
| `fast-xml-builder`| (transitive)          |            | 1.1.2           | 1.3.1    | via `fast-xml-parser`                   |
| `lodash-es`       | (transitive)          |            | 4.17.23         | 4.18.1   | via `mermaid`, `semantic-release`       |
| `uuid` (mermaid)  | (transitive)          |            | 11.1.0          | 14.0.2   | via `mermaid`                           |

Commands used (no `npm audit fix`):

```
npm install --save-dev electron@^44.5.1
npm install fast-xml-parser@^5.11.2 mermaid@^11.17.2
npm install fast-xml-parser@^5.11.2 -w @self-review/core
npm install mermaid@^11.17.2 -w @self-review/react
npm update dompurify lodash-es langium chevrotain chevrotain-allstar @chevrotain/gast @chevrotain/cst-dts-gen fast-xml-builder @mermaid-js/parser dagre-d3-es
npm update uuid
```

Lockfile delta: 11 packages added (`@nodable/entities`, `is-unsafe`, `xml-naming`, `anynum`,
`strictdom` for fast-xml-parser; `es-toolkit`, `fastdom`, `@upsetjs/venn.js` for Mermaid;
`@electron-internal/extract-zip`, `env-paths`, `undici` for Electron's downloader), 17 removed (the
langium/chevrotain/vscode-languageserver family and Electron's old `fs-extra`/`semver` copies).
`npm audit` totals: full tree 99 → 88 entries; `--omit=dev` 36 → 25, none of which is a shipped
package.

## 5. Verification

| Check                                           | Result                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ls electron mermaid dompurify fast-xml-parser` | 44.5.1 / 11.17.2 / 3.4.16 / 5.11.2                                                                                                                                                                                                                  |
| `npm audit --omit=dev --json`                   | exit 1 (25 tooling entries remain); `electron`, `mermaid`, `dompurify`, `fast-xml-parser`, `fast-xml-builder`, `lodash-es`, `uuid`, `langium`, `chevrotain` all absent                                                                                  |
| `npm run typecheck`                             | exit 0                                                                                                                                                                                                                                                   |
| `npm run typecheck:packages`                    | exit 0                                                                                                                                                                                                                                                   |
| `npm run lint`                                  | exit 1 — 2 pre-existing errors in committed audit probe files (`docs/codebase-audit-2026-10-01/ui.probe.test.tsx:10` unused import, `docs/security-audit-2026-10-01-sol/claude-probe-apply.ts:12` empty block). Identical in `HEAD`, outside this task's files, unrelated to dependency versions. |
| `npm run test:unit`                             | exit 0 on the final run (main 5 files, renderer 44 files, core 32 files, serve 6 files, all passing). An earlier run had 2 renderer failures in `useDiffNavigation.test.ts` while another task was mid-edit on that file; 8/8 when re-run alone.                 |
| `npm run build:packages`; serve workspace build | exit 0 / exit 0                                                                                                                                                                                                                                          |
| `npm run package`                               | exit 0 (Forge 7.11.1 + `@electron/fuses` 1.8.0 package Electron 44.5.1 without changes)                                                                                                                                                                   |
| `npm run test:e2e` (webapp)                     | exit 0 twice: 69 passed + 1 flaky-then-passed in a detached worktree of `HEAD` + these manifest changes (isolating the upgrade from five other tasks' in-flight edits), then 72 passed in the shared tree. Needed `npx playwright install chromium` first (build 1208 absent). |
| `npm run test:e2e:electron`                     | see note below                                                                                                                                                                                                                                           |

**Electron e2e environment note.** This host has no `xvfb-run` (not installable without sudo), so
`npm run test:e2e:electron` cannot run verbatim. The suite was run as
`npx bddgen && DISPLAY=:0 npx playwright test --project electron` against the live Xwayland
display. Under this KDE Wayland session Chromium auto-selects the Wayland backend and the app never
reaches `app.whenReady()`; this is **not** an Electron 44 regression — Electron 40.4.0 from the
download cache behaves identically on this desktop (both: no "App is ready!" after 15 s on Wayland;
both: ready within ~1 s with `--ozone-platform=x11`), and it does not affect CI, whose `xvfb-run`
provides a plain X11 display. For the local run only, `--ozone-platform=x11` was added to the
harness flags in the worktree copy of `tests/steps/app.ts`; the committed harness does not carry
that flag.

**Electron 44 findings from the e2e suite, and the three resulting edits.** The first run on
44.5.1 failed 5 scenarios that Electron 40.4.0 passes on the same display with the same bundle
(A/B done by swapping `node_modules/electron/dist`; 40: 38 passed, exit 0). Both causes were
measured with Playwright probes against the built bundle, not inferred:

1. _Finish Review right after launch wrote no file._ On 44 `firstWindow()` resolves while
   `page.url()` is still `''` (the initial empty document); the navigation to the app's
   `index.html` then destroys that execution context, so `page.evaluate(saveAndQuit)` threw
   "Execution context was destroyed" and the IPC never fired (4/4 reproductions; 0/4 after
   waiting for `#root`). Fix: `tests/steps/app.ts` waits for `#root` to be attached after
   `firstWindow()`. Scenarios that interacted with the UI first never hit this.
2. _Find bar counter read "0 of N"._ `FindBar.tsx` issued two back-to-back `findInPage` requests
   for a new search (`findNext: false` then `true`) as a workaround for an older Chromium; Chromium
   152 answers the pair with `activeMatchOrdinal: 0`. Measured through the real find bar: a single
   documented request (`findNext: true` for a new session, `false` to advance) still reports
   `0/5` on **both** 40 and 44, because Chromium starts at the focused element and the query inside
   the find input is itself the active match; blurring the input first gives `1/5`, `2/5`, `3/5`.
   Fix: one request per keypress, preceded by a blur on a new search. The component already
   assumed Chromium takes focus after a search (global Enter/Escape handler), so no interaction was
   removed.
3. _Expand-context line count was 0._ The step counted `[data-line-number]` with no wait; the
   earlier-returning launch (item 1) exposed the race. Fix: wait for the first line before
   counting (`tests/steps/12-expand-context.steps.ts`).

Result on 44.5.1 after the three edits (clean worktree, `DISPLAY=:0`, X11 ozone): **37 passed, 1
flaky (passed on retry), 0 failed, exit 0**. `typecheck:tests` exit 0 in the clean worktree (in the
shared tree it currently fails in `FrontMatterTable.tsx`, a file another task is editing).

## 6. Not done, on purpose

- No Forge 8 / vitest / playwright-bdd / copy-webpack-plugin upgrades (tooling; separate decision).
- No `dependencies` → `devDependencies` moves for release tooling (unrelated manifest churn; note
  in section 1 so it is not mistaken for shipped code).
- No Mermaid 12 (see 2.2). No signing or notarization.
- No main-process or core source change: no Electron 41–44 breaking change touches the APIs this
  app calls. The only source edit is `src/renderer/components/FindBar.tsx` (section 5, item 2),
  plus the two e2e harness waits.
