---
id: 2
group: "rendered-markdown-fixes"
dependencies: []
status: "completed"
created: "2026-02-27"
skills:
  - css
---
# Add CSS Overrides for Prose Margins in Rendered Markdown View

## Objective
Override `@tailwindcss/typography` prose margins on tables, `<pre>`, and `<details>` elements within `.rendered-markdown-view` to prevent excessive spacing caused by compounding prose margins with the gutter's `4rem` left padding.

## Skills Required
- css: Tailwind CSS prose customization and specificity management

## Acceptance Criteria
- [ ] HTML tables have margins consistent with paragraphs and other block elements (no excessive spacing)
- [ ] `<pre>` elements (code blocks and mermaid containers) have reduced margins matching other blocks
- [ ] `<details>` elements have consistent margin treatment
- [ ] Overrides only affect `.rendered-markdown-view` — no regressions in other prose-styled content
- [ ] Works in both light and dark themes

## Technical Requirements
- Add targeted CSS rules in `src/index.css` scoped to `.rendered-markdown-view`
- Must have sufficient specificity to override `@tailwindcss/typography` prose defaults
- No `!important` should be needed if scoped under `.rendered-markdown-view`

## Input Dependencies
None — this task is independent.

## Output Artifacts
- Modified `src/index.css` with `.rendered-markdown-view` scoped CSS overrides

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

**File to modify**: `src/index.css`

**Context**: The rendered markdown view container has classes `prose dark:prose-invert max-w-none p-4 rendered-markdown-view` (see `RenderedMarkdownView.tsx` line 261). The `.rendered-markdown-view` class is the scoping selector.

**Add the following CSS rules** at the end of `src/index.css` (or in a logical section if the file has organized sections):

```css
/* Rendered markdown view: override prose margins that compound with gutter padding */
.rendered-markdown-view table {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

.rendered-markdown-view pre {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

.rendered-markdown-view details {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}
```

**Specificity notes**: The `.rendered-markdown-view` selector combined with the element selector (e.g., `.rendered-markdown-view table`) should have sufficient specificity to override Tailwind's prose styles, which are typically applied via `.prose table`. If the prose styles use higher specificity selectors (like `:where(.prose > :first-child)`), the `.rendered-markdown-view` scope will still win because `:where()` has zero specificity.

**Margin values**: Use `0.75em` to match the spacing feel of paragraphs in the gutter layout. Adjust if needed after visual inspection — the goal is consistency with other block elements, not an exact pixel match.

**Testing**: Open a markdown file containing tables, code blocks, and `<details>` elements in the rendered view. Compare spacing with paragraphs — they should feel visually consistent. Check both light and dark themes.

</details>
