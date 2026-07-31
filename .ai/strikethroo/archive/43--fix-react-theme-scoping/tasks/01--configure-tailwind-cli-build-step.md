---
id: 1
group: "tailwind-build"
dependencies: []
status: "completed"
created: 2026-03-14
skills:
  - typescript
  - css
---
# Configure Tailwind CLI Build Step

## Objective
Produce `dist/styles.css` by adding a Tailwind CLI build step to `packages/react`, moving `tailwindcss` and `@tailwindcss/typography` from peerDependencies to devDependencies, and wiring up the build pipeline.

## Skills Required
- **typescript**: npm `package.json` script configuration
- **css**: Tailwind v4 CLI `@source` directives and build entrypoint

## Acceptance Criteria
- [ ] `@tailwindcss/cli` added to `devDependencies` in `packages/react/package.json`
- [ ] `tailwindcss` moved from `peerDependencies` to `devDependencies`
- [ ] `@tailwindcss/typography` moved from `peerDependencies` to `devDependencies`
- [ ] `packages/react/src/build-styles.css` created with Tailwind import + `@source` pointing at dist
- [ ] `build:css` script added to `packages/react/package.json`
- [ ] `build` script updated to `tsup && npm run build:css`
- [ ] `npm run build` in `packages/react` produces both `dist/index.js` and a non-empty `dist/styles.css`
- [ ] `dist/styles.css` contains dark-variant utility rules (e.g. grep for `dark`)

## Technical Requirements
- Tailwind CSS v4 CLI package: `@tailwindcss/cli`
- Build entrypoint: `src/build-styles.css` (not shipped — only used at build time)
- The CSS build must run **after** `tsup` completes, because Tailwind scans `dist/index.js` for class names
- Use `--minify` flag for production output
- Tailwind v4 auto-detects content sources but needs `@source "../dist"` to scan the compiled JS

## Input Dependencies
None — this is a build tooling change only.

## Output Artifacts
- `packages/react/package.json` (updated scripts + dependencies)
- `packages/react/src/build-styles.css` (new build entrypoint)
- `packages/react/dist/styles.css` (produced by `npm run build`)

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### 1. Update `packages/react/package.json`

Move deps:
```json
// Remove from peerDependencies:
"tailwindcss": "^4.0.0",
"@tailwindcss/typography": "^0.5.0"

// Add to devDependencies:
"tailwindcss": "^4.0.0",
"@tailwindcss/typography": "^0.5.0",
"@tailwindcss/cli": "^4.0.0"
```

Update scripts:
```json
"build": "tsup && npm run build:css",
"build:css": "npx @tailwindcss/cli -i src/build-styles.css -o dist/styles.css --minify"
```

### 2. Create `packages/react/src/build-styles.css`

```css
/* Build entrypoint for @self-review/react — not shipped directly.
 * This file is used only by the Tailwind CLI build step.
 * It imports the library styles and tells Tailwind to scan the compiled JS for class names.
 */
@import "./styles.css";
@source "../dist";
```

### 3. Install new devDependency

Run `npm install` from the `packages/react` directory (or workspace root) so `@tailwindcss/cli` is installed.

### 4. Verify build

```bash
cd packages/react && npm run build
ls -la dist/styles.css
grep -c "dark" dist/styles.css
```

The `dist/styles.css` should be non-empty and contain dark-variant rules.

### Notes
- `@source "../dist"` tells Tailwind v4 to scan the `dist/` directory for class names after tsup produces `dist/index.js`
- The `--minify` flag removes whitespace from the output for a smaller file
- `@import "./styles.css"` brings in all the theme variables, `@theme inline` block, and component overrides from the library's existing styles
- The `src/build-styles.css` file should NOT be referenced in `package.json` `exports` — it is a build artifact only
</details>
