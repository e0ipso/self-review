---
id: 3
group: "rendered-html-support"
dependencies: [1, 2]
status: "completed"
created: 2026-05-13
skills:
  - unit-testing
  - e2e-testing
complexity_score: 4.6
complexity_notes: "Moderate complexity because validation spans renderer unit coverage and existing feature-level review workflows, but remains focused on rendered-text behavior."
---
# Validate Rendered HTML Review Behavior

## Objective
Add focused automated coverage and fixtures proving that added HTML files can be reviewed in rendered mode with the same comment workflow as Markdown, while existing Markdown/image/SVG preview behavior remains intact.

## Skills Required
This task requires unit-testing and e2e-testing skills because it updates fast renderer tests and the existing feature scenarios/fixtures used for review workflows.

## Acceptance Criteria
- [ ] Renderer unit tests cover HTML rendered-text eligibility and dispatch mode.
- [ ] Tests verify Markdown rendered behavior still uses the Markdown mode/path.
- [ ] Tests verify image and SVG preview eligibility/default behavior is unaffected.
- [ ] An added HTML fixture includes multiple block elements on separate source lines.
- [ ] Existing feature specs or equivalent e2e coverage describe switching an added HTML file to Rendered view and creating gutter comments on multiple ranges.
- [ ] Saved comments from rendered HTML interactions target expected `newLineStart`/`newLineEnd` ranges.
- [ ] Markdown rendered commenting is covered as a regression path.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use the repository's existing Vitest renderer setup and existing `test/features` or equivalent e2e harness. Do not run Electron e2e tests inside the dev container. Webapp e2e scenarios may be authored or run according to the existing project constraints.

## Input Dependencies
Tasks 1 and 2 must be complete so tests can target the final helper names, component props, and rendered behavior.

## Output Artifacts
- Updated or new renderer unit tests.
- Updated HTML review fixture data.
- Updated `test/features` scenarios or equivalent feature-level specs for rendered HTML comments.
- Test execution notes identifying which test commands were run and which were skipped due to environment limits.

## Implementation Notes
<details>
<summary>Meaningful Test Strategy Guidelines</summary>

Your critical mantra for test generation is: "write a few tests, mostly integration".

Definition of "Meaningful Tests":
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

When TO Write Tests:
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality
- Integration points between different system components
- Complex validation logic or calculations

When NOT to Write Tests:
- Third-party library functionality (already tested upstream)
- Framework features (React hooks, Express middleware, etc.)
- Simple CRUD operations without custom logic
- Getter/setter methods or basic property access
- Configuration files or static data
- Obvious functionality that would break immediately if incorrect

Test Task Creation Rules:
- Combine related test scenarios into single tasks (e.g., "Test user authentication flow" not separate tasks for login, logout, validation)
- Focus on integration and critical path testing over unit test coverage
- Avoid creating separate tasks for testing each CRUD operation individually
- Question whether simple functions need dedicated test tasks
</details>

<details>
<summary>Detailed implementation guidance</summary>

1. Search for existing tests around `RenderedMarkdownView`, `FileSection`, `DiffContentArea`, file-type utilities, preview mode defaults, and rendered Markdown comments. Extend nearby tests rather than creating duplicate suites.
2. Add unit coverage at the lowest useful level:
   - file-type helper returns Markdown, HTML, or null modes correctly;
   - `FileSection`/dispatch logic treats added HTML as rendered-text previewable;
   - image and SVG cases still follow their existing branches.
3. Add rendered-comment coverage at a component or workflow level if existing tests can mount the rendered view:
   - use an added HTML fixture with at least two block elements on distinct added lines, such as headings, paragraphs, and lists;
   - open/render the HTML mode;
   - trigger gutter comment creation;
   - assert stored comments use `newLineStart`/`newLineEnd` only.
4. Update `test/features` or the existing feature spec location to include a rendered HTML review scenario. Follow current naming and fixture conventions.
5. Include a Markdown regression scenario only as far as needed to prove the shared path still works. Do not duplicate the full Markdown test matrix.
6. Include image/SVG validation through existing tests where possible. A small assertion that their preview modes still dispatch to existing branches is sufficient.
7. Run `npm run test:unit:renderer` if feasible. Do not run Electron e2e inside the dev container. If webapp e2e tests are feasible in the environment, run the narrowest relevant command; otherwise document the skip reason.
</details>
