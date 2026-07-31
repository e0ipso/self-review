---
id: 1
group: "component-relocation"
dependencies: []
status: "completed"
created: "2026-05-03"
skills:
  - "react-components"
  - "typescript"
---
# Move Split/Unified Toggle from Toolbar.tsx into FileTree.tsx Header

## Objective

Physically relocate the Split/Unified diff-view `ToggleGroup` (markup, handler, and icon imports) from `packages/react/src/components/Toolbar.tsx` into the header of `packages/react/src/components/FileTree.tsx`, adapting the visual variant to the icon-only style used by the surrounding `FileTree` header buttons. The state contract (`useConfig().updateConfig({ diffView })`) and the `data-testid` selectors (`view-mode-split`, `view-mode-unified`) are preserved verbatim.

## Skills Required

- `react-components`: shadcn/ui composition (`ToggleGroup`, `ToggleGroupItem`, `Tooltip`, `Separator`), event handler relocation, header layout work in an existing component.
- `typescript`: Adjusting `lucide-react` and `./ui/*` import statements in both files.

## Acceptance Criteria

- [ ] `Toolbar.tsx` no longer contains the Split/Unified `ToggleGroup`, `handleViewModeChange`, or the `Columns2` / `AlignJustify` icon imports.
- [ ] `grep -nE "view-mode-split|view-mode-unified|handleViewModeChange|Columns2|AlignJustify" packages/react/src/components/Toolbar.tsx` returns zero matches.
- [ ] `FileTree.tsx` renders a `ToggleGroup` whose `value` is bound to `config.diffView` from `useConfig()` and whose `onValueChange` dispatches `updateConfig({ diffView })`.
- [ ] The two new `ToggleGroupItem`s carry `data-testid="view-mode-split"` and `data-testid="view-mode-unified"` and use the icon-only variant (`h-5 w-5 p-0`) with `Columns2` and `AlignJustify` icons inside `Tooltip`s captioned "Side-by-side view" and "Unified view".
- [ ] `grep -nE "view-mode-split|view-mode-unified" packages/react/src/components/FileTree.tsx` returns exactly two matches; the same grep against `Toolbar.tsx` returns zero.
- [ ] The toggle is placed inside the existing `<div className='flex items-center gap-1'>` cluster in the `FileTree` header, to the **left** of the keyboard-shortcuts button, separated from the rest of the cluster by a thin vertical `Separator` (matching the existing separator pattern).
- [ ] The leading `Separator` at `Toolbar.tsx:106-107` (between show/hide-untracked and the now-removed view toggle) is **kept**; the trailing `Separator` previously at `Toolbar.tsx:145` (between the now-removed view toggle and the comments toggle) is **removed**.
- [ ] `useConfig()` access is added to `FileTree.tsx` for `config` (currently the file destructures only `outputPathInfo` and `setOutputPathInfo`).
- [ ] No new dependencies are introduced; no public prop signatures change on `Toolbar` or `FileTree`.
- [ ] `npm run test:unit` passes (existing suite — the new test is a separate task).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- **Files to modify:**
  - `packages/react/src/components/Toolbar.tsx`
  - `packages/react/src/components/FileTree.tsx`
- **shadcn/ui components in play:** `ToggleGroup`, `ToggleGroupItem` (already imported in `Toolbar.tsx`, must be added to `FileTree.tsx`'s `./ui/toggle-group` import), `Tooltip`, `TooltipTrigger`, `TooltipContent` (already imported in both), `Separator` (already imported in both).
- **lucide-react icons:** `Columns2` and `AlignJustify` move from `Toolbar.tsx`'s `lucide-react` import block into `FileTree.tsx`'s.
- **Hook:** `useConfig()` is already imported in `FileTree.tsx`; expand the destructure to include `config` so the toggle can read `config.diffView`.
- **Visual variant:** Use `className='h-5 w-5 p-0'` on each `ToggleGroupItem` (matching the keyboard-shortcuts and expand/collapse-all buttons in the same cluster). Use `h-3.5 w-3.5` for the icon size inside.
- **Tooltip wrapping:** Each `ToggleGroupItem` is wrapped in its own `Tooltip` / `TooltipTrigger asChild` pair, mirroring the structure currently in `Toolbar.tsx:117-142`.

## Input Dependencies

None — this is the first task and starts from the current state of `Toolbar.tsx` and `FileTree.tsx`.

## Output Artifacts

- Updated `packages/react/src/components/Toolbar.tsx` (toggle + handler + icon imports removed; `Separator` at line 145 removed).
- Updated `packages/react/src/components/FileTree.tsx` (icon-only Split/Unified toggle added to the header cluster; `useConfig()` destructure expanded to include `config`; new imports for `Columns2`, `AlignJustify`, `ToggleGroup`, `ToggleGroupItem`).

## Implementation Notes

<details>

### Step 1 — Edit `Toolbar.tsx`

1. **Remove the `ToggleGroup` block** spanning lines 110–143 (the `<ToggleGroup type='single' variant='outline' size='sm' value={config.diffView} ...>` and its two `ToggleGroupItem`s wrapped in `Tooltip`s).
2. **Remove the trailing `Separator`** at line 145 (`<Separator orientation='vertical' className='h-5' />`) which previously separated the view toggle from the collapse-all-comments button. Without it, two separators would render back-to-back; deleting it leaves the leading separator at line 106-107 in place to separate show/hide-untracked from collapse-all-comments — still a valid grouping.
3. **Remove the `handleViewModeChange` function** at lines 60–64.
4. **Remove `Columns2` and `AlignJustify`** from the `lucide-react` import statement at lines 8–24. Keep all other icons (`Sun`, `Moon`, `Monitor`, etc.) intact.
5. The `ToggleGroup` / `ToggleGroupItem` imports at line 5 must remain because they are still used by the theme toggle further down in the file.

### Step 2 — Edit `FileTree.tsx`

1. **Update the `lucide-react` import** at line 11 to add `Columns2` and `AlignJustify`. Keep existing icons.
2. **Add a new import** for `ToggleGroup, ToggleGroupItem` from `./ui/toggle-group` (this file does not currently import them).
3. **Expand the `useConfig()` destructure** at line 17 from `const { outputPathInfo, setOutputPathInfo } = useConfig();` to `const { config, updateConfig, outputPathInfo, setOutputPathInfo } = useConfig();`.
4. **Add a handler** below `handleChangeOutputPath` (around line 30):
   ```tsx
   const handleViewModeChange = (value: string) => {
     if (value === 'split' || value === 'unified') {
       updateConfig({ diffView: value });
     }
   };
   ```
5. **Insert the toggle markup** inside the existing `<div className='flex items-center gap-1'>` cluster (currently starts at line 66), placed **before** the keyboard-shortcuts `Tooltip` at line 67. Follow this structure (icon-only variant, no text labels — tooltips provide the accessible name):
   ```tsx
   <ToggleGroup
     type='single'
     variant='outline'
     size='sm'
     value={config.diffView}
     onValueChange={handleViewModeChange}
   >
     <Tooltip>
       <TooltipTrigger asChild>
         <ToggleGroupItem
           value='split'
           data-testid='view-mode-split'
           className='h-5 w-5 p-0'
         >
           <Columns2 className='h-3.5 w-3.5' />
           <span className='sr-only'>Split view</span>
         </ToggleGroupItem>
       </TooltipTrigger>
       <TooltipContent>Side-by-side view</TooltipContent>
     </Tooltip>
     <Tooltip>
       <TooltipTrigger asChild>
         <ToggleGroupItem
           value='unified'
           data-testid='view-mode-unified'
           className='h-5 w-5 p-0'
         >
           <AlignJustify className='h-3.5 w-3.5' />
           <span className='sr-only'>Unified view</span>
         </ToggleGroupItem>
       </TooltipTrigger>
       <TooltipContent>Unified view</TooltipContent>
     </Tooltip>
   </ToggleGroup>
   <Separator orientation='vertical' className='h-4' />
   ```
   The trailing `<Separator>` keeps the toggle visually distinct from the keyboard-shortcuts / expand-collapse / badge cluster. Use `h-4` (slightly shorter than the `h-5` used in the toolbar) to match the compact sidebar header — the sibling button height is `h-5`.

### Step 3 — Verify

- Run `grep -nE "view-mode-split|view-mode-unified|Columns2|AlignJustify|handleViewModeChange" packages/react/src/components/Toolbar.tsx` and confirm zero matches.
- Run `grep -nE "view-mode-split|view-mode-unified" packages/react/src/components/FileTree.tsx` and confirm exactly two matches.
- Run `grep -nE "Columns2|AlignJustify" packages/react/src/components/FileTree.tsx` and confirm at least two matches (one in imports + one usage of each).
- Run `npm run test:unit` and confirm the existing suite still passes (regressions in unrelated tests indicate the relocation broke something).

### Notes / Gotchas

- Do **not** rename the `data-testid` values — they are referenced verbatim in `tests/webapp-steps/05-view-modes-and-toolbar.steps.ts` and `tests/recording/demo-recording.spec.ts`.
- Do **not** introduce a new row in the `FileTree` header — the toggle must sit in the existing first row of the header so the header height does not change (consumer compatibility risk).
- Do **not** change `ConfigContext` or any persistence layer — `config.diffView` is already managed there and the contract is unchanged.
- The variant change from labeled (`Split` / `Unified` text + icon) to icon-only (`h-5 w-5 p-0`) is intentional: the sidebar width budget is constrained, and icon-only matches the visual language of the surrounding header buttons.
- `<span className='sr-only'>` provides accessible text for screen readers since the visible label is removed; the tooltip text is not announced reliably across browsers.

</details>
