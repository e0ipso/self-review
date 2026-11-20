---
id: 3
group: "helper"
dependencies: []
status: "completed"
created: 2026-11-20
skills:
  - npm-workspaces
  - tsup-bundling
complexity_score: 6
complexity_notes: "Two skills and the bundle-feasibility question (inlining core modules into a dependency-free .cjs). Kept as one task because the scaffold, bundle pipeline and staleness check are only verifiable together."
---
# Scaffold the skill-scripts workspace package and its bundle pipeline

## Objective
Create a private workspace package that holds the stack helper's TypeScript source, bundles it with tsup into a committed, self-contained `.agents/skills/self-review-stack/scripts/stack.cjs`, and fails the unit suite when that committed bundle is stale. Prove that the core modules the helper needs (`parseGitDiffArgs`, `describeGitDiffSides`) inline into a bundle that runs on plain `node` with no `node_modules`.

## Skills Required
- `npm-workspaces`: new package, root script wiring.
- `tsup-bundling`: CommonJS single-file bundle for Node.

## Acceptance Criteria
- [ ] `packages/skill-scripts/` exists with `package.json` (`"name": "@self-review/skill-scripts"`, `"private": true`, scripts `build:skills` and `test:unit`), `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, a tsup config, and `src/stack/cli.ts` as the entry point.
- [ ] The entry point already parses a subcommand and, for `resolve <git-diff-args...>`, prints the old and new side kinds from `describeGitDiffSides` (a placeholder that task 4 replaces), and exits non-zero with usage on an unknown subcommand.
- [ ] `npm run build:skills --workspace @self-review/skill-scripts` writes `.agents/skills/self-review-stack/scripts/stack.cjs`; running it twice produces byte-identical output.
- [ ] Copying `stack.cjs` alone into a fresh temp directory outside the repo and running `node stack.cjs resolve --staged` inside a disposable git repo prints the side description and exits 0 (no `Cannot find module`).
- [ ] A vitest test in the package rebuilds the bundle into a temp directory and fails, with a message naming the rebuild command, when it differs from the committed `stack.cjs`; the test passes after a rebuild.
- [ ] Root `package.json`: `test:unit` runs `npm run test:unit --workspace @self-review/skill-scripts`; `typecheck:packages` includes `tsc -p packages/skill-scripts/tsconfig.json --noEmit`. `npm run test:unit`, `npm run typecheck:packages`, `npm run typecheck:unit` and `npm run lint` exit 0.
- [ ] No new third-party dependency (tsup, vitest and typescript are already used by core and serve). The package is not referenced by Electron Forge, webpack configs or `@self-review/serve`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Import core source modules by relative path (as the Electron app does), e.g. `../../../core/src/git-argument-policy` and `../../../core/src/source-identity`, not the `@self-review/core` barrel, so only what is needed is bundled. Declare `"@self-review/core": "*"` in devDependencies only if the tsconfig/vitest resolution needs it.
- tsup config: `entry: { stack: 'src/stack/cli.ts' }`, `format: ['cjs']`, `platform: 'node'`, explicit `target: 'node20'` (do not derive from the running Node), `bundle: true`, `noExternal: [/.*/]`, `sourcemap: false`, `dts: false`, `splitting: false`, `outDir: '../../.agents/skills/self-review-stack/scripts'`, `outExtension: () => ({ js: '.cjs' })`, `clean: false` (never wipe the skill directory), a fixed `banner` with a shebang and a "generated, do not edit; rebuild with npm run build:skills --workspace @self-review/skill-scripts" line, and no timestamps. Check the tsup docs for the installed version's option names.
- If bundling `source-identity.ts` drags in a runtime npm dependency or a `.wasm` asset (inspect the bundle for `xmllint`, `require("yaml")`, `require("ignore")` and the bundle size), extract the pure `describeGitDiffSides` logic (and the small helpers it uses) into a new dependency-free core module, re-export it from `source-identity.ts` so existing imports keep working, and run core's unit suite to prove behavior is unchanged.
- Staleness test: build to `os.tmpdir()` via tsup's programmatic `build()` with the same options except `outDir`, then compare bytes with the committed file.
- `vitest.setup.ts` must call core's `stripGitRepoEnv()` (`packages/core/src/test-support/git-env.ts`) so tests spawning git ignore a hook's `GIT_DIR`/`GIT_INDEX_FILE`.

## Input Dependencies
None.

## Output Artifacts
- `packages/skill-scripts/` package, build and test wiring, committed `stack.cjs` placeholder bundle, staleness test. Tasks 4 and 5 add the helper's real subcommands to `src/stack/`.

## Implementation Notes
<details>
<summary>Guidance</summary>

- Model files on `packages/core` (`tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`) and `packages/config` (`package.json`, `tsup.config.ts`). Root `package.json` uses `"workspaces": ["packages/*"]`, so the package is picked up by `npm install`; run `npm install` once so the lockfile records it (commit the lockfile change).
- `tsconfig.unit-tests.json` already includes `packages/*/src/**/*.test.ts`, so tests are typechecked by `typecheck:unit`; make sure the package's own tsconfig excludes tests or includes them consistently with core.
- Check `eslint.config.mjs` ignores; the package's `src/` should be linted like other packages. `.agents/` is ignored by ESLint and Prettier already, which is correct for the generated bundle.
- Minimal placeholder `cli.ts`: read `process.argv.slice(2)`; `resolve` prints `old: <kind>` / `new: <kind>` from `describeGitDiffSides(args)`; otherwise print usage to stderr and `process.exitCode = 2`. Task 4 replaces `resolve`'s body.
- Bundle-only smoke check: `tmp=$(mktemp -d); cp .agents/skills/self-review-stack/scripts/stack.cjs $tmp/; repo=$(mktemp -d); git -C $repo init -q; (cd $repo && node $tmp/stack.cjs resolve --staged)`.
- Write the staleness test so its failure message says exactly: `stack.cjs is stale: run npm run build:skills --workspace @self-review/skill-scripts`.
- Test philosophy for this plan: write a few tests, mostly integration. Test custom logic, critical workflows, edge cases and error conditions in core functionality, and integration points; do not test third-party library behavior, trivial getters or static configuration. Here, the staleness test plus the bundle smoke check are the meaningful tests.
- Commit: `build(skill-scripts): add workspace package and stack.cjs bundle pipeline`, no AI trailers.
</details>
