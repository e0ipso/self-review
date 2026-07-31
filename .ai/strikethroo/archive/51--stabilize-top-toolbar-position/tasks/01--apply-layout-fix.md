---
id: 1
group: "renderer-layout"
dependencies: []
status: "completed"
created: 2026-04-29
skills:
  - react-components
  - css
---

# Pin top chrome and constrain Layout track

## Objective

Harden the renderer layout shell so the `UpdateBanner` and `Toolbar` cannot be displaced by tall diff content. The user must always be able to see (and click) toolbar controls regardless of how many `FileSection`s are expanded inside the diff pane.

## Skills Required

- `react-components` — minor JSX edits to three React components.
- `css` — Tailwind utility additions (`shrink-0`, `overflow-hidden`, `min-h-0`, `z-20`); flexbox `min-height: 0` discipline.

## Acceptance Criteria

- [ ] `UpdateBanner`'s root element carries `shrink-0` so its `h-8` height cannot collapse.
- [ ] `Toolbar`'s root element carries `shrink-0` and `z-20` (paints above `FileSection` sticky headers, which use `z-10`).
- [ ] In `src/renderer/App.tsx`, the chrome stack `<div className='flex flex-col h-screen ...'>` includes `overflow-hidden`.
- [ ] In the same file, `<Layout />` is wrapped in `<div className='flex-1 min-h-0'>` so the diff scroll container is the only scroller in the column.
- [ ] No changes to `packages/react/src/ReviewPanel.tsx` (the optional symmetry change is explicitly out of scope per the plan's default).
- [ ] `npm run test:unit` and `npm run lint` (if present) pass.
- [ ] Visual smoke test: in `npm run dev:webapp` with the existing fixture, the toolbar stays anchored at the top after scrolling the diff pane to the bottom.

## Technical Requirements

Files to edit (and only these):

1. `src/renderer/components/UpdateBanner.tsx`
   - Add `shrink-0` to the root `<div>`'s `className`. The current classes already pin a height (`h-8`) and a border; we are only making the flex item non-shrinkable.

2. `packages/react/src/components/Toolbar.tsx`
   - Add `shrink-0` and `z-20` to the root `<div>`'s `className`. Keep existing `data-testid='toolbar'`. The current classes are: `flex items-center justify-between h-11 px-3 border-b border-border bg-background`.

3. `src/renderer/App.tsx`
   - Locate the chrome container around line 132: `<div className='flex flex-col h-screen bg-background text-foreground antialiased'>`.
   - Add `overflow-hidden` to its `className`.
   - Replace `<Layout />` with `<div className='flex-1 min-h-0'><Layout /></div>` so the panel/group inside `Layout` has a strictly bounded vertical track.

## Input Dependencies

None. The plan document (`.ai/task-manager/plans/51--stabilize-top-toolbar-position/plan-51--stabilize-top-toolbar-position.md`) is the only required input.

## Output Artifacts

- Edited files: `src/renderer/App.tsx`, `src/renderer/components/UpdateBanner.tsx`, `packages/react/src/components/Toolbar.tsx`.
- A descriptive conventional commit (e.g. `fix(layout): keep toolbar pinned when diff content overflows`) created at the end of the phase.

## Implementation Notes

<details>

### Why these changes — minimal context for a non-thinking executor

- The bug: when the diff viewer renders many fully expanded files, the inner content height exceeds the available track in the `flex flex-col h-screen` column. Because `UpdateBanner` and `Toolbar` are flex children **without** `flex-shrink: 0`, they get compressed; combined with `body { overflow: hidden }` (`src/index.css:87`), the toolbar effectively scrolls out of view and cannot be recovered without "Collapse all files".
- The fix: pin the top chrome with `shrink-0`, give the chrome column `overflow-hidden`, and put a `min-h-0 flex-1` track around `<Layout />` so the diff scroll container's `overflow-y-auto` actually clips. `min-h-0` is the canonical Tailwind/CSS workaround for the flexbox quirk where `flex: 1` children in a column refuse to shrink below their intrinsic content height.

### Exact edits

**File 1: `src/renderer/components/UpdateBanner.tsx`**

Change the root `<div>` className from:

```
"flex items-center justify-between h-8 px-3 border-b border-border bg-blue-50 dark:bg-blue-950 text-xs"
```

to:

```
"flex shrink-0 items-center justify-between h-8 px-3 border-b border-border bg-blue-50 dark:bg-blue-950 text-xs"
```

(Insert `shrink-0` after `flex`. No other changes.)

**File 2: `packages/react/src/components/Toolbar.tsx`**

Change the root `<div>` className from:

```
'flex items-center justify-between h-11 px-3 border-b border-border bg-background'
```

to:

```
'flex shrink-0 z-20 items-center justify-between h-11 px-3 border-b border-border bg-background'
```

Keep `data-testid='toolbar'` exactly as-is.

**File 3: `src/renderer/App.tsx`**

Locate the JSX block (currently around lines 128–134):

```tsx
<div className='flex flex-col h-screen bg-background text-foreground antialiased'>
  <UpdateBanner />
  <Toolbar onFinishReview={handleFinishReview} />
  <Layout />
</div>
```

Replace with:

```tsx
<div className='flex flex-col h-screen overflow-hidden bg-background text-foreground antialiased'>
  <UpdateBanner />
  <Toolbar onFinishReview={handleFinishReview} />
  <div className='flex-1 min-h-0'>
    <Layout />
  </div>
</div>
```

Two changes in this file: (a) add `overflow-hidden` to the existing className, (b) wrap `<Layout />` in `<div className='flex-1 min-h-0'>`.

### What NOT to change

- Do **not** touch `src/index.css` — `body { overflow: hidden }` must stay; the fix works **with** that rule.
- Do **not** touch `packages/react/src/ReviewPanel.tsx` — the plan's "Package boundary risk" section says default to "Electron app only" unless the user explicitly opts in.
- Do **not** add `flex-shrink-0`/`min-height: 0` to any other component (e.g. `Layout`, `FileSection`); the existing `h-full overflow-y-auto` on the diff panel is the intended scroll boundary and must remain unchanged.
- Do **not** rename, remove, or change `data-testid` attributes — `[data-testid='toolbar']` and `[data-testid='update-banner']` are required by the e2e regression test in task 2.

### Validation

After the edits:

1. `npm run test:unit` — must pass (no regressions in main or renderer unit suites).
2. `npm run dev:webapp` — open the webapp dev server, load any fixture with several expanded files, scroll the diff pane to the bottom; the toolbar must remain visible at the top of the window. (We are inside a dev container, so do **not** attempt to run the Electron app or the Electron e2e suite — see `AGENTS.md` "Dev Container" section.)
3. Stage the three edited files only and create a conventional-commits commit, e.g. `fix(layout): keep toolbar pinned when diff content overflows`. Per `AGENTS.md`, do not mention AI assistance in the commit message.

</details>
