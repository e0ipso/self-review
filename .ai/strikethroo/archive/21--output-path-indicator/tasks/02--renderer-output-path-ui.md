---
id: 2
group: 'output-path-indicator'
dependencies: [1]
status: 'completed'
created: '2026-02-27'
skills:
  - react-components
  - typescript
---

# Add Output Path Footer in FileTree and Disable Finish Review When Unwritable

## Objective

Add a footer section to the FileTree component showing the output path with writability status, a "Change..." button, and disable the "Finish Review" button in the Toolbar when the path is not writable. Also update ConfigContext to manage output path state.

## Skills Required

- react-components: FileTree footer, Toolbar button gating, ConfigContext state
- typescript: Type-safe state management

## Acceptance Criteria

- [ ] `ConfigContext` manages `resolvedOutputPath` and `outputPathWritable` state (initialized from config:load payload)
- [ ] `ConfigContext` exposes `setOutputPathInfo(info: OutputPathInfo)` method
- [ ] `FileTree` has a pinned footer section at the bottom showing: label "Output:", basename of the path, full path in tooltip, green checkmark (writable) or red alert icon (not writable), and a "Change..." button
- [ ] Clicking "Change..." calls `window.electronAPI.changeOutputPath()` and updates ConfigContext on success
- [ ] When path is not writable, a subtle "Path not writable" warning is shown in the footer
- [ ] "Finish Review" button in `Toolbar` is disabled when `outputPathWritable` is false
- [ ] Disabled "Finish Review" button has a tooltip: "Output path is not writable. Click 'Change...' in the file tree to pick a save location."
- [ ] All UI uses shadcn/ui components and lucide-react icons

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- shadcn/ui: Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider
- lucide-react: CheckCircle2 (green), AlertCircle (red), FolderOpen or similar for change button
- `path.basename()` equivalent in renderer (just split on `/` since we receive absolute paths)
- ConfigContext from `src/renderer/context/ConfigContext.tsx`

## Input Dependencies

- Task 1: IPC channels, types, preload API, and main process handlers must be in place

## Output Artifacts

- Updated `src/renderer/context/ConfigContext.tsx` with output path state
- Updated `src/renderer/components/FileTree.tsx` with output path footer
- Updated `src/renderer/components/Toolbar.tsx` with disabled button logic

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. ConfigContext (`src/renderer/context/ConfigContext.tsx`)

Add state alongside existing config state:
```typescript
const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo>({
  resolvedOutputPath: '',
  outputPathWritable: true,
});
```

Import `OutputPathInfo` from `src/shared/types.ts`.

Update the `ConfigContextValue` interface to include:
```typescript
outputPathInfo: OutputPathInfo;
setOutputPathInfo: (info: OutputPathInfo) => void;
```

In the `useEffect` where config is loaded from IPC, also extract and set the output path info from the payload. The exact approach depends on how Task 1 sends the data (either as part of the config payload or as separate fields).

### 2. FileTree Footer (`src/renderer/components/FileTree.tsx`)

Add a footer section at the bottom of the FileTree component, below the file list but inside the panel. The footer should be pinned to the bottom (use flex layout with the file list taking remaining space).

```tsx
// Extract basename from absolute path
const basename = outputPathInfo.resolvedOutputPath.split(/[/\\]/).pop() || 'review.xml';

// Footer JSX
<div className="border-t px-3 py-2 space-y-1">
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <span className="font-medium">Output:</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="truncate">{basename}</span>
      </TooltipTrigger>
      <TooltipContent>{outputPathInfo.resolvedOutputPath}</TooltipContent>
    </Tooltip>
    {outputPathInfo.outputPathWritable ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
    ) : (
      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
    )}
    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs ml-auto" onClick={handleChangeOutputPath}>
      Change...
    </Button>
  </div>
  {!outputPathInfo.outputPathWritable && (
    <p className="text-xs text-red-500">Path not writable</p>
  )}
</div>
```

The `handleChangeOutputPath` function:
```typescript
const handleChangeOutputPath = async () => {
  const result = await window.electronAPI.changeOutputPath();
  if (result) {
    setOutputPathInfo(result);
  }
};
```

Get `outputPathInfo` and `setOutputPathInfo` from `useConfig()`.

### 3. Toolbar (`src/renderer/components/Toolbar.tsx`)

Get `outputPathInfo` from `useConfig()`.

Wrap the "Finish Review" button with a Tooltip when disabled:
```tsx
const isFinishDisabled = !outputPathInfo.outputPathWritable;

<Tooltip>
  <TooltipTrigger asChild>
    <span> {/* span wrapper needed for disabled button tooltip */}
      <Button
        variant='default'
        size='sm'
        data-testid='finish-review-btn'
        onClick={() => window.electronAPI.saveAndQuit()}
        className='gap-1.5 h-8 px-3'
        disabled={isFinishDisabled}
      >
        <CheckCircle2 className='h-3.5 w-3.5' />
        <span className='text-xs font-medium'>Finish Review</span>
      </Button>
    </span>
  </TooltipTrigger>
  {isFinishDisabled && (
    <TooltipContent>
      Output path is not writable. Click &apos;Change...&apos; in the file tree to pick a save location.
    </TooltipContent>
  )}
</Tooltip>
```

Note: A disabled button doesn't fire mouse events for tooltips, so wrapping in a `<span>` is necessary.

### Important Patterns

- Follow the existing pattern in ConfigContext where config is loaded via `window.electronAPI.onConfigLoad()`.
- Use `useConfig()` hook to access context values (see existing usage in Toolbar and other components).
- All icons should come from `lucide-react` (already in the project).
- The FileTree component currently doesn't have a footer — you're adding a new section. Make sure the file list scrolls independently while the footer stays pinned.
</details>
