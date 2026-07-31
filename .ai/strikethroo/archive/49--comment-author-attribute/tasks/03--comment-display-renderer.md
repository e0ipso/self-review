---
id: 3
group: "comment-author-attribute"
dependencies: [1]
status: "completed"
created: 2026-04-03
skills:
  - react-components
  - typescript
---
# CommentDisplay Renderer Update

## Objective

Update the `CommentDisplay` component to show a bot icon + author name for bot comments, and a person icon + "You" for authorless comments.

## Skills Required

- React components
- TypeScript
- lucide-react icons

## Acceptance Criteria

- [ ] When `comment.author` is set: shows a `Bot` icon (from lucide-react) alongside the author string
- [ ] When `comment.author` is absent: shows a `User` icon (from lucide-react) alongside "You"
- [ ] Icons are appropriately sized and styled to match existing UI
- [ ] No TypeScript compilation errors
- [ ] Renderer unit tests pass

## Technical Requirements

- File to modify: `packages/react/src/components/Comments/CommentDisplay.tsx`
- Use `Bot` and `User` icons from `lucide-react` (already a project dependency)
- Maintain existing styling patterns

## Input Dependencies

Task 01 must be completed (ReviewComment type has `author` field).

## Output Artifacts

- Updated `CommentDisplay` component with author rendering logic
