---
id: 3
group: 'comment-display'
dependencies: [1]
status: 'completed'
created: '2026-02-11'
skills:
  - react-components
---

# Add Tooltip to CommentDisplay Category Badge

## Objective

Wrap the existing category Badge in `CommentDisplay.tsx` with a Tooltip so that hovering over it
shows the category's description text.

## Skills Required

- React components: Adding Tooltip wrapper to existing Badge element

## Acceptance Criteria

- [ ] Hovering over the category Badge in a rendered comment shows a tooltip with the category
      description
- [ ] When no `categoryDef` is found (unknown category), no tooltip is shown — the Badge renders as
      before
- [ ] Badge markup and styling remain unchanged (only the tooltip wrapper is added)
- [ ] Flex layout in the header row is not broken by the tooltip wrapper
- [ ] App compiles without errors

## Technical Requirements

- Import `Tooltip`, `TooltipTrigger`, `TooltipContent` from `../ui/tooltip`
- `TooltipProvider` already exists as an ancestor in `App.tsx`
- Use `asChild` on `TooltipTrigger` to avoid introducing an extra DOM wrapper that would break the
  flex row alignment
- The Badge is inside a `flex items-center gap-2` container (line 73 of CommentDisplay.tsx)

## Input Dependencies

- Task 1 (default categories) provides `categoryDef.description` values. Without it, `categoryDef`
  would be `undefined` for default category names and no tooltip would show.

## Output Artifacts

- Modified `src/renderer/components/Comments/CommentDisplay.tsx` with Tooltip wrapping the category
  Badge

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### Step 1: Add imports

Add to the existing imports in `CommentDisplay.tsx`:

```typescript
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
```

### Step 2: Wrap the Badge with Tooltip

The current Badge code (lines 96-109) is:

```tsx
{
  comment.category && (
    <Badge
      variant='secondary'
      className='category-badge h-5 px-1.5 text-[10px] font-medium'
      style={{
        backgroundColor: categoryDef?.color ? `${categoryDef.color}20` : undefined,
        color: categoryDef?.color || undefined,
        borderColor: categoryDef?.color ? `${categoryDef.color}40` : undefined,
        borderWidth: '1px',
      }}
    >
      {comment.category}
    </Badge>
  );
}
```

Replace it with a conditional that shows tooltip only when `categoryDef` exists (meaning the
category is recognized and has a description):

```tsx
{
  comment.category &&
    (categoryDef ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant='secondary'
            className='category-badge h-5 px-1.5 text-[10px] font-medium'
            style={{
              backgroundColor: categoryDef.color ? `${categoryDef.color}20` : undefined,
              color: categoryDef.color || undefined,
              borderColor: categoryDef.color ? `${categoryDef.color}40` : undefined,
              borderWidth: '1px',
            }}
          >
            {comment.category}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side='bottom'>{categoryDef.description}</TooltipContent>
      </Tooltip>
    ) : (
      <Badge
        variant='secondary'
        className='category-badge h-5 px-1.5 text-[10px] font-medium'
        style={{
          borderWidth: '1px',
        }}
      >
        {comment.category}
      </Badge>
    ));
}
```

### Important Notes

- **`asChild` on `TooltipTrigger`**: This is critical. Without it, `TooltipTrigger` renders an extra
  `<button>` wrapper which would break the flex layout. With `asChild`, it renders through the
  `Badge` element directly using Base UI's `render` prop internally.
- **Fallback for unknown categories**: When `categoryDef` is `undefined` (e.g., a category from a
  prior config that no longer exists), the Badge renders without a tooltip and without color
  styling. This preserves the existing graceful degradation.
- **No other changes**: Do not modify any other part of `CommentDisplay.tsx`. The Badge styling, the
  header flex layout, collapse behavior, etc. all stay exactly as they are.

</details>
