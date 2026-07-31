---
id: 2
group: "css-scoping"
dependencies: []
status: "completed"
created: 2026-03-14
skills:
  - css
---
# Scope CSS Selectors Under `.self-review`

## Objective
Refactor `packages/react/src/styles.css` so that all global `*` selectors (border-color, scrollbar styling) and component-specific overrides are scoped under the `.self-review` container class, preventing style leakage into host applications.

## Skills Required
- **css**: CSS selector scoping, CSS nesting, Tailwind v4 `@custom-variant` patterns

## Acceptance Criteria
- [ ] `* { border-color: ... }` changed to `.self-review * { border-color: ... }`
- [ ] All `*` scrollbar selectors (`scrollbar-width`, `scrollbar-color`, `::-webkit-scrollbar*`) scoped under `.self-review`
- [ ] `.token.table` override scoped under `.self-review`
- [ ] MDEditor overrides (`.md-editor-comment.*`) scoped under `.self-review`
- [ ] Rendered markdown view overrides (`.rendered-markdown-view`) scoped under `.self-review`
- [ ] `:root` CSS variable definitions remain global (intentional — they define default values that cascade)
- [ ] `.dark` CSS variable overrides remain global (they are used via `hsl(var(--...))` references)
- [ ] `@custom-variant dark` declaration remains as-is (it already targets `.dark *` ancestors)
- [ ] `@theme inline` block remains as-is (compile-time only, not runtime selectors)

## Technical Requirements
- The `.self-review` class will be applied by a wrapper div rendered by `ConfigProvider` (implemented in task 03)
- `:root` and `.dark` variable definitions should NOT be scoped — they define CSS custom property values that are intentionally global defaults
- `@custom-variant dark (&:is(.dark *))` — this makes `dark:` utilities activate when any ancestor has `.dark`. This is correct for the scoped wrapper approach and should not change.
- MDEditor overrides use `.md-editor-comment` which is a class applied within the library's DOM — scope these for good measure
- Rendered markdown overrides use `.rendered-markdown-view` — also applied within the library's DOM

## Input Dependencies
None — this is a pure CSS file edit.

## Output Artifacts
- `packages/react/src/styles.css` (modified with scoped selectors)

## Implementation Notes

<details>
<summary>Step-by-step changes to styles.css</summary>

### Selectors to scope

Replace the three `*` blocks and subsequent scrollbar blocks:

**Before:**
```css
* {
  border-color: hsl(var(--border));
}

/* Ultra-subtle scrollbars */
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

*:hover {
  scrollbar-color: hsl(var(--border) / 0.3) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

*:hover::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.3);
}

*::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--border) / 0.5);
}

/* Prevent Tailwind .table utility from overriding Prism token spans */
.token.table {
  display: inline;
}
```

**After:**
```css
.self-review * {
  border-color: hsl(var(--border));
}

/* Ultra-subtle scrollbars */
.self-review * {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.self-review *:hover {
  scrollbar-color: hsl(var(--border) / 0.3) transparent;
}

.self-review *::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.self-review *::-webkit-scrollbar-track {
  background: transparent;
}

.self-review *::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

.self-review *:hover::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.3);
}

.self-review *::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--border) / 0.5);
}

/* Prevent Tailwind .table utility from overriding Prism token spans */
.self-review .token.table {
  display: inline;
}
```

### MDEditor overrides — scope by prepending `.self-review`

```css
.self-review .md-editor-comment.w-md-editor { ... }
.self-review .md-editor-comment .w-md-editor-toolbar { ... }
/* etc. for all .md-editor-comment .* selectors */
```

### Rendered markdown overrides — scope by prepending `.self-review`

```css
.self-review .rendered-markdown-view table { ... }
.self-review .rendered-markdown-view pre { ... }
/* etc. */
```

Also scope the dark variant override at the bottom:
```css
/* Before: */
.dark .rendered-markdown-view { ... }

/* After: */
.self-review.dark .rendered-markdown-view { ... }
/* OR — since dark will be on the .self-review div: */
.dark .rendered-markdown-view { ... }
/* Note: .dark will be set on the .self-review wrapper, so .dark .rendered-markdown-view
   would still match as long as .rendered-markdown-view is a descendant.
   Use .self-review .dark .rendered-markdown-view only if .dark is nested further. */
```

The `.dark` class will be on the `.self-review` wrapper div itself (e.g., `<div class="self-review dark">`), so the selector `.dark .rendered-markdown-view` will NOT match because `.dark` is an ancestor of `.rendered-markdown-view` but `.dark` IS the `.self-review` element. Use:
```css
.self-review.dark .rendered-markdown-view {
  --tw-prose-pre-bg: hsl(220, 13%, 18%);
  ...
}
```

### Leave unchanged
- `@custom-variant dark (&:is(.dark *))` — compile-time directive, not a runtime selector
- `@theme inline { ... }` — compile-time Tailwind token definitions
- `:root { ... }` — intentionally global CSS custom properties
- `.dark { ... }` — intentionally global CSS custom properties for dark mode variables
</details>
