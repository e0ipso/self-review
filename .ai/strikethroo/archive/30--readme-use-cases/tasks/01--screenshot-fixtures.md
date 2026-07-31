---
id: 1
group: "screenshot-tooling"
dependencies: []
status: "completed"
created: "2026-03-04"
skills:
  - typescript
  - playwright
---

# Create Screenshot Test Fixtures

## Objective
Create 4 dedicated test fixture functions that set up tailored scenarios for each use case screenshot.

## Skills Required
TypeScript, Playwright/Electron test patterns

## Acceptance Criteria
- [ ] `createPlanReviewFixture()` — git repo with a markdown plan file as a new untracked file
- [ ] `createCodeReviewFixture()` — git repo with multi-file code diff (can extend existing `createTestRepo`)
- [ ] `createExplorationFixture()` — directory with varied source files (no git context needed, but use git repo for diff)
- [ ] `createAIReviewFixture()` — git repo + pre-generated XML review file with AI-style comments
- [ ] All fixtures return cleanup-friendly paths
- [ ] Fixture file created at `tests/screenshots/screenshot-fixtures.ts`

## Technical Requirements
- Follow the pattern in `tests/fixtures/test-repo.ts` for git repo creation
- UC1 fixture: create a plan markdown file with headings, bullet lists, mermaid diagram, and code blocks — something that looks like a real AI assistant plan
- UC3 fixture: create a directory with `.ts`, `.md`, `.yaml` files to show variety in the file tree
- UC4 fixture: use `createPriorReviewXml()` from test-repo.ts or similar pattern to generate the resume XML

## Input Dependencies
None

## Output Artifacts
`tests/screenshots/screenshot-fixtures.ts` with 4 exported fixture functions

## Implementation Notes

<details>

**UC1 — Plan Review fixture**: Create a git repo, add and commit a baseline, then add a new untracked `plan.md` file with content resembling an AI assistant implementation plan. Include headings (## Approach, ## Steps, ## Risks), bullet points, a mermaid diagram block, and a code snippet. The diff should show this as a new file addition.

**UC2 — Code Review fixture**: Reuse `createTestRepo()` directly or create a similar function. The key is having modified, added, and deleted files to show a realistic code review. Add a `.self-review.yaml` with categories (bug, nit, question, improvement).

**UC3 — Exploration fixture**: Create a git repo with several committed files across directories: `src/auth.ts`, `src/config.ts`, `src/utils/helpers.ts`, `docs/README.md`, `config.yaml`. Then create unstaged changes in all of them so they appear in the diff. Add `.self-review.yaml` with categories including "question", "improvement", "needs-docs".

**UC4 — AI-Assisted Review fixture**: Same as UC2 but also generate an XML file with 2-3 pre-written comments that look like AI feedback (e.g., "Consider using bcrypt for password hashing", "This function exceeds 20 lines — consider extracting helper"). The app will be launched with `--resume-from` pointing to this XML.

</details>
