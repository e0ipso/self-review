---
id: 2
group: "screenshot-tooling"
dependencies: [1]
status: "completed"
created: "2026-03-04"
skills:
  - playwright
  - typescript
---

# Create Playwright Screenshot Spec

## Objective
Create a Playwright test spec that launches the Electron app with each fixture and captures multiple screenshots per use case.

## Skills Required
Playwright, Electron testing, TypeScript

## Acceptance Criteria
- [ ] Spec file at `tests/screenshots/use-case-screenshots.spec.ts`
- [ ] UC1 captures: (a) raw diff of plan.md, (b) rendered markdown view, (c) inline comment on plan section
- [ ] UC2 captures: (a) split diff view with a comment, (b) suggestion block
- [ ] UC3 captures: (a) file tree with directory structure, (b) file with categorized comments, (c) category selector
- [ ] UC4 captures: (a) pre-loaded AI comments visible, (b) user adding own comment alongside AI ones
- [ ] All screenshots saved to `docs/screenshots/` with names like `uc1-plan-diff.png`, `uc1-rendered.png`, etc.
- [ ] `npm run screenshots` script added to `package.json`
- [ ] Screenshots are 1280x800 or similar consistent size

## Technical Requirements
- Follow patterns from `tests/recording/demo-recording.spec.ts` for Electron launch and interaction
- Use `page.screenshot({ path: ... })` for each capture
- Use helpers like `humanClick`, `triggerCommentIcon` adapted from the demo spec
- Each use case is a separate `test()` block within the spec
- Ensure cleanup of temp repos/dirs in `finally` blocks

## Input Dependencies
- Task 1: screenshot fixtures (`tests/screenshots/screenshot-fixtures.ts`)

## Output Artifacts
- `tests/screenshots/use-case-screenshots.spec.ts`
- `package.json` updated with `screenshots` npm script
- When run on host: `docs/screenshots/uc{1-4}-*.png` files

## Implementation Notes

<details>

**Spec structure**:
```
test.describe('Use Case Screenshots', () => {
  test('UC1: Plan Review', async () => { ... });
  test('UC2: Code Review', async () => { ... });
  test('UC3: Codebase Exploration', async () => { ... });
  test('UC4: AI-Assisted Review', async () => { ... });
});
```

**UC1 screenshots**:
1. Launch with plan fixture repo, wait for file tree
2. Screenshot the full diff view showing the plan.md file → `uc1-plan-diff.png`
3. Click the rendered markdown toggle on the plan.md file header
4. Screenshot the rendered view → `uc1-rendered.png`
5. Open a comment on a rendered paragraph block, type feedback
6. Submit the comment, screenshot → `uc1-inline-comment.png`

**UC2 screenshots**:
1. Launch with code review fixture repo
2. Navigate to login.ts, screenshot split diff → `uc2-split-diff.png`
3. Add a line comment, submit it, screenshot → `uc2-comment.png`
4. Add a suggestion on a line, submit, screenshot the suggestion block → `uc2-suggestion.png`

**UC3 screenshots**:
1. Launch with exploration fixture
2. Screenshot the file tree showing all files → `uc3-file-tree.png`
3. Open comment on a file, select "question" category, type and submit
4. Open another comment, select "improvement", type and submit
5. Open another, select "needs-docs", type and submit
6. Screenshot showing the categorized comments → `uc3-categorized.png`
7. Open category selector, screenshot → `uc3-categories.png`

**UC4 screenshots**:
1. Launch with AI review fixture + `--resume-from` XML
2. Wait for diff to load with pre-existing comments
3. Screenshot showing AI comments → `uc4-ai-comments.png`
4. Add a new comment alongside the AI ones
5. Screenshot → `uc4-mixed-comments.png`

**npm script** in package.json:
```json
"screenshots": "npx playwright test tests/screenshots/use-case-screenshots.spec.ts --project=default"
```

Or simpler: use the same Playwright config as the recording spec. Check how `record:demo` is configured.

</details>
