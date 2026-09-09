---
id: 2
group: "serve-mode-node-cli-package"
dependencies: [1]
status: "completed"
created: 2026-09-09
skills:
  - typescript
  - secure-coding
complexity_score: 6
complexity_notes: "Security-critical with several distinct edge cases (encoded traversal, whole-path encoding, bounds, unknown fields). Kept as one task because the validators and their tests are a single cohesive module; splitting would separate a check from the test that proves it."
execution_profile: "complex-architecture"
---
# Request validation and path containment

## Objective
Build the validation layer every route uses before calling into
`@self-review/core`: bounded types for numbers, containment for filesystem
paths, and rejection of unknown fields.

## Skills Required
`typescript` for the validators; `secure-coding` for the containment and
encoding rules.

## Acceptance Criteria
- [ ] A `containPath(root, candidate)` helper accepts the root itself, accepts paths strictly beneath it, and rejects `../` traversal, absolute paths outside the root, and symlink escapes.
- [ ] `containPath` performs no decoding of its own; callers pass an already-decoded value.
- [ ] A validator for the `expand-context` body accepts only an integer `contextLines` within documented bounds and a string `filePath`, and rejects a non-integer, an out-of-bounds value, a missing field, and any unknown field.
- [ ] Tests cover, and fail before the implementation exists: `../` traversal, the whole-path-encoded form `%2E%2E%2F`, a double-encoded `%252E%252E%252F`, a path equal to the root, a path beneath the root, a non-integer `contextLines`, an out-of-bounds `contextLines`, and an unknown extra field.
- [ ] `npm run test:unit --workspace @self-review/serve` exits 0 and reports the new test file.
- [ ] The root `test:unit` script gains ` && npm run test:unit --workspace @self-review/serve`, and `npm run test:unit` exits 0 from the repository root.
- [ ] The root `test:coverage` script gains the serve workspace with `--coverage.reportsDirectory=../../coverage/serve`, matching the per-package pattern already used for main, renderer and core.
- [ ] `grep -rn "child_process\|execSync\|execFile\|spawn" packages/serve/src` returns nothing.

## Technical Requirements
Filesystem paths reach the server as query parameters, so
`new URL(req.url, base).searchParams.get('path')` has already decoded them
exactly once. A containment check must not decode again: a second decode turns an
encoded traversal sequence inside a legitimate filename into a real one. This is
the plan's decode-once requirement and it is the reason paths are not URL path
segments.

Resolve both root and candidate to real paths before comparing, so a symlink
inside the repository cannot point outside it.

## Input Dependencies
Task 1's package skeleton and vitest configuration.

## Output Artifacts
A validation module and its tests, consumed by every route in task 3.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

Follow the RED → GREEN → REFACTOR cycle from `PRE_TASK_EXECUTION.md`. This task
is exactly the kind the test philosophy calls for: custom logic, security-
critical, with real edge cases. Write each failing test first and confirm it
fails for the expected reason before implementing.

1. `packages/serve/src/validate.ts`:
   - `containPath(root: string, candidate: string): string | null` — resolve `root` and `path.resolve(root, candidate)` with `fs.realpathSync` where the target exists, return the resolved path when it equals the root or starts with the root plus a separator, otherwise `null`. Never call `decodeURIComponent`.
   - `parseExpandContextBody(body: unknown)` — return a typed value or an error. Require `Number.isInteger(contextLines)` and a bound (the plan does not fix the upper bound; pick one, state it in a comment, and assert it in a test). Require `typeof filePath === 'string'`. Reject any key not in the allowed set.
2. `packages/serve/src/validate.test.ts` covering every case in the acceptance criteria. The encoded cases matter: assert that a *decoded* `../` is rejected, and that a literal `%2E%2E%2F` string passed in is treated as a filename rather than decoded into traversal.
3. Wire the workspace into the root scripts, now that it has a test to run. Task 1
   deliberately left this alone: an empty workspace in `test:unit` turns the root
   suite red, and both the pre-commit hook and CI run exactly that script. Read the
   current `test:coverage` value before editing — it uses a per-package reports
   directory so the runs do not overwrite each other. Edit the file textually
   rather than round-tripping it through a JSON serialiser, which will escape the
   non-ASCII character in the author's name.
4. Do not add a shell call of any kind. `packages/core` already reaches `git` through `execFileAsync('git', ['diff', ...args])` with a `--` separator before the file path, both from the fix for issue #145. This package adds no subprocess of its own; a new one would be a fresh instance of that bug reached over a socket.

The bound on `contextLines` is a judgement call the plan leaves open. Choose a
defensible number, comment why, and test the boundary. Do not leave it unbounded:
it reaches a `git` argument.
</details>
