---
id: 5
group: "verification"
dependencies: [3, 4]
status: "completed"
created: 2026-09-02
skills:
  - vitest
  - typescript
complexity_score: 5
execution_profile: "standard-implementation"
---
# Unit test the extracted handlers, including session isolation

## Objective

Write `src/main/review-handlers.test.ts` exercising the extracted functions
directly against constructed sessions. This is Component 4 of the plan and the
evidence that the extraction is real: the session-isolation test is one that
could not be written before, because module-scope state made two independent
sessions inexpressible.

## Skills Required

- `vitest` — the repository's unit test runner, configured for the main process
  by `vitest.config.main.ts`.
- `typescript` — constructing valid session and payload fixtures against the
  shared types.

## Acceptance Criteria

- [ ] `src/main/review-handlers.test.ts` exists and runs under
      `npx vitest run --config vitest.config.main.ts`.
- [ ] Coverage includes the handlers' principal success paths: a diff payload is
      returned for a populated session; a file's hunks are returned by path and
      `null` for an unknown path; config and output path info come back together;
      a submitted review state is stored and can be taken exactly once.
- [ ] A test covers the diff and its guide being returned together, and a
      separate one covers a session with a diff and no guide returning only the
      diff.
- [ ] **A test asserts two sessions are isolated**: state written to session A is
      not observable through session B. This test is required and is the one the
      plan singles out.
- [ ] The whole file passes, and no existing test is modified to accommodate it.
- [ ] Per Self Validation step 7, the isolation test is shown to constrain the
      design: temporarily make the two sessions share state, confirm the test
      fails, then revert. Record the observed failure message in the task report.
      A test that passes either way proves nothing.

## Technical Requirements

- Config: `vitest.config.main.ts`, which includes `src/main/**/*.test.ts`, runs
  in the `node` environment with `globals: false`, so import `describe`, `it`,
  `expect` and `vi` from `vitest` explicitly.
- `src/main/ipc-handlers.test.ts` is the local precedent for mocking `electron`
  with `vi.mock` and for building `DiffFile` / `DiffHunk` fixtures. Reuse its
  shapes rather than inventing new ones.
- The extracted functions should not need Electron mocked at all. If a test of
  `review-handlers.ts` needs `vi.mock('electron', ...)`, that is a finding:
  something Electron-shaped is still in the module. Report it rather than
  mocking around it.
- Some functions dynamically `import('./git')` and `import('./diff-parser')`.
  `ipc-handlers.test.ts` already mocks these; follow its approach.

## Input Dependencies

- Tasks 3 and 4: the extracted functions and the session factory.

## Output Artifacts

- `src/main/review-handlers.test.ts`.

## Implementation Notes

Follow the repository's test philosophy: **write a few tests, mostly
integration.**

Meaningful tests verify custom business logic, critical paths, and edge cases
specific to this application. Test *your* code, not the framework or library.

**When TO write tests:** custom business logic and algorithms; critical user
workflows and data transformations; edge cases and error conditions for core
functionality; integration points between components; complex validation logic
or calculations.

**When NOT to write tests:** third-party library functionality; framework
features; simple CRUD operations without custom logic; trivial getters/setters
or static configuration; obvious functionality that would break immediately if
incorrect.

Combine related scenarios into a single test rather than one per method. Favour
integration and critical-path coverage over per-method unit tests. Do not write
a test per extracted function as a matter of course; write the ones that would
catch a real mistake.

<details>
<summary>What the isolation test needs to look like</summary>

Construct two sessions from the factory. Put a diff payload on the first. Assert
that reading the diff through the second returns nothing. Then reverse it: put
different state on the second and confirm the first is unaffected. Both
directions matter, because a shared default object would pass a one-directional
check.

Extend the same idea to at least one mutating handler. Expanding context on
session A writes back to A's diff data; assert that B's is untouched. That
covers the write path, which the read-only assertion does not.

To satisfy the "prove the test constrains the design" criterion, the cheapest
demonstration is to point both variables at the same session object and confirm
the assertions fail. Record the failure output, then restore the two-session
version. Do not leave the deliberately-broken variant behind, and do not commit
it.

</details>
