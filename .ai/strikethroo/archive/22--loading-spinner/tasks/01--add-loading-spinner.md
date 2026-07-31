---
id: 1
group: "loading-ui"
dependencies: []
status: "completed"
created: "2026-02-27"
skills:
  - react-components
---
# Add Loading Spinner to App Loading State

## Objective
Replace the blank page shown during the `loading` diff source state with a centered spinner animation.

## Skills Required
- react-components (React + Tailwind CSS)

## Acceptance Criteria
- [ ] A spinner is visible when `diffSource.type === 'loading'`
- [ ] The spinner is centered both horizontally and vertically
- [ ] The spinner uses theme-aware colors (`bg-background`, `text-muted-foreground`)
- [ ] The spinner disappears when diff data or welcome screen loads
- [ ] Works in both light and dark themes

## Technical Requirements
- Modify `src/renderer/App.tsx`
- Use Tailwind's `animate-spin` utility on an SVG
- Use project's existing theme CSS variables for colors

## Input Dependencies
None — this is a standalone UI change.

## Output Artifacts
- Modified `App.tsx` with spinner in the loading branch

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

In `src/renderer/App.tsx`, the `AppContent` component currently has this pattern at line 41:

```tsx
{diffSource.type !== 'loading' && (
  <div className='flex flex-col h-screen bg-background text-foreground antialiased'>
    <Toolbar />
    <Layout />
  </div>
)}
```

Replace this with an explicit loading state branch. Before the main content block, add:

```tsx
if (diffSource.type === 'loading') {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <svg
        className="animate-spin h-8 w-8 text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}
```

Place this check right after the welcome screen check (after line 35) and before the main content return. Then the existing `diffSource.type !== 'loading'` guard on line 41 can be removed since loading is handled by the early return.

</details>
