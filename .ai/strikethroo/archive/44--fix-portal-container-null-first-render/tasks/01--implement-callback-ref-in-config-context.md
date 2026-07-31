---
id: 1
group: "fix-portal-container-null-first-render"
dependencies: []
status: "completed"
created: 2026-03-14
skills:
  - react-components
  - typescript
---
# Implement Callback Ref Pattern in ConfigContext

## Objective

Replace the `useRef` + `useEffect` pattern in `ConfigProvider` with a callback ref that sets
`portalContainer` synchronously during React's commit phase, eliminating the null-on-first-render
window.

## Skills Required

- React hooks (`useCallback`, `useState`, callback refs)
- TypeScript

## Acceptance Criteria

- [ ] `useRef<HTMLDivElement>(null)` for `wrapperRef` is removed from `ConfigProvider`
- [ ] The `useEffect` that called `setPortalContainer(wrapperRef.current)` is removed
- [ ] A `useCallback`-stabilized callback ref function is created that calls `setPortalContainer(node)` only when `node` is non-null (guards against the unmount `null` call)
- [ ] The callback ref is passed as the `ref` prop on the wrapper `<div>`
- [ ] The theme `useEffect` no longer references `wrapperRef.current`; it uses the `portalContainer` state variable instead (e.g., `if (portalContainer) { portalContainer.classList.toggle('dark', isDark); }`)
- [ ] `useRef` is removed from the React import list (if no longer used)
- [ ] No TypeScript compilation errors in `packages/react` or `src/renderer`
- [ ] All existing renderer unit tests pass: `npm run test:unit:renderer`

## Technical Requirements

- File: `packages/react/src/context/ConfigContext.tsx`
- React `useCallback` must be added to the import list
- The callback ref must have the type `(node: HTMLDivElement | null) => void`
- The null guard prevents calling `setPortalContainer(null)` on unmount, keeping the container available until the component fully unmounts

## Input Dependencies

None — this task is self-contained.

## Output Artifacts

- Modified `packages/react/src/context/ConfigContext.tsx` with the callback ref pattern

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

**Current pattern to remove:**

```tsx
const wrapperRef = useRef<HTMLDivElement>(null);
const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

useEffect(() => {
  setPortalContainer(wrapperRef.current);
}, []);
```

And in the theme effect:
```tsx
if (wrapperRef.current) {
  wrapperRef.current.classList.toggle('dark', isDark);
}
```

**New pattern to add:**

```tsx
const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

const wrapperCallbackRef = useCallback((node: HTMLDivElement | null) => {
  if (node !== null) {
    setPortalContainer(node);
  }
}, []);
```

In the theme effect, replace `wrapperRef.current` with `portalContainer`:
```tsx
if (portalContainer) {
  portalContainer.classList.toggle('dark', isDark);
}
```

Add `portalContainer` to the theme effect's dependency array.

On the wrapper div:
```tsx
<div ref={wrapperCallbackRef} className="self-review" style={{ display: 'contents' }}>
```

**Why the null guard:** React calls callback refs with `null` when the component unmounts (to allow cleanup). Without the guard, `setPortalContainer(null)` would trigger a re-render on unmount. The guard prevents this and keeps the container value stable.

**Why `useCallback`:** Without memoization, a new function reference would be created on every render, causing React to call the ref callback on every render (with `null` then the node). `useCallback` with an empty dependency array ensures the ref function is stable.

**Theme effect dependency:** After the change, `portalContainer` must be added to the dependency array of the theme `useEffect`. This is correct behavior — the effect needs to re-run when the container becomes available.

</details>
