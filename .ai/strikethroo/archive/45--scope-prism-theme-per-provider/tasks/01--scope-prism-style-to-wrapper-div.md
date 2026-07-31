---
id: 1
group: "prism-theme-scoping"
dependencies: []
status: "completed"
created: "2026-03-14"
skills:
  - react-components
  - typescript
---
# Scope Prism Theme Style Tag to Wrapper Div

## Objective
Replace the global `<style id="prism-theme">` injection in `document.head` with a locally-scoped `<style>` element appended to the `.self-review` wrapper div inside `ConfigProvider`, so each instance manages its own Prism theme independently.

## Skills Required
- **react-components**: React refs, effects, effect cleanup
- **typescript**: Type-safe DOM manipulation

## Acceptance Criteria
- [ ] `packages/react/src/context/ConfigContext.tsx` no longer references `document.getElementById('prism-theme')` or `document.head.appendChild`
- [ ] A `useRef<HTMLStyleElement | null>` tracks the scoped `<style>` element per instance
- [ ] The `<style>` element is created inside the `wrapperRef.current` div (not in `document.head`) when Prism CSS props are provided
- [ ] Theme changes update the `textContent` of the ref'd style element
- [ ] The `<style>` element is removed on unmount (explicit cleanup in effect teardown)
- [ ] The hardcoded `id="prism-theme"` is fully removed from source files (verify with codebase search)
- [ ] `npm run test:unit` passes
- [ ] `npm run test:e2e` passes
- [ ] `docs/PRD.md` checked for prescriptive references to `prism-theme` style tag and updated if found

## Technical Requirements
- Target file: `packages/react/src/context/ConfigContext.tsx`
- The existing `wrapperRef` (type `useRef<HTMLDivElement>(null)`) is already available — reuse it
- Add a new `styleRef = useRef<HTMLStyleElement | null>(null)` to track the injected style element
- In the `useEffect` that calls `applyTheme`, after the wrapper div is available (`wrapperRef.current`), create the `<style>` element once and append to the wrapper
- Return a cleanup function from the effect that removes the style element and nulls the ref
- The effect dependencies remain `[config.theme, prismLightCss, prismDarkCss]`

## Input Dependencies
None — this is the only task.

## Output Artifacts
- Modified `packages/react/src/context/ConfigContext.tsx`
- Optionally updated `docs/PRD.md`

## Implementation Notes

<details>
<summary>Step-by-step implementation guide</summary>

### 1. Add `styleRef` to `ConfigProvider`

Inside `ConfigProvider`, add a new ref directly after `wrapperRef`:

```typescript
const styleRef = useRef<HTMLStyleElement | null>(null);
```

### 2. Rewrite the `applyTheme` logic in the theme `useEffect`

Replace the current `applyTheme` inner function body that touches `document.getElementById('prism-theme')` and `document.head` with the following pattern:

```typescript
const applyTheme = (isDark: boolean) => {
  // Toggle dark class on the scoped wrapper instead of document.documentElement
  if (wrapperRef.current) {
    wrapperRef.current.classList.toggle('dark', isDark);
  }

  // Apply Prism theme CSS scoped to this instance's wrapper
  if (prismLightCss || prismDarkCss) {
    if (!styleRef.current && wrapperRef.current) {
      const el = document.createElement('style');
      wrapperRef.current.appendChild(el);
      styleRef.current = el;
    }
    if (styleRef.current) {
      styleRef.current.textContent = isDark ? (prismDarkCss || '') : (prismLightCss || '');
    }
  }
};
```

### 3. Add cleanup to the effect return

The existing effect already returns a cleanup for the media query listener. Extend it to also remove the style element:

```typescript
return () => {
  // Remove the scoped style element on cleanup
  if (styleRef.current) {
    styleRef.current.remove();
    styleRef.current = null;
  }
  // existing media query removeEventListener if applicable
};
```

Note: the effect currently only returns from the `if (config.theme === 'system')` branch. Restructure so cleanup always runs:

```typescript
useEffect(() => {
  applyTheme(resolveIsDark(config.theme));

  let removeMediaListener: (() => void) | undefined;
  if (config.theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mediaQuery.addEventListener('change', listener);
    removeMediaListener = () => mediaQuery.removeEventListener('change', listener);
  }

  return () => {
    removeMediaListener?.();
    if (styleRef.current) {
      styleRef.current.remove();
      styleRef.current = null;
    }
  };
}, [config.theme, prismLightCss, prismDarkCss]);
```

### 4. Verify no stale references

After the change, search the codebase:
```bash
grep -r "prism-theme" src/ packages/ --include="*.ts" --include="*.tsx"
```
This should return zero results. The string may still appear in `docs/PRD.md` — only update that file if the reference is prescriptive (describes how it works internally) rather than just documentary.

### 5. Run validation
```bash
npm run test:unit
npm run test:e2e
```

</details>
