---
id: 2
group: "category-selector"
dependencies: [1]
status: "completed"
created: "2026-02-11"
skills:
  - react-components
complexity_score: 4
complexity_notes: "Single component rewrite with tooltip integration; moderate but well-scoped"
---
# Redesign CategorySelector as Toggleable Pill Buttons with Tooltips

## Objective
Replace the current `<Select>` dropdown in `CategorySelector.tsx` with a row of toggleable colored pill buttons. Each pill shows a color indicator + category name, supports single-select toggle behavior, and displays the category description in a tooltip on hover.

## Skills Required
- React components: Rewriting the component UI with shadcn/ui primitives (Badge-like buttons, Tooltip)

## Acceptance Criteria
- [ ] Each category renders as a small pill button with a color dot and the category name
- [ ] Clicking an unselected pill selects it (calls `onChange(cat.name)`)
- [ ] Clicking the already-selected pill deselects it (calls `onChange(null)`)
- [ ] Only one pill can be active at a time
- [ ] Active pill has filled background using category color at reduced opacity, matching border, and text in category color
- [ ] Hovering over any pill shows a tooltip with the category's `description`
- [ ] Pills use `h-7 text-xs` sizing consistent with surrounding action bar buttons
- [ ] When `config.categories` is empty, the component renders nothing
- [ ] The component's public interface (`value: string | null`, `onChange: (category: string | null) => void`) is unchanged — `CommentInput.tsx` requires no modifications
- [ ] The `<Select>` import and all related shadcn select imports are removed
- [ ] App compiles without errors

## Technical Requirements
- Use existing shadcn/ui components: `Tooltip`, `TooltipTrigger`, `TooltipContent` from `../ui/tooltip`
- Use `Button` from `../ui/button` for the pill elements (ghost variant for inactive, custom styled for active)
- `TooltipProvider` already wraps the app in `App.tsx` — no provider needed
- The tooltip uses `@base-ui/react/tooltip` under the hood (not Radix). The `Tooltip` component is `TooltipPrimitive.Root`, `TooltipTrigger` supports an `asChild` prop that uses `render` instead of Radix's `asChild`
- The `data-testid="category-selector"` on the wrapper div should be preserved

## Input Dependencies
- Task 1 (default categories) provides the category data that will render as pills. Without it, the component would render nothing due to empty categories.

## Output Artifacts
- Fully rewritten `src/renderer/components/Comments/CategorySelector.tsx`

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### Step 1: Replace imports

Remove the Select-related imports:
```typescript
// REMOVE these:
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
```

Add new imports:
```typescript
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
```

Keep existing imports:
```typescript
import React from 'react';
import { useConfig } from '../../context/ConfigContext';
```

### Step 2: Rewrite the component body

The component should render a flex row of pill buttons. Here is the target structure:

```tsx
export default function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const { config } = useConfig();

  if (!config.categories || config.categories.length === 0) {
    return null;
  }

  return (
    <div data-testid="category-selector" className="flex items-center gap-1">
      {config.categories.map((cat) => {
        const isActive = value === cat.name;
        return (
          <Tooltip key={cat.name}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid={`category-option-${cat.name}`}
                onClick={() => onChange(isActive ? null : cat.name)}
                className="h-7 px-2 text-xs gap-1.5"
                style={isActive ? {
                  backgroundColor: `${cat.color}20`,
                  color: cat.color,
                  borderColor: `${cat.color}40`,
                  borderWidth: '1px',
                } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {cat.description}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
```

### Key Styling Notes

- **Inactive pills**: Use `variant="ghost"` on Button — gives a subtle hover effect without background.
- **Active pill**: Apply inline styles for `backgroundColor` (category color at `20` hex opacity = ~12%), `color` (full category color), `borderColor` (category color at `40` hex opacity = ~25%), `borderWidth: '1px'`. This matches the existing `CommentDisplay` Badge style.
- **Color dot**: A `<span>` with `h-2 w-2 rounded-full` and `backgroundColor: cat.color` — same as the old dropdown dots.
- **Sizing**: `h-7 text-xs` matches the "Suggest" button and other action bar elements in `CommentInput`.

### Tooltip Implementation Note

The tooltip component in this project uses `@base-ui/react/tooltip` (NOT Radix). The `TooltipTrigger` component's `asChild` prop works by passing a `render` prop internally. When using `asChild` with `Button`, ensure the Button is a direct child. The pattern `<TooltipTrigger asChild><Button>...</Button></TooltipTrigger>` is the correct usage.

### What NOT to Change
- Do NOT modify `CommentInput.tsx` — it already uses `<CategorySelector value={category} onChange={setCategory} />` which is unchanged.
- Do NOT modify the `CategorySelectorProps` interface — the public API stays the same.

</details>
