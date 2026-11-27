---
id: 1
group: "svelte-grammar"
dependencies: []
status: "completed"
created: 2026-11-13
skills:
  - prism-grammar-authoring
  - vitest
complexity_score: 5
complexity_notes: "Regex grammar design with several Svelte constructs and a backtracking constraint; single module plus its colocated test and one import line."
---
# Svelte Prism grammar module, registration and grammar tests

## Objective
Create `packages/react/src/components/DiffViewer/svelte-grammar.ts`, which registers `Prism.languages.svelte` by extending Prism's `markup` grammar, import it from `SyntaxLine.tsx`, and pin its tokenization with a colocated unit test, so that Svelte lines tokenize into themed tokens when highlighted one line at a time.

## Skills Required
Prism.js grammar authoring (`languages.extend`, `insertBefore`, `inside`, `lookbehind`, `greedy`) and Vitest unit testing.

## Acceptance Criteria
- [x] `svelte-grammar.ts` exists, registers `Prism.languages.svelte` as a side effect, and starts with a header comment explaining why the grammar is in-repo (Prism 1.x has no Svelte grammar and will not accept one; `prism-svelte` is unmaintained, its block rule never matches, it lacks Svelte 5) plus MIT attribution for any rule adapted from `prism-svelte` (pngwn) or `prism-code-editor` (jonpyt).
- [x] `SyntaxLine.tsx` imports `./svelte-grammar` after the JavaScript-family and markup imports.
- [x] `svelte-grammar.test.ts` passes and asserts token types for every construct listed in Technical Requirements, including that `#snippet` and `#if` are `keyword` tokens and `on:` is a `namespace` token.
- [x] A 2000-character brace-heavy line tokenizes in under 100 ms in the test.
- [x] Verification: `npx vitest run --config vitest.config.renderer.ts packages/react/src/components/DiffViewer/svelte-grammar.test.ts packages/react/src/components/DiffViewer/SyntaxLine.test.tsx` exits 0.
- [x] `npx eslint packages/react/src/components/DiffViewer/svelte-grammar.ts packages/react/src/components/DiffViewer/svelte-grammar.test.ts` and `npx prettier --check` on both files exit 0.
- [x] No change to any `package.json` or `package-lock.json`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Existing `prismjs` ^1.30.0 only; no new dependency.
- Grammar must be loaded after `prism-markup` and `prism-javascript` (it extends `markup` and embeds `javascript`).
- Constructs to tokenize (one line at a time):
  - Tags with brace-valued attributes: `<button on:click={() => count++}>` → `tag` with `attr-name`, a `namespace` token `on:`, and the braces' content as JavaScript; the `=` must NOT be part of the `attr-name` token.
  - Quoted attribute value with interpolation: `<div class="btn {active}">` → `attr-value` whose `{active}` is highlighted as JavaScript.
  - Shorthand attribute `<input {value} />` and spread `<Component {...props} />` → JavaScript inside the tag.
  - Directives `bind:value`, `class:active`, `use:action` → `namespace` prefix tokens.
  - `<svelte:head>` → tag name with `namespace` `svelte:`.
  - Text interpolation `<p>Clicked {count} times</p>` → `{count}` as JavaScript.
  - Block tags, one generic rule: `{` + sigil (`#`, `:`, `/`, `@`) + first word is a `keyword` token (e.g. `#if`, `:else`, `/if`, `#each`, `/each`, `#await`, `:then`, `:catch`, `@html`, `@debug`, `#key`, `@const`, `#snippet`, `@render`); the remainder of the block is highlighted as JavaScript. In `{:else if x > 0}` only `:else` is the Svelte keyword. In `{#each items as item, i (item.id)}` the `as` is a `keyword`.
  - HTML comment `<!-- note -->` → `comment` (inherited from markup).
- Nested braces: support one level of nesting inside `{…}` (e.g. `{fn({a: 1})}`), as `prism-svelte` does; keep patterns free of ambiguous alternations to avoid catastrophic backtracking.

## Input Dependencies
None. Reference material: plan 63 (Architectural Approach → Svelte Grammar Module) and the scratch test of `prism-svelte` described in its Background.

## Output Artifacts
- `packages/react/src/components/DiffViewer/svelte-grammar.ts`
- `packages/react/src/components/DiffViewer/svelte-grammar.test.ts`
- One added import line in `packages/react/src/components/DiffViewer/SyntaxLine.tsx`
- `Prism.languages.svelte` available to tasks 3's e2e scenario (via task 2's mapping).

## Implementation Notes
<details>
<summary>Step-by-step guidance</summary>

1. Read `packages/react/src/components/DiffViewer/SyntaxLine.tsx` to see how grammars are imported (side-effect imports of `prismjs/components/*`, `import Prism from 'prismjs'`). Read `packages/react/src/declarations.d.ts`.
2. Create `svelte-grammar.ts`:
   - `import Prism from 'prismjs';` and import `prismjs/components/prism-markup` and `prismjs/components/prism-javascript` at the top too, so the module is order-safe on its own (duplicate side-effect imports are no-ops).
   - Header comment (concise, 5–10 lines): why in-repo; attribution "Tag/attribute rule adapted from prism-svelte by pngwn (MIT)" if you adapt it.
   - Build with `Prism.languages.extend('markup', { … })` and then `Prism.languages.insertBefore('svelte', …)` as needed. A reasonable structure:
     - A reusable brace source: `const BRACES = /\{(?:[^{}]|\{[^{}]*\})*\}/.source;` (one level of nesting, linear).
     - `block`: pattern `new RegExp('\\{[#:/@][a-z]+(?:[^{}]|\\{[^{}]*\\})*\\}')`, `inside`: `{ punctuation: /^\{|\}$/, keyword: [/^\{[#:/@][a-z]+/ → strip the `{` by using lookbehind: /(^\{)[#:/@][a-z]+/ with lookbehind: true, /\bas\b/ ], 'language-javascript': { pattern: /[\s\S]+/, inside: Prism.languages.javascript } }`. Order inside matters: keyword before the JS catch-all. Make sure `#each … as …` yields `as` as keyword (put an `as` rule before the JS rule, or tokenize `as` in a dedicated `each` sub-pattern).
     - `tag`: copy markup's tag shape but allow `={…}` values and standalone `{…}` attributes. Inside: `tag` (name with `punctuation` `<`/`</` and `namespace` `/^[^\s>\/:]+:/`), `'language-javascript'` for `{…}` (with `inside: { punctuation: /^\{|\}$/, rest: Prism.languages.javascript }` or similar), `attr-value` for quoted values with an inner `'language-javascript'` brace rule, `punctuation` for `/?>` and `=`, and `attr-name` with `namespace`. Ensure `attr-name`'s pattern excludes `=` (e.g. `/[^\s>\/={}]+/`).
     - `'language-javascript'` interpolation at top level: pattern from `BRACES`, `inside` JavaScript.
   - Insert `block` before the top-level interpolation rule so `{#if}` is not swallowed by the generic `{…}` rule. Verify with tests.
3. Add `import './svelte-grammar';` to `SyntaxLine.tsx` immediately after the existing `prism-xml-doc` import (end of the import block), with a short comment like `// Svelte (in-repo grammar; Prism 1.x ships none)`.
4. Create `svelte-grammar.test.ts` (Vitest globals are enabled; jsdom env). Import `Prism from 'prismjs'` and `'./svelte-grammar'`. Write a helper that flattens `Prism.tokenize(line, Prism.languages.svelte)` into `[type, text]` pairs (recursively, recording each token's type and its stringified content). Assert presence of specific `[type, text]` pairs per line rather than snapshotting the whole tree, so tests stay readable. Cover every construct in Technical Requirements in a few grouped `it` blocks (markup/attributes, directives & special elements, interpolation, Svelte 4 blocks, Svelte 5 blocks, comment). Include a `performance.now()` check on a 2000-char line built from repeated `{a}{b{c}}` and `<x y={z}>` segments, asserting < 100 ms.
5. Run the verification commands from Acceptance Criteria. If `npm ci` has not been run yet in this checkout, run it first (it is a plan prerequisite).

Test philosophy (copied from task generation rules): write a few tests, mostly integration. Test custom logic (this grammar is custom logic); do not test Prism itself or trivial configuration; combine related scenarios into a few `it` blocks; favor critical-path coverage.
</details>
