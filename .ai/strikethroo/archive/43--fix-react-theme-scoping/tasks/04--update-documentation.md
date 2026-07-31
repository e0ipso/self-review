---
id: 4
group: "documentation"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-03-14
skills:
  - typescript
---
# Update Documentation

## Objective
Update `packages/react/AGENTS.md` and root `AGENTS.md` to reflect the new `.self-review` wrapper div, Tailwind CLI build step, and the fact that `tailwindcss` is now a devDependency.

## Skills Required
- **typescript**: Markdown documentation editing

## Acceptance Criteria
- [ ] `packages/react/AGENTS.md` documents the `.self-review` wrapper div rendered by `ConfigProvider` and its dual purpose (theme scoping + CSS containment)
- [ ] `packages/react/AGENTS.md` documents the Tailwind CLI `build:css` script and that `dist/styles.css` is now produced by the build
- [ ] `packages/react/AGENTS.md` notes that `tailwindcss` and `@tailwindcss/typography` are devDependencies (not peerDependencies)
- [ ] `packages/react/AGENTS.md` notes that `src/styles.css` is a **build input** (not a direct consumer import) and that `src/build-styles.css` is the Tailwind CLI entrypoint
- [ ] `packages/react/src/styles.css` header comment updated to say it is a build input, not a direct import
- [ ] Root `AGENTS.md` updated if it references `document.documentElement` theme toggle

## Technical Requirements
- Check root `AGENTS.md` for any reference to `document.documentElement` and the `dark` class toggle — update to reflect scoped wrapper behavior
- Keep documentation concise; add a dedicated section in `packages/react/AGENTS.md` under a heading like `## CSS Build & Theming`

## Input Dependencies
- Task 01: Tailwind CLI build step details
- Task 02: CSS scoping approach
- Task 03: ConfigProvider wrapper div

## Output Artifacts
- `packages/react/AGENTS.md` (updated)
- `packages/react/src/styles.css` (header comment updated)
- `/workspace/AGENTS.md` if needed (checked and updated if necessary)

## Implementation Notes

<details>
<summary>What to document</summary>

### In `packages/react/AGENTS.md` — add a new section `## CSS Build & Theming`

Content should cover:
1. **`dist/styles.css` is compiled by the build** — `npm run build` runs `tsup && npm run build:css`. The `build:css` script uses `@tailwindcss/cli` to produce a self-contained compiled CSS file. Host apps import `@self-review/react/styles.css` without needing Tailwind installed.
2. **`src/styles.css` is a build input** — it contains Tailwind directives, CSS custom property definitions, and component overrides. The `src/build-styles.css` file is the CLI entrypoint (not shipped).
3. **`tailwindcss` and `@tailwindcss/typography` are devDependencies** — host apps do not need Tailwind in their project.
4. **`.self-review` wrapper div** — `ConfigProvider` renders a `<div className="self-review">` around its children. This div serves two purposes: (a) it receives the `dark` class for theme toggling instead of `document.documentElement`, and (b) it is the CSS scoping root — all `*` selectors in `styles.css` are prefixed with `.self-review` to prevent leakage into host apps.
5. **Radix portal containers** — All shadcn/ui portal-based components (`alert-dialog`, `dropdown-menu`, `select`, `tooltip`) receive the wrapper div as their `container` prop so portals render inside the scoped subtree.

### Update `styles.css` header comment

Change from:
```css
/*
 * @self-review/react styles
 *
 * Import this file in your app:
 *   import '@self-review/react/styles.css';
 *
 * Requires Tailwind CSS v4+ and @tailwindcss/typography to be configured
 * in your consuming application.
 */
```

To:
```css
/*
 * @self-review/react styles — BUILD INPUT
 *
 * This file is processed by the Tailwind CLI build step (via src/build-styles.css)
 * to produce dist/styles.css. Do NOT import this file directly.
 *
 * Host apps should import the compiled output:
 *   import '@self-review/react/styles.css';  // points to dist/styles.css
 *
 * No Tailwind dependency is needed in the consuming application.
 */
```

### Check root AGENTS.md

Search for `document.documentElement` or `dark` class toggle references. If found, update to note that the `dark` class is now toggled on the `.self-review` wrapper div inside the React tree, not on `<html>`.
</details>
