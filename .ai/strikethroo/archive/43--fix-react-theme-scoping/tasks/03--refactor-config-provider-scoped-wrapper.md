---
id: 3
group: "css-scoping"
dependencies: [2]
status: "completed"
created: 2026-03-14
skills:
  - react-components
  - css
---
# Refactor ConfigProvider with Scoped `.self-review` Wrapper

## Objective
Replace `ConfigProvider`'s global `document.documentElement.classList.toggle('dark', ...)` with a scoped class toggle on a `.self-review` wrapper div rendered by the provider. Fix all Radix UI portal-based components (AlertDialog, DropdownMenu, Select, Tooltip) to render their portals inside the wrapper so they inherit dark-mode CSS variables.

## Skills Required
- **react-components**: React refs, context providers, portal container props
- **css**: CSS custom property inheritance, layout wrapper constraints

## Acceptance Criteria
- [ ] `ConfigProvider` renders a `<div className="self-review">` wrapper around `{children}`
- [ ] `useRef<HTMLDivElement>` added for the wrapper element; used in the theme effect
- [ ] `document.documentElement.classList.toggle('dark', isDark)` replaced with `themeRef.current?.classList.toggle('dark', isDark)` (or equivalent direct property assignment)
- [ ] The wrapper div uses `display: contents` style to avoid introducing layout side-effects (or a flex column wrapper if contents has accessibility concerns — see notes)
- [ ] `AlertDialogContent` in `src/components/ui/alert-dialog.tsx` passes `container` prop to `AlertDialogPortal` using the wrapper element
- [ ] `DropdownMenuContent` and `DropdownMenuSubContent` in `src/components/ui/dropdown-menu.tsx` pass `container` prop to `MenuPrimitive.Portal` using the wrapper element
- [ ] `SelectContent` in `src/components/ui/select.tsx` passes `container` to `SelectPrimitive.Portal` using the wrapper element
- [ ] `TooltipContent` in `src/components/ui/tooltip.tsx` passes `container` to `TooltipPrimitive.Portal` using the wrapper element
- [ ] Dark mode applies correctly inside the wrapper (CSS variables cascade from `.self-review.dark`)
- [ ] `document.documentElement` is never given the `dark` class by the library
- [ ] All existing unit tests pass

## Technical Requirements
- `ConfigProvider` is in `packages/react/src/context/ConfigContext.tsx`
- Portal-based shadcn/ui components: `alert-dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `tooltip.tsx`
- Radix Portal sub-components accept a `container` prop (type: `HTMLElement | null`) that redirects portals from `document.body` to the specified element
- The portal container approach requires the wrapper div ref to be available to all portal components — this must be provided via React context
- The `.dark` class will be applied to the `.self-review` wrapper itself (e.g., `<div class="self-review dark">`)
- `@custom-variant dark (&:is(.dark *))` in styles.css means `dark:` utilities activate when any ancestor has `.dark` — the `.self-review` wrapper having `.dark` directly satisfies this for all children

## Input Dependencies
- Task 02: `styles.css` scoped under `.self-review` — the wrapper div applies the class that makes CSS scoping work

## Output Artifacts
- `packages/react/src/context/ConfigContext.tsx` (modified: wrapper div + scoped theme toggle)
- `packages/react/src/components/ui/alert-dialog.tsx` (modified: portal container)
- `packages/react/src/components/ui/dropdown-menu.tsx` (modified: portal container)
- `packages/react/src/components/ui/select.tsx` (modified: portal container)
- `packages/react/src/components/ui/tooltip.tsx` (modified: portal container)

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### 1. Add a portal container context

Create a small React context to share the wrapper ref with portal components. This avoids prop-drilling through the component tree.

Option A — Add to `ConfigContext.tsx` directly:
```tsx
// Add to ConfigContextValue interface:
portalContainer: HTMLDivElement | null;
```

Or Option B — Create a dedicated `PortalContainerContext.tsx`:
```tsx
import React, { createContext, useContext } from 'react';

const PortalContainerContext = createContext<HTMLDivElement | null>(null);

export function usePortalContainer() {
  return useContext(PortalContainerContext);
}

export { PortalContainerContext };
```

**Recommendation**: Add `portalContainer` to the existing `ConfigContext` to avoid creating a new file.

### 2. Modify `ConfigProvider` in `ConfigContext.tsx`

```tsx
import React, { useRef, useState, useEffect, ... } from 'react';

// Add to ConfigContextValue interface:
portalContainer: HTMLDivElement | null;

// In ConfigProvider function:
const wrapperRef = useRef<HTMLDivElement>(null);
const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

// After mount, expose the wrapper as the portal container:
useEffect(() => {
  setPortalContainer(wrapperRef.current);
}, []);

// In the theme effect — replace the documentElement toggle:
// BEFORE:
document.documentElement.classList.toggle('dark', isDark);
// AFTER:
if (wrapperRef.current) {
  wrapperRef.current.classList.toggle('dark', isDark);
}

// In the JSX return:
return (
  <ConfigContext.Provider value={{ config, setConfig, updateConfig, outputPathInfo, setOutputPathInfo, portalContainer }}>
    <div ref={wrapperRef} className="self-review" style={{ display: 'contents' }}>
      {children}
    </div>
  </ConfigContext.Provider>
);
```

**Important**: Set initial `portalContainer` state to `null` (portals will fall back to `document.body` on first render, then switch to the wrapper once the ref is set — this is acceptable). Alternatively use a `useEffect` with `setPortalContainer(wrapperRef.current)` after mount.

**`display: contents` note**: This makes the div invisible to CSS layout (the children lay out as if the div doesn't exist). This avoids any layout disruption. The `.self-review` class on the element still works for CSS selector matching (`.self-review *` selectors apply to children). If `display: contents` causes accessibility issues in testing, use `display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0` instead, but `display: contents` is preferred.

### 3. Update `useConfig()` consumers in portal components

In each shadcn/ui portal component, call `useConfig()` to get `portalContainer` and pass it to the Radix `Portal` component.

#### `src/components/ui/alert-dialog.tsx`
```tsx
import { useConfig } from '../../context/ConfigContext';

const AlertDialogContent = React.forwardRef<...>(({ className, children, ...props }, ref) => {
  const { portalContainer } = useConfig();
  return (
    <AlertDialogPortal container={portalContainer}>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content ref={ref} className={cn(...)} {...props}>
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
```

#### `src/components/ui/dropdown-menu.tsx`
Both `DropdownMenuContent` and `DropdownMenuSubContent` use `<MenuPrimitive.Portal>`. Pass `container={portalContainer}` to each:
```tsx
const { portalContainer } = useConfig();
// ...
<MenuPrimitive.Portal container={portalContainer}>
```

#### `src/components/ui/select.tsx`
`SelectContent` uses `<SelectPrimitive.Portal>`:
```tsx
const { portalContainer } = useConfig();
// ...
<SelectPrimitive.Portal container={portalContainer}>
```

#### `src/components/ui/tooltip.tsx`
`TooltipContent` uses `<TooltipPrimitive.Portal>`:
```tsx
const { portalContainer } = useConfig();
// ...
<TooltipPrimitive.Portal container={portalContainer}>
```

### 4. Update `ConfigContextValue` default

In the `createContext` call for `ConfigContext`, add:
```tsx
portalContainer: null,
```

### 5. Verify initial theme is applied

The theme effect runs on mount. With `wrapperRef`, it can only apply the class after the first render. Ensure the initial render doesn't flash unstyled content. The `useState` for `isDark` plus the effect should handle this — on mount, the effect fires and toggles the class on the wrapper synchronously after the first paint. This is the same behavior as before (previously `document.documentElement` was toggled in a `useEffect`, also after first render).

### 6. Run tests
```bash
cd packages/react && npm run test:unit
```
All tests should pass. If any test mocks `document.documentElement` classList, update the mock to use the wrapper element instead.
</details>
