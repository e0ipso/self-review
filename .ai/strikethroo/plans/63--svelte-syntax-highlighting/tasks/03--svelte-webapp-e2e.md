---
id: 3
group: "e2e"
dependencies: [1, 2]
status: "completed"
created: 2026-11-13
skills:
  - playwright-bdd
  - typescript
complexity_score: 3
---
# Webapp e2e scenario for Svelte highlighting on a dedicated fixture

## Objective
Add a dedicated `svelte` webapp fixture and a BDD scenario proving a `.svelte` file renders highlighted code lines in the diff view, without touching the default six-file fixture.

## Skills Required
Playwright with playwright-bdd (Gherkin features + step definitions) and TypeScript fixture data.

## Acceptance Criteria
- [ ] `tests/webapp/fixture-data.ts` exports `createSveltePayload()` returning one modified `.svelte` `DiffFile` (path `src/lib/Counter.svelte`) whose hunk lines include: a tag with an `on:click={…}` directive, an `{#if …}` / `{:else}` / `{/if}` block, a `{count}` interpolation, a `bind:value={…}` input, and a Svelte 5 `{#snippet …}` / `{@render …}` pair; with addition, deletion and context lines.
- [ ] `tests/webapp/main.tsx` returns that payload when `?fixture=svelte`.
- [ ] A `Given the webapp is loaded with Svelte fixture data` step exists in `tests/webapp-steps/01-launch-and-display.steps.ts`.
- [ ] A scenario in `tests/webapp-features/01-launch-and-display.feature` loads that fixture and asserts `the file section for "src/lib/Counter.svelte" should contain highlighted code lines`, plus a new step asserting the section contains a `.token.keyword` with text `#if` and a `.token.namespace` with text `on:`.
- [ ] The default fixture (`createFixturePayload`) and every existing scenario are unchanged.
- [ ] Verification: `npm run test:e2e` exits 0, and its output lists the new scenario as passed.
- [ ] `npm run typecheck:tests` exits 0; `npx prettier --check` on touched files exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Follow the existing named-fixture pattern (`markdown`, `rendered-html`, `hostile-content` in `tests/webapp/main.tsx` and `tests/webapp-steps/08-rendered-markdown.steps.ts`).
- A feature file's `Background` applies to all its scenarios; `01-launch-and-display.feature` has `Background: Given the webapp is loaded with fixture data`. Either place the Svelte scenario so it reloads with the Svelte fixture after the background (a `Given` inside the scenario that relaunches the webapp), or, if relaunching inside a scenario is not supported by `launchWebapp`/`cleanup`, create a new feature file `tests/webapp-features/15-svelte-highlighting.feature` (use the next free number) with its own Background. Prefer the new feature file if in doubt; put its steps in a matching new steps file only if the existing steps file cannot be reused (steps are global in playwright-bdd, so the existing `should contain highlighted code lines` step is reusable from any feature).
- Playwright Chromium and system libraries must be installed (`npx playwright install chromium`, `sudo npx playwright install-deps chromium`) — plan prerequisite.

## Input Dependencies
- Task 1: `Prism.languages.svelte` registered via `SyntaxLine.tsx`.
- Task 2: `.svelte` mapped to `'svelte'` in the react `getLanguageFromPath`.

## Output Artifacts
- Svelte fixture in `tests/webapp/fixture-data.ts`, its selector in `tests/webapp/main.tsx`, a Given step, the token-assertion step, and the scenario (in `01-…feature` or a new feature file).

## Implementation Notes
<details>
<summary>Step-by-step guidance</summary>

1. Read `tests/webapp/fixture-data.ts` (see `loginFile` for a modified file with mixed line types and `createMarkdownPayload` for a named payload), `tests/webapp/main.tsx` `getFixturePayload()`, `tests/webapp-steps/01-launch-and-display.steps.ts` (the `should contain highlighted code lines` step at ~line 82) and `tests/webapp-steps/08-rendered-markdown.steps.ts` (named-fixture Given steps).
2. Add a `svelteFile: DiffFile` with `oldPath` and `newPath` `src/lib/Counter.svelte`, `changeType: 'modified'`, one hunk whose header counts match its lines exactly (old count = context + deletions, new count = context + additions). Example lines:
   - context `<script>`, context `  let count = 0;`, context `</script>`,
   - deletion `<button on:click={increment}>`, addition `<button on:click={() => count++}>`,
   - addition `  {#if count > 0}Clicked {count} times{:else}Click me{/if}`,
   - context `</button>`,
   - addition `<input bind:value={name} />`,
   - addition `{#snippet row(item)}<li>{item}</li>{/snippet}`, addition `{@render row(name)}`.
   Then `export function createSveltePayload(): DiffLoadPayload` returning `{ files: [svelteFile], source: { type: 'git' as const, gitDiffArgs: '', repository: '/mock-test-repo' } }`.
3. In `main.tsx`, import `createSveltePayload` and add `if (fixture === 'svelte') return createSveltePayload();` next to the other named fixtures.
4. Add `Given('the webapp is loaded with Svelte fixture data', async () => { await launchWebapp({ fixture: 'svelte' }); });` to `01-launch-and-display.steps.ts`.
5. Add a Then step, e.g. `the file section for {string} should contain a {string} token with text {string}`, that locates `[data-testid="file-section-${filePath}"] .token.${type}` filtered by exact text, waits for the first match (`toBeAttached({ timeout: 10000 })`, same as the existing highlighted-lines step).
6. Add the scenario (new feature file recommended, see Technical Requirements):
   ```
   Feature: Svelte syntax highlighting
     Background:
       Given the webapp is loaded with Svelte fixture data
     Scenario: Svelte component diff is syntax highlighted
       Then the file section for "src/lib/Counter.svelte" should contain highlighted code lines
       And the file section for "src/lib/Counter.svelte" should contain a "keyword" token with text "#if"
       And the file section for "src/lib/Counter.svelte" should contain a "namespace" token with text "on:"
   ```
7. Run `npm run test:e2e` (it runs `bddgen` first if configured; check `package.json`), confirm the new scenario passes and the total failures are 0. Run `npm run typecheck:tests` and prettier.

Test philosophy (copied from task generation rules): write a few tests, mostly integration. This single scenario is the critical-path integration check; do not add per-construct e2e scenarios (the grammar unit tests own construct coverage).
</details>
