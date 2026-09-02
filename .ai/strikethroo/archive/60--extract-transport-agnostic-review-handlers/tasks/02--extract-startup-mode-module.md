---
id: 2
group: "extraction"
dependencies: []
status: "completed"
created: 2026-09-02
skills:
  - typescript
complexity_score: 2
execution_profile: "standard-implementation"
---
# Move determineMode into its own startup-mode module

## Objective

Move `determineMode` out of the application entry point into
`src/main/startup-mode.ts`, unchanged in behaviour, and have the entry point
import it. This makes the decision of what to review reachable without going
through the desktop entry point (Component 3 of the plan).

## Skills Required

- `typescript` — a single-function move across module boundaries, preserving
  behaviour exactly.

## Acceptance Criteria

- [ ] `src/main/startup-mode.ts` exists and exports `determineMode` with an
      unchanged signature: `(gitDiffArgs: string[]) => 'git' | 'directory' | 'file' | 'welcome'`.
- [ ] `src/main/main.ts` no longer declares `determineMode` and imports it from
      `./startup-mode` instead. Its one call site is otherwise untouched.
- [ ] The function body is byte-identical to the original apart from import
      rewrites. Verify with
      `git diff --find-renames -M10% src/main/main.ts src/main/startup-mode.ts`
      and read the result: nothing but the move and its imports should appear.
- [ ] `npm run lint` exits 0 (pre-existing warnings in `.agents/skills/**` are
      acceptable; there must be no new errors).
- [ ] `npx vitest run --config vitest.config.main.ts` passes: 125 tests at the
      time of writing, and no fewer after.
- [ ] No mutable state is declared at module scope in the new file.

## Technical Requirements

- `determineMode` currently begins at `src/main/main.ts:173` and is called once,
  at `src/main/main.ts:258`, as `cliArgs.remoteUrl ? 'remote' : determineMode(gitDiffArgs)`.
- Its dependencies are `resolve` from `path`, `existsSync` and `statSync` from
  `fs`, and `isInGitRepo` / `isGitTracked`. Move exactly the imports it needs
  and remove any that `main.ts` no longer uses.
- It reads `process.cwd()`. Keep that as-is. Making the working directory a
  parameter would be a behaviour change and belongs to a later plan, not this one.

## Input Dependencies

None. This task touches different files from tasks 3 and 4 and can run alongside
them.

## Output Artifacts

- `src/main/startup-mode.ts`
- A `src/main/main.ts` that imports it.

## Implementation Notes

<details>
<summary>Step by step</summary>

1. Read the whole function first:

   ```bash
   sed -n '173,215p' src/main/main.ts
   ```

   Find its exact end by reading until the closing brace at column 0.

2. Create `src/main/startup-mode.ts`. Give it a short header comment saying what
   it is for, in the style of the other modules in `src/main/` (they open with a
   `// src/main/<name>.ts` line and a one-line purpose). Export the function.

3. Delete the function from `main.ts` and add `import { determineMode } from './startup-mode';`
   alongside the existing relative imports.

4. Remove now-unused imports from `main.ts`. `npm run lint` will tell you which:
   the repository's eslint config reports unused imports as errors. Do not
   remove an import that another part of `main.ts` still uses; check with grep
   before deleting each one.

5. Do not reformat, rename, add JSDoc, or "improve" the function while moving it.
   The plan states the intent is a move, and a reviewer will read it as one. If
   you believe something in it is wrong, leave it and note it; a behaviour change
   smuggled into a move is the specific failure this plan is structured to avoid.

</details>
