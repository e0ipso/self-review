---
id: 3
group: "documentation"
dependencies: [2]
status: "completed"
created: "2026-03-04"
skills:
  - markdown
---

# Write README Use Cases Section

## Objective
Add the "Use Cases" section to README.md with 4 use cases, each having a summary and collapsible details with screenshot grids.

## Skills Required
Markdown authoring

## Acceptance Criteria
- [ ] New "## Use Cases" section placed after the intro paragraph (before `## Installation`)
- [ ] 4 use case subsections: Plan Review, Code Review, Codebase Exploration, AI-Assisted Review
- [ ] Each has a visible 1-2 sentence summary with **bold key terms**
- [ ] Each has a `<details>` block with expanded description and screenshot grid
- [ ] Screenshot grids use 2-column markdown tables with image links
- [ ] Writing is concise, factual, no hype words
- [ ] Image paths reference `docs/screenshots/uc{1-4}-*.png`
- [ ] Existing README content (Installation, How it works, etc.) is not modified

## Technical Requirements
- Use standard GitHub-flavored markdown
- Images in tables: `| ![alt](path) | ![alt](path) |`
- Keep each use case description under ~150 words in the details block

## Input Dependencies
- Task 2: screenshot spec (to know exact filenames for image references)

## Output Artifacts
- Updated `README.md` with Use Cases section

## Implementation Notes

<details>

**Structure for each use case:**

```markdown
### Reviewing AI Assistant Plans

Review **rendered markdown** plans from AI assistants and leave **inline feedback** on specific sections, then feed the structured review back to improve the plan.

<details>
<summary>Learn more</summary>

[2-3 paragraphs of detail]

| | |
|---|---|
| ![Plan diff view](docs/screenshots/uc1-plan-diff.png) | ![Rendered markdown](docs/screenshots/uc1-rendered.png) |
| ![Inline comment](docs/screenshots/uc1-inline-comment.png) | |

</details>
```

**UC1 — Reviewing AI Assistant Plans**: Reviewing plans is the critical **human-in-the-loop** step for AI assistant quality. Plans in the terminal are hard to review — by the time you reach the end, you've forgotten your feedback from the beginning. With self-review, you can **render the markdown** for readability and leave **in-context feedback** right where each section is. The structured XML output feeds directly back to the AI assistant.

**UC2 — Reviewing AI-Generated Code**: After an AI assistant generates code, you need to review the diff before accepting it. self-review gives you a **GitHub-style diff UI** locally with **inline comments and suggestions**. Benefits over pushing to GitHub first: (1) **faster iteration** — no push/wait/pull cycle, (2) **clean git history** — no "address review" commits on the remote, (3) **privacy** — unfinished code never leaves your machine, (4) **no wasted CI** minutes on intermediate pushes. The code that leaves your machine is code you **own intellectually** because you refined it.

**UC3 — Codebase Exploration**: Open any directory and annotate the code with **categorized comments**: questions, improvements, needs-documentation. Useful for onboarding to a new project — leave notes, tag unclear areas, and feed the XML to an LLM to create tickets, improve docs, or explain concepts. No awkward copy-pasting of file paths and line numbers.

**UC4 — AI-Assisted Review**: Have an AI assistant generate a review of changes using the `/self-review-critique` skill, then open the XML in self-review to **validate, edit, or discard** each comment. Add your own feedback on top. The final XML contains the curated review — AI-suggested minus what you removed, plus what you added — ready to feed back to the coding assistant.

</details>
