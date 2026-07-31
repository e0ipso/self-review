---
id: 2
group: "emoji-support"
dependencies: [1]
status: "completed"
created: "2026-02-27"
skills:
  - react-components
  - css
---
# Create emoji autocomplete dropdown for CommentInput

## Objective
Build an inline emoji autocomplete dropdown that appears when users type `:` + 2 characters in the MDEditor comment textarea. The dropdown shows matching emojis and supports keyboard/mouse selection.

## Skills Required
- React component development, hooks, CSS positioning

## Acceptance Criteria
- [ ] Typing `:` followed by 2+ alphanumeric/underscore characters in the MDEditor shows a dropdown
- [ ] Dropdown shows up to 8 matching emojis with their Unicode character and shortcode name
- [ ] Dropdown is positioned near the cursor in the textarea
- [ ] Arrow up/down navigates the dropdown, Enter/Tab selects, Escape dismisses
- [ ] Selecting an emoji replaces the `:query` text with the Unicode emoji character
- [ ] Dropdown does not appear when cursor is not preceded by a colon pattern
- [ ] Dropdown dismisses when the user deletes back past the colon
- [ ] Normal typing and existing shortcuts (Ctrl+Enter submit, Escape to unfocus) still work when dropdown is closed

## Technical Requirements
- Use `searchEmojis` from `src/renderer/utils/emoji-data.ts` (task 1)
- MDEditor textarea is accessible via `.w-md-editor-text-input` selector
- Must handle caret position measurement for dropdown placement
- Must integrate with existing `textareaProps.onKeyDown` in CommentInput.tsx

## Input Dependencies
- Task 1: `src/renderer/utils/emoji-data.ts` with `searchEmojis` function

## Output Artifacts
- `src/renderer/hooks/useEmojiAutocomplete.ts` — hook managing autocomplete state
- `src/renderer/components/Comments/EmojiAutocomplete.tsx` — dropdown component
- Modified `src/renderer/components/Comments/CommentInput.tsx` — integration

## Implementation Notes

<details>
<summary>Details</summary>

### useEmojiAutocomplete hook (`src/renderer/hooks/useEmojiAutocomplete.ts`)

1. Accept `body: string` and `textareaRef` (or use a selector to find `.w-md-editor-text-input`)
2. State: `{ isOpen: boolean; query: string; results: EmojiMatch[]; selectedIndex: number; position: { top: number; left: number } }`
3. On body change, check if the text before the cursor matches `/:(\w{2,})$/`:
   - Get the textarea element via `document.querySelector('.w-md-editor-text-input')` within the comment input container
   - Get cursor position: `textarea.selectionStart`
   - Extract text before cursor: `body.substring(0, cursorPos)`
   - Test regex match
4. If match found:
   - Call `searchEmojis(match[1])` to get results
   - If results.length > 0, compute position and set isOpen=true
   - Position: use a mirror div technique or the `textarea-caret-position` approach:
     - Create a hidden div mirroring textarea styles
     - Set its content to text before cursor
     - Measure the resulting position of the end of text
     - Or use a simpler approach: position the dropdown just below the textarea's visible area at a fixed offset
5. If no match or results empty, set isOpen=false
6. Return: `{ isOpen, results, selectedIndex, position, onKeyDown, selectEmoji, setSelectedIndex }`

The `onKeyDown` handler:
- If dropdown is open:
  - ArrowDown: increment selectedIndex (wrap around)
  - ArrowUp: decrement selectedIndex (wrap around)
  - Enter or Tab: call `selectEmoji(results[selectedIndex])`; `e.preventDefault()`
  - Escape: close dropdown; `e.preventDefault()`
- If dropdown is closed: pass through (don't interfere)

The `selectEmoji` function:
- Find the `:query` text before cursor in body
- Replace it with `emoji.native`
- Call the body setter to update the MDEditor value

### EmojiAutocomplete component (`src/renderer/components/Comments/EmojiAutocomplete.tsx`)

1. Props: `{ isOpen, results, selectedIndex, position, onSelect, onHover }`
2. Render only when `isOpen && results.length > 0`
3. Use `position: absolute` within the editor container (needs a `position: relative` wrapper)
4. Style: small card/popover with shadcn-like styling (bg-popover, border, rounded-md, shadow-md)
5. Each item: flex row with emoji native character (text-lg) + shortcode name (text-sm text-muted-foreground)
6. Selected item: highlighted with `bg-accent`
7. Mouse: onClick to select, onMouseEnter to update selectedIndex
8. Dark mode: use existing theme classes

### CommentInput.tsx integration

1. Import `useEmojiAutocomplete` and `EmojiAutocomplete`
2. Call the hook with `body` state and a ref/selector for the textarea
3. Wrap the MDEditor in a `position: relative` div if not already
4. Render `<EmojiAutocomplete>` inside that wrapper
5. In `textareaProps.onKeyDown`, call the hook's `onKeyDown` first — if it handles the event (dropdown open), skip existing handling
6. When emoji is selected, update `body` via `setBody` and the dropdown will auto-close on next body change check

### Caret position approach (simplest)

Since precise pixel-level caret tracking in a textarea is complex, consider this pragmatic approach:
- Position the dropdown just above or below the MDEditor toolbar area
- Or use the `textarea-caret` npm package (small, well-tested) if pixel-precision is desired
- The dropdown doesn't need to track the cursor precisely — near the editor is sufficient for a good UX

If using `textarea-caret`:
```bash
npm install textarea-caret
```
This gives `getCaretCoordinates(textarea, position)` → `{ top, left, height }` relative to the textarea.

</details>
