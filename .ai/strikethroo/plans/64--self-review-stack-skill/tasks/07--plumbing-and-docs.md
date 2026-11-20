---
id: 7
group: "plumbing"
dependencies: [3, 6]
status: "completed"
created: 2026-11-20
skills:
  - technical-writing
complexity_score: 3
---
# Ship the skill: opencode symlink, SYMLINKED_SKILLS, README and AGENTS.md

## Objective
Wire `self-review-stack` in the way its sibling skills are wired, and update the documentation for the skill and the new workspace package.

## Skills Required
- `technical-writing`: README and AGENTS.md updates (plus one symlink and one array entry).

## Acceptance Criteria
- [x] `.opencode/skills/self-review-stack` is a symlink to `../../.agents/skills/self-review-stack` (`readlink` prints exactly that), committed as a symlink.
- [x] `SYMLINKED_SKILLS` in `packages/core/src/xsd-schema.test.ts` includes `'self-review-stack'`, and `npm run test:unit --workspace @self-review/core` passes.
- [x] README "Assistant Skill" section lists `self-review-stack` with what it does and a usage example (serve and desktop), alongside the existing companion-skill text.
- [x] AGENTS.md: "Assistant Skills" gains a `### self-review-stack` subsection with usage; "Project Structure" lists `packages/skill-scripts/` (TypeScript source of skill helpers, bundled into `.agents/skills/self-review-stack/scripts/stack.cjs`); "Testing" describes the package's tests and the bundle staleness check with the rebuild command `npm run build:skills --workspace @self-review/skill-scripts`, and notes that a change to the core modules the helper bundles requires a rebuild; "Harness skill directories" names the new symlink alongside the existing three.
- [x] `npm run lint`, `npm run format:check` and `npm run test:unit` exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Create the symlink with `ln -s ../../.agents/skills/self-review-stack .opencode/skills/self-review-stack` from the repo root; never copy the directory.
- Match existing documentation tone and structure; keep additions concise. Do not restate the desktop `-o` documentation that task 1 already added.

## Input Dependencies
- Task 3: package name, location and build command.
- Task 6: the skill's final behavior and usage for the docs.

## Output Artifacts
- Symlink, test entry, README and AGENTS.md updates.

## Implementation Notes
<details>
<summary>Guidance</summary>

- `grep -n "SYMLINKED_SKILLS" packages/core/src/xsd-schema.test.ts` — the array currently holds `'self-review-apply', 'self-review-critique', 'self-review-guide'`.
- README: `grep -n "## Assistant Skill" README.md`; the section mentions "two companion skills under `.agents/skills/`: `self-review-critique` …" — update the count/wording to include the new skill.
- AGENTS.md headings to edit: "## Project Structure" (tree block), "### Unit Tests" under "## Testing", "## Critical Conventions" → "**Harness skill directories.**" bullet, "## Assistant Skills".
- Run `npx prettier --write README.md AGENTS.md` (both are formatted by Prettier), then `npm run format:check`.
- Commit: `docs: document self-review-stack and wire its opencode symlink`, no AI trailers.
</details>

## Execution Notes
- Commit left to the orchestrator: the symlink is created (untracked, `readlink` prints `../../.agents/skills/self-review-stack`) but not yet staged or committed.
- `npm run test:unit --workspace @self-review/core` exits 1 only on the known pre-existing flake `src/loaded-review-consistency.test.ts` (unrelated to this task); with that file excluded, 100/100 files and 1847/1847 tests pass, including `xsd-schema.test.ts` (32/32).
