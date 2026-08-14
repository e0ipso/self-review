---
id: 2
group: "markdown-toolbar"
dependencies: [1]
status: "completed"
created: "2026-02-16"
skills:
  - "react-components"
  - "css"
---

# Replace Textarea with MDEditor in CommentInput

## Objective

Replace the plain shadcn `<Textarea>` for the comment body in `CommentInput.tsx` with `@uiw/react-md-editor` configured in write-only mode (no preview pane), with a GitHub-style formatting toolbar and proper theme integration.

## Skills Required

- React component integration
- CSS/Tailwind styling for third-party component theming

## Acceptance Criteria

- [ ] The comment body input uses `<MDEditor>` with `preview="edit"` (no preview pane)
- [ ] Toolbar displays all required buttons: headings, bold, italic, quote, code, link, bulleted list, numbered list, task list
- [ ] `value` and `onChange` are wired to the existing `body`/`setBody` state
- [ ] Ctrl+Enter (Cmd+Enter on Mac) submits the comment via the existing `handleSubmit()` function
- [ ] Editor styling matches the existing card-based comment input design (border, background, shadow)
- [ ] Light and dark themes are both supported via `data-color-mode` attribute
- [ ] Min-height matches the current textarea dimensions (~80px)
- [ ] Suggestion textareas (Original / Suggested) remain as plain shadcn `<Textarea>` — unchanged
- [ ] Existing unit tests pass (with minimal adaptation if needed due to the component swap)

## Technical Requirements

- Import `MDEditor` and required `commands` from `@uiw/react-md-editor`
- Configure `commands` prop with: `commands.title1` through `commands.title3` (or group), `commands.bold`, `commands.italic`, `commands.quote`, `commands.code`, `commands.link`, `commands.unorderedListCommand`, `commands.orderedListCommand`, `commands.checkedListCommand`
- Use `preview="edit"` to disable the preview pane
- Wire `onKeyDown` handler on the editor's container or use the editor's keyboard event handling to intercept Ctrl+Enter / Cmd+Enter
- Add CSS overrides to:
  - Remove default editor border/chrome that conflicts with the parent card container
  - Match `bg-card` background and `border-border` colors
  - Set `min-height: 80px` on the editor area
  - Ensure toolbar buttons are appropriately sized
- Use `data-color-mode="dark"` or `"light"` based on the app's current theme (check how the app manages theme — likely via a class on `<html>` or a React context)

## Input Dependencies

- Task 1: `@uiw/react-md-editor` must be installed

## Output Artifacts

- Modified `src/renderer/components/Comments/CommentInput.tsx`
- Possibly a small CSS file or style block for editor overrides (or inline styles via `className` / style props)

## Implementation Notes

<details>

### Key file: `src/renderer/components/Comments/CommentInput.tsx`

Current implementation uses:
```tsx
<Textarea
  value={body}
  onChange={e => setBody(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder='Add your review comment...'
  className='min-h-[80px] resize-y text-sm border-0 shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/60'
  autoFocus
/>
```

Replace with something like:
```tsx
import MDEditor, { commands } from '@uiw/react-md-editor';

<div data-color-mode={theme === 'dark' ? 'dark' : 'light'}>
  <MDEditor
    value={body}
    onChange={(val) => setBody(val || '')}
    preview="edit"
    commands={[
      commands.title1, commands.title2, commands.title3,
      commands.divider,
      commands.bold, commands.italic,
      commands.divider,
      commands.quote, commands.code, commands.link,
      commands.divider,
      commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand,
    ]}
    extraCommands={[]}  // Remove default extra commands (preview toggle, fullscreen)
    textareaProps={{
      placeholder: 'Add your review comment...',
      onKeyDown: (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      },
    }}
    height={120}
  />
</div>
```

### Theme detection

Check how the app detects theme. Look at `App.tsx`, `ConfigContext.tsx`, or check if there's a `dark` class on `<html>`. The `data-color-mode` attribute on a parent div controls the editor's theme.

### CSS overrides

The editor comes with its own styles. To make it blend with the card container:
- Remove the editor's default border: `.w-md-editor { border: none !important; }`
- Match background: `.w-md-editor { background-color: transparent !important; }`
- Toolbar styling: `.w-md-editor-toolbar { border-bottom: 1px solid var(--border) !important; }`
- Set min-height on the text area: `.w-md-editor-text { min-height: 80px; }`

These can go in a scoped CSS class or in the component's module CSS.

### Ctrl+Enter handling

The `textareaProps.onKeyDown` should intercept Ctrl+Enter before the editor processes it. Test this works — if not, wrap the editor in a `div` with an `onKeyDownCapture` handler.

### What NOT to change

- Do NOT modify the suggestion `<Textarea>` components (Original / Suggested code inputs)
- Do NOT add a preview pane
- Do NOT change the `handleSubmit`, `handleCancel`, or state management logic
- Keep the same `data-testid='comment-input'` on the outer container

</details>
