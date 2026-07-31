---
id: 7
group: "commentinput-refactor"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Promote `AttachmentImage` to a Named Component

## Objective
Move the private `AttachmentImage` function component from the top of `CommentDisplay.tsx` to its own file `Comments/AttachmentImage.tsx`, enabling direct testing and reuse without importing the full display component.

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `AttachmentImage.tsx` exists in `packages/react/src/components/Comments/`
- [ ] `CommentDisplay.tsx` imports `AttachmentImage` from the new file
- [ ] `AttachmentImage` is no longer defined inside `CommentDisplay.tsx`
- [ ] Attachment image rendering behaviour is visually identical before and after
- [ ] `npm run test:unit` passes

## Technical Requirements
- Source file: `packages/react/src/components/Comments/CommentDisplay.tsx`
- New file: `packages/react/src/components/Comments/AttachmentImage.tsx`
- Distinct from existing `AttachmentThumbnail.tsx` (which serves the input-side thumbnail) — do not confuse or merge these
- The component handles: blob URL creation, adapter-based file reading, error display, and image click-to-open flow

## Input Dependencies
None

## Output Artifacts
- `packages/react/src/components/Comments/AttachmentImage.tsx` — promoted component
- Updated `packages/react/src/components/Comments/CommentDisplay.tsx` — imports from new file

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `CommentDisplay.tsx`** and locate the `AttachmentImage` private function component defined at the top. Note its props interface and all the logic it contains (blob URL lifecycle, adapter-based file read, error state, click-to-open handler).

2. **Create `AttachmentImage.tsx`** in `packages/react/src/components/Comments/`. Copy the component definition (including its props interface and any local type declarations it needs) verbatim. Add any needed imports that were previously satisfied by the surrounding file scope.

3. **Remove** the `AttachmentImage` definition from `CommentDisplay.tsx` and add an import:
   ```ts
   import { AttachmentImage } from './AttachmentImage';
   ```

4. **Run `npm run test:unit`** and confirm no failures.

5. **Verify**: The file `CommentDisplay.tsx` should have no inline `function AttachmentImage` or `const AttachmentImage` definition.

</details>
