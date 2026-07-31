---
id: 1
group: "rendered-markdown-view"
dependencies: []
status: "completed"
created: "2026-02-18"
skills: ["typescript"]
---

# Install Dependencies for Rendered Markdown View

## Objective

Install the npm packages required for the rendered markdown view feature: `react-markdown`, `remark-gfm`, `mermaid`, and `@tailwindcss/typography`.

## Skills Required

TypeScript / npm package management — adding dependencies and verifying they resolve correctly with the existing project setup.

## Acceptance Criteria

- [ ] `react-markdown` is installed as a production dependency
- [ ] `remark-gfm` is installed as a production dependency (needed for GFM tables, strikethrough, etc.)
- [ ] `mermaid` is installed as a production dependency
- [ ] `@tailwindcss/typography` is installed as a dev dependency
- [ ] The project builds successfully with `npm run build` after installation
- [ ] Typography plugin is registered in the Tailwind configuration

## Technical Requirements

- The project uses **Tailwind CSS 4.x** with `@tailwindcss/postcss@4.1.18`. The typography plugin integration must be compatible with Tailwind 4.
- `react-markdown` is a React component that renders markdown with AST position data — critical for the line mapping feature.
- `remark-gfm` enables GitHub Flavored Markdown support (tables, strikethrough, task lists).
- `mermaid` is used for rendering `mermaid` code blocks as SVG diagrams.

## Input Dependencies

None — this is the first task.

## Output Artifacts

- Updated `package.json` with new dependencies
- Updated `package-lock.json`
- Tailwind config updated with typography plugin (if needed for Tailwind 4)

## Implementation Notes

<details>

1. Run: `npm install react-markdown remark-gfm mermaid`
2. Run: `npm install -D @tailwindcss/typography`
3. For Tailwind 4.x, the typography plugin is registered differently than v3. In Tailwind 4, add `@plugin "@tailwindcss/typography";` to the CSS file where Tailwind is imported (likely `src/index.css` or similar). Check the existing Tailwind setup in the project to determine the correct integration point.
4. Verify the build passes: `npm run build`
5. If there are type resolution issues with `react-markdown` (it's an ESM-only package), ensure `tsconfig.json` has appropriate `moduleResolution` settings. The project already uses ES module imports in the renderer, so this should work.

</details>
