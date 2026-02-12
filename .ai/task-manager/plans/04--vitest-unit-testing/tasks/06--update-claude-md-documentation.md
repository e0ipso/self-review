---
id: 6
group: "documentation"
dependencies: [1, 2, 3, 4, 5]
status: "pending"
created: "2026-02-12"
skills:
  - documentation
---
# Update CLAUDE.md with Testing Documentation

## Objective

Document the testing architecture, conventions, and commands in CLAUDE.md. This establishes clear patterns for future development and ensures all developers understand the two-layer testing strategy (unit + e2e).

## Skills Required

- **documentation**: Write clear, structured documentation following existing CLAUDE.md conventions

## Acceptance Criteria

- [ ] New "## Testing" section added to CLAUDE.md after "## Shared Types"
- [ ] Documentation covers two-layer testing strategy (unit tests with Vitest + e2e tests with Playwright)
- [ ] npm scripts for running tests are documented
- [ ] Test file location convention (colocated) is documented
- [ ] Dev container compatibility notes are included
- [ ] Coverage targets and reporting are explained
- [ ] Testing conventions and best practices are listed
- [ ] Documentation follows the existing CLAUDE.md style and tone

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

### Location

Add the new section after line 94 in CLAUDE.md, immediately after the "## Shared Types" section.

### Content to Add

The documentation should cover:

1. **Overview**: Two testing layers (unit + e2e)
2. **Unit Tests**: Vitest with separate main/renderer configs
3. **Test Organization**: Colocated test files
4. **Running Tests**: npm scripts with examples
5. **Dev Container Notes**: Unit tests work in container, e2e tests don't
6. **Coverage**: Target and reporting
7. **E2E Tests**: Brief reminder about Playwright + Cucumber
8. **Testing Conventions**: Guidelines for writing tests

### Style Guidelines

- Use the same heading style as existing sections (##, ###, ####)
- Use **bold** for emphasis on important terms
- Use code blocks for commands and examples
- Use bullet points for lists
- Keep tone concise and direct (match existing CLAUDE.md)
- Use present tense and imperative mood

## Input Dependencies

- Tasks 1-5: Testing infrastructure and tests should be complete to document accurately
- Existing `CLAUDE.md` file for context and style matching

## Output Artifacts

- Updated `CLAUDE.md` with comprehensive testing section
- Clear guidance for future developers on testing practices

## Implementation Notes

<details>
<summary>Documentation Content</summary>

### Section to Add

Insert this section after "## Shared Types" (around line 94):

```markdown
## Testing

The app has two testing layers:

1. **Unit tests** (Vitest) — Fast, isolated tests for business logic and state management
2. **E2E tests** (Playwright + Cucumber) — Slow, comprehensive tests for user workflows

### Unit Tests

Unit tests use Vitest with separate configurations for main and renderer processes:

- **Main process tests** (`src/main/**/*.test.ts`): Test Node.js modules (diff parsing, XML serialization, git operations). Run in Node.js environment.
- **Renderer tests** (`src/renderer/**/*.test.{ts,tsx}`): Test React hooks and utilities. Run in jsdom environment.

**Test file location**: Colocate test files with source files (e.g., `diff-parser.test.ts` next to `diff-parser.ts`).

**Running tests**:
```bash
npm run test:unit              # Run all unit tests in watch mode
npm run test:unit:run          # Run all unit tests once
npm run test:unit:main         # Run only main process tests
npm run test:unit:renderer     # Run only renderer tests
npm run test:coverage          # Run tests with coverage report
```

**Dev Container**: Unit tests work in both the dev container and host machine (unlike e2e tests).

**Coverage target**: ~50-60% coverage on business logic. Coverage is collected but thresholds are not enforced.

### E2E Tests

E2E tests use Playwright with Cucumber BDD:
- **Cannot run in dev container** — requires host machine with display
- Test complete user workflows from CLI invocation to XML output
- Run with `npm run test:e2e` (headless) or `npm run test:e2e:headed`

### Testing Conventions

- Test pure functions and business logic, not implementation details
- Use descriptive test names: `it('parses file addition with single hunk', ...)`
- Group related tests with `describe` blocks
- Mock external dependencies (filesystem, child processes, network)
- For hooks: test state transitions and data integrity
- For parsers: use fixture strings of real input samples
```

### Integration with Existing Content

**Before** (line 89-94):
```markdown
## Shared Types

`src/shared/types.ts` is the single source of truth for all data structures. Every file in both main and renderer imports types from here. **Never duplicate type definitions.**

Key types: `DiffFile`, `DiffHunk`, `DiffLine`, `ReviewComment`, `Suggestion`, `ReviewState`, `AppConfig`, `CategoryDef`.

See the file itself for full definitions.

## Critical Conventions
```

**After** (insert new section between "Shared Types" and "Critical Conventions"):
```markdown
## Shared Types

`src/shared/types.ts` is the single source of truth for all data structures. Every file in both main and renderer imports types from here. **Never duplicate type definitions.**

Key types: `DiffFile`, `DiffHunk`, `DiffLine`, `ReviewComment`, `Suggestion`, `ReviewState`, `AppConfig`, `CategoryDef`.

See the file itself for full definitions.

## Testing

[NEW CONTENT HERE]

## Critical Conventions
```

### Verification

After adding the documentation:
1. Read through CLAUDE.md to ensure the new section flows naturally
2. Verify all commands are correct (test them if needed)
3. Check that the style matches existing sections (headings, formatting, tone)
4. Ensure no duplicate or contradictory information
5. Verify coverage targets match the plan (50-60%)

### Tips

1. **Be Concise**: Match the brevity of existing CLAUDE.md sections
2. **Be Directive**: Use imperative statements ("Test pure functions", not "You should test pure functions")
3. **Provide Examples**: Include actual commands developers will run
4. **Highlight Differences**: Make it clear unit tests work in dev container but e2e tests don't
5. **Link Concepts**: Connect unit tests to existing e2e tests to show they complement each other

</details>
