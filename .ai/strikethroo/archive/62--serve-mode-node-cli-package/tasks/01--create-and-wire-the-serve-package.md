---
id: 1
group: "serve-mode-node-cli-package"
dependencies: []
status: "completed"
created: 2026-09-09
skills:
  - nodejs
  - build-tooling
complexity_score: 4
execution_profile: "standard-implementation"
---
# Create and wire the serve package

## Objective
Add `packages/serve` as a publishable workspace package that declares an
executable, and wire it into the workspace, the release configuration, the
publish loop and the coverage script.

## Skills Required
`nodejs` for npm workspace and manifest configuration; `build-tooling` for the
tsup build and the bin entry point.

## Acceptance Criteria
- [ ] `packages/serve/package.json` exists with a `bin` entry, `publishConfig.access: "public"`, a `tsup` build, and `@self-review/core` and `@self-review/react` as dependencies by version range — not `*`.
- [ ] `npm install` succeeds and `ls -l node_modules/@self-review/serve` resolves to a symlink into `packages/serve`.
- [ ] `.releaserc.json` gains one `@semantic-release/npm` plugin entry with `pkgRoot: "packages/serve"` and one `packages/serve/package.json` path in the `@semantic-release/git` assets array.
- [ ] The publish loop in `.github/workflows/release.yml` reads `for pkg in packages/types packages/core packages/react packages/serve`.
- [ ] `npm run build --workspace @self-review/serve` exits 0 and produces `dist/`.
- [ ] `npm run lint` exits 0 with no new warnings.
- [ ] The root `test:unit` and `test:coverage` scripts are unchanged, and `npm run test:unit` still exits 0.

## Technical Requirements
Model the manifest on `packages/core/package.json`, which is the closest
published precedent: `type: module`, tsup build, `files: ["dist"]`,
`publishConfig.access: "public"`. Unlike `core` it also needs a `bin`. No
package in this repository has one yet, so there is no local pattern to copy for
that field specifically.

Dependencies on `core` and `react` must be version ranges rather than `*`,
because an externally installed package resolves them from the registry. Inside
the workspace they resolve through the symlinks regardless.

## Input Dependencies
None. This is the first task.

## Output Artifacts
A buildable, publishable `packages/serve` skeleton that later tasks fill in, and
release automation that already knows about it.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Create `packages/serve/package.json`. Start from `packages/core/package.json` and change: the name to `@self-review/serve`, add `"bin": { "self-review-serve": "./dist/cli.js" }`, and set dependencies to `{"@self-review/core": "^1.43.4", "@self-review/react": "^1.43.4"}` — use the current workspace version, which `node -e "console.log(require('./packages/core/package.json').version)"` prints.
2. Create `packages/serve/tsup.config.ts` modelled on `packages/core/tsup.config.ts`. The entry is the CLI; keep `@self-review/*` external, as the repository does everywhere.
3. Create `packages/serve/vitest.config.ts` modelled on `packages/core/vitest.config.ts`. Do NOT set `passWithNoTests`; later tasks add real tests, and a suite that passes while running nothing is the failure this project has already been bitten by once.
4. Add a minimal `src/cli.ts` that exits 0, so the build has an entry and later tasks have somewhere to write. Nothing more.
5. Do NOT touch the root `test:unit` or `test:coverage` scripts. Wiring an empty
   workspace into `test:unit` turns it red, and the pre-commit hook and CI both
   run exactly that script — so this phase could not be committed. Task 2 adds the
   first test file and wires both scripts in the same change.
6. `.releaserc.json`: add `["@semantic-release/npm", { "npmPublish": false, "pkgRoot": "packages/serve" }]` after the `packages/react` entry, and add `"packages/serve/package.json"` to the `@semantic-release/git` assets array.
7. `.github/workflows/release.yml`: extend the `for pkg in ...` loop with `packages/serve`.
8. Run `npm install`, then the build, then lint.

Do not add an HTTP server, routes, or a client here. This task is the package and
its wiring only.
</details>
