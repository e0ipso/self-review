---
id: 6
group: "serve-mode"
dependencies: [3, 4]
status: "pending"
created: 2026-08-28
skills:
  - vitest
  - typescript
complexity_score: 4
execution_profile: "standard-implementation"
---
# Unit test the serve-mode routes and the HTTP adapter

## Objective
Cover the logic that is genuinely this application's own: route behaviour that is not
a thin pass-through, and the adapter's contract with the `ReviewAdapter` interface.

## Skills Required
`vitest`, already the project's unit runner, and `typescript`.

## Acceptance Criteria
- [ ] Route tests cover the diff response carrying the guide in one body, the binary attachment response, and the review-submission path writing the file.
- [ ] Adapter tests cover `readAttachment` returning an `ArrayBuffer`, `onGuideLoad` invoking its callback and returning a working unsubscribe, and `changeOutputPath` being absent.
- [ ] Tests assert observable behaviour, not internal call counts of the standard library.
- [ ] No test exercises `node:http` itself, React rendering, or other framework behaviour.
- [ ] Runnable: `npm run test:unit` passes and includes the new files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Vitest, configured by `vitest.config.main.ts` and `vitest.config.renderer.ts`. Follow
whichever configuration matches each file's environment.

## Input Dependencies
Task 3's routes and task 4's adapter.

## Output Artifacts
Unit coverage of the serve-mode logic that is not covered end to end by task 7.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

**Test philosophy — "write a few tests, mostly integration".**

Meaningful tests verify custom business logic, critical paths, and edge cases
specific to this application. Test *your* code, not the framework or library.

When TO write tests: custom business logic and algorithms; critical user
workflows and data transformations; edge cases and error conditions for core
functionality; integration points between components; complex validation logic.

When NOT to write tests: third-party library functionality; framework features;
simple CRUD without custom logic; trivial getters/setters or static
configuration; obvious functionality that would break immediately if incorrect.

Combine related scenarios into one test rather than one test per method. Favor
integration and critical-path coverage over per-method unit tests.

Applied here, that means a small number of tests aimed at the things that would plausibly break and
would not be caught immediately:

- The diff route returning the guide in the same body. This is a deliberate design decision that a
  future change could silently undo, and nothing else asserts it.
- The attachment route returning bytes rather than JSON or base64. Encoding mistakes here are easy
  to make and produce corrupt files rather than obvious errors.
- Review submission writing the file. The write is the entire point of the tool.
- The adapter's three interface-contract behaviours listed in the acceptance criteria, particularly
  the unsubscribe function, which the interface documents as required and which is easy to return
  as `undefined` by accident.

Do NOT write a test per route. Most routes are thin wrappers over task 1's module; testing them
tests the standard library and the wrapper syntax. Do not test that Vite builds, that React renders,
or that `node:http` serves static files.

</details>
