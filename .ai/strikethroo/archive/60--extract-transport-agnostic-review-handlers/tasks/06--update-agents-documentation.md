---
id: 6
group: "documentation"
dependencies: [2, 4]
status: "completed"
created: 2026-09-02
skills:
  - technical-writing
complexity_score: 2
execution_profile: "docs-and-config"
---
# Record the new module boundary in AGENTS.md

## Objective

Update `AGENTS.md` so a future contributor knows the review handler bodies now
live in their own module and take an explicit session, and that a change to them
is therefore not confined to the desktop path. The plan's Documentation section
states this update is required.

## Skills Required

- `technical-writing` — matching the register and density of an existing
  contributor guide rather than appending a changelog entry to it.

## Acceptance Criteria

- [ ] The source tree listing in `AGENTS.md` (the block beginning at line 36)
      gains entries for `review-handlers.ts` and `startup-mode.ts`, placed in
      the existing order and with one-line descriptions in the same style and
      roughly the same width as their neighbours.
- [ ] The existing `ipc-handlers.ts` line is updated so it no longer implies the
      handler bodies live there.
- [ ] Somewhere a reader will actually meet it, the guide states that handler
      logic takes an explicit session and does not read module-scope state, so a
      new handler belongs in `review-handlers.ts` and only its registration
      belongs in `ipc-handlers.ts`. One or two sentences, not a section.
- [ ] No other content in `AGENTS.md` is reworded, reordered or reformatted.
      `git diff AGENTS.md` shows only the intended lines.
- [ ] No user-facing documentation and no README changes. Nothing observable to
      a user changed, and claiming otherwise in the README would be wrong.

## Technical Requirements

- The tree listing uses box-drawing characters and aligned `#` comments. Match
  the alignment of the surrounding lines exactly; a misaligned entry is the most
  visible possible defect in this file.
- Descriptions in that listing are short noun phrases, for example
  `# Executes git diff as child process`. Follow that form.

## Input Dependencies

- Task 2: `src/main/startup-mode.ts` exists.
- Task 4: `src/main/review-handlers.ts` is complete, so its description can
  describe what it actually contains rather than what was planned.

## Output Artifacts

- An updated `AGENTS.md`.

## Implementation Notes

Read the surrounding file before writing. `AGENTS.md` is a working contributor
guide with established conventions, including that the main process logs with
`console.error()` and never `console.log()`. The addition should read as though
it was always there.

Describe the boundary in terms of the rule it creates for the next contributor,
not in terms of this refactor. "Handler logic takes a session parameter and lives
in `review-handlers.ts`; `ipc-handlers.ts` holds registrations" is durable
guidance. "The handlers were extracted from `ipc-handlers.ts`" is a note about
one commit that stops being interesting the moment it merges.

Do not document the session type field by field. The type is the documentation
for its own shape, and a prose copy of it will go stale.
