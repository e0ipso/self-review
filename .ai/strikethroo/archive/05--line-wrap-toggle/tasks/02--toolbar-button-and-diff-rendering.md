---
id: 2
group: 'line-wrap-ui'
dependencies: [1]
status: 'completed'
created: '2026-02-12'
skills:
  - react-components
  - css
---

# Add Toolbar Toggle Button and Conditional Diff Line Wrapping

## Objective

Add a "Wrap Lines" / "No Wrap" ghost button to the toolbar and make line wrapping conditional in
`SyntaxLine`, `SplitView`, and `UnifiedView` components based on `config.wordWrap`.

## Skills Required

- React components (toolbar button pattern, prop passing, context consumption)
- CSS / Tailwind (conditional whitespace and overflow classes)

## Acceptance Criteria

- [ ] Toolbar has a new ghost button immediately after the "Hide/Show New Files" button
- [ ] Button shows `WrapText` icon + "Wrap Lines" when wrapping is on, `MoveHorizontal` icon + "No Wrap" when off
- [ ] Button has tooltip: "Wrap long lines" / "Scroll long lines horizontally"
- [ ] Button has `data-testid="toggle-word-wrap-btn"`
- [ ] Clicking the button toggles `config.wordWrap` via `updateConfig`
- [ ] `SyntaxLine` renders `whitespace-pre-wrap` when `wordWrap` is true, `whitespace-pre` when false
- [ ] `SplitView` and `UnifiedView` code content divs apply `[overflow-x:overlay]` only when `wordWrap` is false
- [ ] When wrapping is on: long lines wrap, no horizontal scrollbar
- [ ] When wrapping is off: long lines produce horizontal scrollbar within code content area only (gutters unaffected)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Import `WrapText` and `MoveHorizontal` from `lucide-react` (already a dependency)
- Follow the exact same button pattern as the `showUntracked` toggle in `Toolbar.tsx`
- `SyntaxLine` needs a new `wordWrap` prop (boolean)
- `SplitView` and `UnifiedView` read `config.wordWrap` from `useConfig()` and pass it to `SyntaxLine`
- The `useConfig` import already exists in both view components (it is used indirectly via the review context pattern — check if `useConfig` needs to be added)

## Input Dependencies

- Task 1 must be complete: `AppConfig.wordWrap` must exist in types, config, and context

## Output Artifacts

- Updated `Toolbar.tsx` with word-wrap toggle button
- Updated `SyntaxLine.tsx` with conditional whitespace class
- Updated `SplitView.tsx` and `UnifiedView.tsx` with conditional overflow and prop passing

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### 1. `src/renderer/components/Toolbar.tsx`

**Add imports** — add `WrapText` and `MoveHorizontal` to the `lucide-react` import list.

**Add button** — immediately after the closing `</Tooltip>` of the "Hide/Show New Files" button
(line ~188) and before the closing `</div>` of the left button group, add:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant='ghost'
      size='sm'
      data-testid='toggle-word-wrap-btn'
      onClick={() => updateConfig({ wordWrap: !config.wordWrap })}
      className='gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground'
    >
      {config.wordWrap ? (
        <WrapText className='h-3.5 w-3.5' />
      ) : (
        <MoveHorizontal className='h-3.5 w-3.5' />
      )}
      <span className='text-xs'>
        {config.wordWrap ? 'Wrap Lines' : 'No Wrap'}
      </span>
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    {config.wordWrap
      ? 'Wrap long lines'
      : 'Scroll long lines horizontally'}
  </TooltipContent>
</Tooltip>
```

### 2. `src/renderer/components/DiffViewer/SyntaxLine.tsx`

**Update the `SyntaxLineProps` interface** to add:
```typescript
wordWrap?: boolean;
```

**Update the component** to destructure `wordWrap` and use it conditionally on the `<code>` element:
```tsx
const SyntaxLine = React.memo(function SyntaxLine({
  content,
  language,
  lineType: _lineType,
  wordWrap,
}: SyntaxLineProps) {
  // ... existing useMemo ...

  return (
    <code
      className={`font-mono text-[13px] ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} block`}
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
    />
  );
});
```

Note: The current class is `'font-mono text-[13px] whitespace-pre block'`. Replace the hardcoded
`whitespace-pre` with the conditional expression.

### 3. `src/renderer/components/DiffViewer/SplitView.tsx`

**Add `useConfig` import**:
```typescript
import { useConfig } from '../../context/ConfigContext';
```

**Read config** at the top of the component function:
```typescript
const { config } = useConfig();
```

**Update the code content div** in `renderLineCell` (currently line ~131):
Change from:
```tsx
<div className='flex-1 px-3 py-0.5 [overflow-x:overlay] leading-[22px]'>
```
To:
```tsx
<div className={`flex-1 px-3 py-0.5 leading-[22px]${config.wordWrap ? '' : ' [overflow-x:overlay]'}`}>
```

**Pass `wordWrap` to `SyntaxLine`**:
```tsx
<SyntaxLine
  content={line.content}
  language={language}
  lineType={line.type}
  wordWrap={config.wordWrap}
/>
```

### 4. `src/renderer/components/DiffViewer/UnifiedView.tsx`

**Add `useConfig` import**:
```typescript
import { useConfig } from '../../context/ConfigContext';
```

**Read config** at the top of the component function:
```typescript
const { config } = useConfig();
```

**Update the code content div** (currently line ~161):
Change from:
```tsx
<div className='flex-1 px-3 py-0.5 [overflow-x:overlay] leading-[22px]'>
```
To:
```tsx
<div className={`flex-1 px-3 py-0.5 leading-[22px]${config.wordWrap ? '' : ' [overflow-x:overlay]'}`}>
```

**Pass `wordWrap` to `SyntaxLine`**:
```tsx
<SyntaxLine
  content={line.content}
  language={language}
  lineType={line.type}
  wordWrap={config.wordWrap}
/>
```

</details>
