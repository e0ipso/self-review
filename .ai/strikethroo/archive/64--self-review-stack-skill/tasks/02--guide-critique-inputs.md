---
id: 2
group: "sibling-skills"
dependencies: []
status: "completed"
created: 2026-11-20
skills:
  - agent-skill-authoring
complexity_score: 4
---
# Add output-path and content-ref inputs to self-review-guide and self-review-critique

## Objective
Give both skills two optional inputs: an explicit output path and a content ref (read changed-file content with `git show <ref>:<path>` instead of the working tree). Without them, both skills behave exactly as at upstream `6b33509`.

## Skills Required
- `agent-skill-authoring`: editing harness-neutral `SKILL.md` procedures.

## Acceptance Criteria
- [x] `.agents/skills/self-review-guide/SKILL.md` documents two optional inputs with spellings `git diff` does not accept (proposed: `--guide-output <file>` and `--content-ref <ref>`), recognized and removed from the arguments before they are used as git diff args; step 2 uses `--guide-output` when given instead of deriving from `.self-review.yaml`; step 4 (and anywhere else file content is read) reads `git show <content-ref>:<path>` when given.
- [x] The guide's "URL source" recipe is restated as using the content-ref mechanism with `refs/self-review/head` (behavior identical to today).
- [x] `.agents/skills/self-review-critique/SKILL.md` documents `--review-output <file>` and `--content-ref <ref>`; with `--review-output` it writes `review.xml` there and passes `--guide-output <review path with last extension replaced by .guide.xml>` plus any `--content-ref` to the guide skill it invokes in step 1; file reads honor `--content-ref`.
- [x] Both skills state that `git-diff-args` in the written XML records the diff arguments only (the new inputs are never written into it).
- [x] `git diff 6b33509 -- .agents/skills/self-review-guide/SKILL.md .agents/skills/self-review-critique/SKILL.md` shows only additions/edits tied to the new inputs and the URL-source restatement; reading each hunk confirms the default procedure is unchanged.
- [x] `npm run test:unit --workspace @self-review/core` passes (the XSD sync and symlink tests in `xsd-schema.test.ts` still pass; no XSD is touched).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Only the two `SKILL.md` files change. No XSD, no code.
- `git diff` owns `--output`, so never use `--output` as a skill input name. Check any proposed name against `git diff -h` (or `git help diff`) to confirm git does not accept it.
- Keep the skills harness-neutral (Claude Code, Codex, OpenCode); match their existing voice and structure.

## Input Dependencies
None.

## Output Artifacts
- Documented inputs the stack skill (task 6) uses: guide `--guide-output`, `--content-ref`; critique `--review-output`, `--content-ref`. If you choose different spellings, record the final names in this task file's Implementation Notes before marking it complete, since task 6 depends on them.

## Implementation Notes

**Final input names (task 6 depends on these):** guide `--guide-output <file>` and
`--content-ref <ref>`; critique `--review-output <file>` and `--content-ref <ref>`. Both skills
accept `--name <value>` and `--name=<value>` anywhere before `--`. `git diff --guide-output=x`,
`--review-output=x` and `--content-ref=x` each exit 129 with "invalid option" (git 2.x in the dev
VM), so none can be mistaken for a git option.

**Test note:** documentation-only change to two `SKILL.md` files, so no test was written (nothing
executable changed; the existing `xsd-schema.test.ts` symlink and XSD sync checks are the guard).
`npx vitest run src/xsd-schema.test.ts` in `packages/core`: 31/31 pass. The full core suite showed
failures outside this task's files at the time of the run: `tsconfig-paths.test.ts` pins the list
of workspace tsconfigs and fails because the in-progress `packages/skill-scripts/` (task 3) adds
one, and `loaded-review-consistency.test.ts` fails a varying 2–3 timing-dependent descriptor-drift
cases from run to run. Neither reads the skill files.
<details>
<summary>Guidance</summary>

- Read both SKILL.md files completely first. Guide: step 1 Parse Arguments, step 2 Load Configuration (output path derivation), step 3 Get the Diff (incl. "URL source" recipe whose item 5 reads with `git -C <repo> show refs/self-review/head:<path>`), step 4 Understand the Change (uses the Read tool on the working tree). Critique: step 1 runs the guide, step 2 parses args, its config step reads `output-file`, and it reads files for context.
- In step 1 of each skill, add a short "Optional inputs" paragraph: the input names, that they may appear anywhere before `--`, that they are removed from `$ARGUMENTS` before the remaining arguments are treated as git diff args, and what each does. Keep it compact.
- Guide step 2: "If `--guide-output` was given, use it and skip the rest of this step's path derivation." Keep the existing derivation text otherwise intact.
- Guide step 4: "When `--content-ref` was given, read file content with `git show <ref>:<path>` instead of the working tree (the working tree is not the reviewed snapshot)." Do the same for any other place that reads files.
- URL-source recipe: replace item 5's standalone instruction with "read file content as with `--content-ref refs/self-review/head`" while keeping the `-C <repo>` and temporary-clone explanation.
- Critique: output-path step uses `--review-output` when given; step 1's guide invocation forwards `--guide-output <derived>` and `--content-ref`. Derivation of the guide path must match the guide skill's own rule (strip last extension, append `.guide.xml`).
- Do not reformat unrelated text; `.agents/` is outside Prettier.
- Commit: `feat(skills): add output-path and content-ref inputs to guide and critique`, no AI trailers.
</details>
