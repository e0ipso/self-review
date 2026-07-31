---
id: 2
group: "css-bundling"
dependencies: []
status: "completed"
created: "2026-03-16"
skills:
  - css
---
# Bundle md-editor and Prism Theme CSS into build-styles.css

## Objective
Add `@import` statements for `@uiw/react-md-editor` CSS and Prism light/dark theme CSS to `build-styles.css`, scoped under `.self-review`, so that `dist/styles.css` includes all required styles out of the box.

## Skills Required
- CSS (imports, nesting, scoping, Tailwind v4 build pipeline)

## Acceptance Criteria
- [ ] `build-styles.css` imports `@uiw/react-md-editor/markdown-editor.css`
- [ ] `build-styles.css` imports `prismjs/themes/prism.css` (light) and `prism-themes/themes/prism-one-dark.css` (dark)
- [ ] All imported CSS is scoped under `.self-review` to prevent style leakage
- [ ] Prism dark theme is scoped under `.self-review.dark`
- [ ] Prism light theme is scoped under `.self-review:not(.dark)`
- [ ] `dist/styles.css` contains `.token` selectors (count > 50)
- [ ] `dist/styles.css` contains `wmde-markdown` or `data-color-mode` selectors
- [ ] `npm run build` in `packages/react` succeeds without errors
- [ ] Existing `prismLightCss`/`prismDarkCss` props still work as overrides (no changes to ConfigContext)

## Technical Requirements
- Tailwind v4 CSS build pipeline (`tailwindcss -i src/build-styles.css -o dist/styles.css`)
- CSS nesting syntax for scoping
- The specific theme files: `prismjs/themes/prism.css`, `prism-themes/themes/prism-one-dark.css`
- The md-editor stylesheet: `@uiw/react-md-editor/markdown-editor.css`

## Input Dependencies
None — this task is independent of the Prism loading consolidation (task 1).

## Output Artifacts
- Modified `packages/react/src/build-styles.css` with scoped CSS imports
- Updated `packages/react/dist/styles.css` (build output) containing all bundled styles

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### File: `packages/react/src/build-styles.css`

The current file is minimal:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "./styles.css";
@source "../dist";
```

**Approach: CSS nesting for scoping**

Tailwind v4 supports CSS nesting. However, `@import` cannot be nested inside a selector block per the CSS spec. The approach is to use intermediate wrapper CSS files or inline the content using `@layer` with nesting.

**Option A: Direct import with nesting wrapper files**

Create small intermediate CSS files that wrap the third-party CSS under `.self-review`:

1. Create `packages/react/src/vendor/md-editor-scoped.css`:
```css
.self-review {
  @import '@uiw/react-md-editor/markdown-editor.css';
}
```

If `@import` inside nesting doesn't work with Tailwind v4, use Option B instead.

**Option B: postcss-import or manual copy approach**

If CSS nesting with `@import` is not supported, create wrapper files that use `@import` at the top level but are themselves imported into `build-styles.css`. Tailwind v4's `@import` handling should flatten these.

**Most likely working approach:**

Add to `build-styles.css` after the existing imports:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "./styles.css";

/* Third-party CSS scoped to .self-review */
@import "./vendor/md-editor-scoped.css";
@import "./vendor/prism-light-scoped.css";
@import "./vendor/prism-dark-scoped.css";

@source "../dist";
```

Create three wrapper files in `packages/react/src/vendor/`:

**`md-editor-scoped.css`:**
```css
@import '@uiw/react-md-editor/markdown-editor.css' layer(md-editor);

@layer md-editor {
  /* Styles already imported above — scoped via .self-review nesting if needed */
}
```

**Important:** The exact scoping mechanism depends on how Tailwind v4 handles nested `@import`. Test the build after adding each import. If pure CSS nesting doesn't work:

1. Copy the CSS content from the node_modules files
2. Wrap them manually in `.self-review { ... }` blocks
3. This is less maintainable but guaranteed to work

**`prism-light-scoped.css`:**
Wrap `prismjs/themes/prism.css` content inside:
```css
.self-review:not(.dark) {
  /* prism light theme token selectors */
}
```

**`prism-dark-scoped.css`:**
Wrap `prism-themes/themes/prism-one-dark.css` content inside:
```css
.self-review.dark {
  /* prism dark theme token selectors */
}
```

### Verification
After implementation, run:
```bash
cd packages/react && npm run build
grep -c '\.token' dist/styles.css        # expect > 50
grep -c 'wmde-markdown\|data-color-mode' dist/styles.css  # expect > 0
```

### Edge case: Tailwind v4 `@import` behavior
If Tailwind v4's `@import` doesn't support nesting or flattening third-party CSS correctly, the fallback is to manually inline the vendor CSS content into the wrapper files. The vendor CSS files are small enough (~5KB each for Prism, ~15KB for md-editor) that this is acceptable.

</details>
