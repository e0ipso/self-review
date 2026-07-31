---
id: 2
group: "rendered-html-support"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - react-components
  - typescript
complexity_score: 4.8
complexity_notes: "Moderate complexity because it refactors the existing rendered Markdown component contract while preserving source-position comment mapping."
---
# Unify Rendered Text View for Markdown and HTML

## Objective
Adapt the existing rendered Markdown review path so it can render raw added-file HTML through the same block wrapper, gutter, comment display, and line-range comment creation mechanics used by Markdown.

## Skills Required
This task requires React component and TypeScript skills because it changes component contracts and preserves typed comment/range behavior across rendered content modes.

## Acceptance Criteria
- [ ] The rendered text component accepts an explicit content mode for Markdown vs HTML.
- [ ] Markdown rendering keeps current plugins, front-matter handling, rendered output, and line-mapped comment behavior.
- [ ] HTML rendering uses the extracted added-line content directly instead of translating Markdown.
- [ ] Rendered HTML blocks support gutter-based line-range comment creation.
- [ ] Existing file-level comments remain available in rendered text mode.
- [ ] Raw diff line-level commenting remains unchanged.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Refactor the current rendered Markdown path in `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx` or its nearest equivalent. Keep comment rendering, source-line mapping, and input/display components centralized. Avoid adding new runtime dependencies.

## Input Dependencies
Task 1 must provide the rendered-text mode derivation and dispatch wiring needed by this component.

## Output Artifacts
- A unified rendered text component path that handles both Markdown and HTML.
- Updated imports and prop types in any parent components that render the text preview.
- Preserved Markdown behavior and added HTML behavior without duplicate comment UI logic.

## Implementation Notes
<details>
<summary>Detailed implementation guidance</summary>

1. Start by reading `RenderedMarkdownView.tsx` and the parent component that calls it. Identify the current responsibilities:
   - extracting added lines from hunks,
   - rendering Markdown content,
   - mapping rendered block source positions back to added-line ranges,
   - showing gutter controls,
   - opening `CommentInput`,
   - displaying existing comments.
2. Rename the component only if it improves clarity and the change stays small, for example `RenderedTextView`. If renaming creates broad churn, keep the existing filename and add a mode prop.
3. Add a prop such as `contentMode: "markdown" | "html"` using the mode from Task 1. Keep the prop local to the renderer package unless a shared type already exists.
4. Keep Markdown mode behavior as close to the current code as possible:
   - continue using `react-markdown`, `remark-gfm`, emoji handling, front matter rendering, and any current AST/source-position logic;
   - do not change Markdown sanitization, class names, or gutter behavior unless required by the mode extraction.
5. For HTML mode:
   - build the rendered source from the same extracted added lines used by Markdown mode;
   - render the HTML directly through the shared rendered-content wrapper path;
   - keep comments attached to `newLineStart`/`newLineEnd` ranges only;
   - preserve block-level line mapping. If exact AST positions are unavailable for arbitrary raw HTML, use the narrowest reliable block-to-line strategy based on the extracted added-line sequence and document that behavior in code only if it is not obvious.
6. Reuse existing comment components. Do not create HTML-specific comment input, display, suggestion, or gutter components.
7. Check for layout risks from arbitrary HTML. Keep rendered content constrained by existing preview/prose container styles and do not add external resource loading.
8. Ensure lazy file loading and expand-context behavior do not need special cases for HTML. If the current rendered Markdown path depends only on loaded hunks, HTML should follow the same path.
</details>
