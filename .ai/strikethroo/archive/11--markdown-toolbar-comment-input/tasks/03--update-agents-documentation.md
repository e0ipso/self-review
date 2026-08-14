---
id: 3
group: "markdown-toolbar"
dependencies: [2]
status: "completed"
created: "2026-02-16"
skills:
  - "documentation"
---

# Update AGENTS.md Documentation

## Objective

Update `AGENTS.md` to document that `CommentInput` now uses `@uiw/react-md-editor` for the comment body textarea, as specified in the plan's Documentation section.

## Skills Required

- Technical documentation

## Acceptance Criteria

- [ ] `AGENTS.md` mentions that `CommentInput` uses `@uiw/react-md-editor` for the comment body
- [ ] The note is placed in an appropriate section (Critical Conventions or Components description)
- [ ] The note is concise — one or two sentences maximum

## Technical Requirements

- Add a brief note in `AGENTS.md` under Critical Conventions or near the Comments component descriptions
- Mention that the suggestion textareas remain as plain shadcn `<Textarea>` components

## Input Dependencies

- Task 2: The MDEditor integration must be complete to accurately document the final state

## Output Artifacts

- Modified `AGENTS.md`

## Implementation Notes

<details>

Add a bullet point under **Critical Conventions** in `AGENTS.md`:

```markdown
- **MDEditor for comments.** `CommentInput` uses `@uiw/react-md-editor` (write-only mode, no preview) for the comment body textarea. Suggestion code textareas remain as plain shadcn `<Textarea>` components.
```

Keep it minimal — this is just a reference note for future developers.

</details>
