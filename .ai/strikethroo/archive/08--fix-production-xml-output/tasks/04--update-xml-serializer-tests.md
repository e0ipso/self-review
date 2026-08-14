---
id: 4
group: 'fix-production-xml-output'
dependencies: [1, 2, 3]
status: 'completed'
created: '2026-02-12'
skills:
  - vitest
  - typescript
---

# Update xml-serializer Unit Tests

## Objective

Ensure unit tests cover the new behavior: either run without mocking `xmllint-wasm` (if WASM loads in test env), or add tests for the graceful fallback path when validation infrastructure fails.

## Skills Required

- **vitest**: Update test structure and assertions
- **typescript**: Test fixtures and mocking

## Acceptance Criteria

- [ ] Unit tests pass: `npm run test:unit:main` succeeds
- [ ] Graceful fallback is tested: when `validateXML` throws (e.g. WASM load failure), XML is still returned and no error is thrown
- [ ] Invalid XML path remains tested: when validation returns `valid: false`, error is thrown
- [ ] Optionally remove or relax the `xmllint-wasm` mock if WASM loads in tests; otherwise keep mock and add tests for infrastructure-failure path

## Technical Requirements

- **File**: `src/main/xml-serializer.test.ts`
- **Meaningful Test Strategy**: Focus on business logic (graceful fallback vs hard error), not framework functionality

## Input Dependencies

- Task 1 (WASM location): Optional — if WASM loads after fix, tests can run without mock
- Task 2 (Graceful fallback): Required — tests must verify behavior

## Output Artifacts

- Updated unit tests that pass and cover the new behavior

## Implementation Notes

<details>
<summary>Step-by-step instructions</summary>

### Meaningful Test Strategy Guidelines

**When TO Write Tests:**
- Custom business logic: graceful fallback when validation infrastructure fails
- Critical path: XML is returned even when validateXML throws

**When NOT to Write Tests:**
- Third-party xmllint-wasm internals
- Simple getters/setters

### Implementation

1. **Add graceful fallback test**: Mock `validateXML` to throw (simulating WASM load failure):
   ```ts
   vi.mocked(validateXML).mockRejectedValueOnce(new Error('WASM load failed'));
   const xml = await serializeReview(reviewState);
   expect(xml).toContain('<?xml version="1.0"');
   expect(xml).toContain('</review>');
   // Should not throw
   ```

2. **Keep invalid XML test**: Mock `validateXML` to return `{ valid: false, errors: ['...'] }`, ensure `serializeReview` throws.

3. **Existing tests**: Keep or adjust the mock. If `validateXML` is mocked to resolve `{ valid: true }`, existing tests should still pass. Add one new test for the rejection path.

4. **Optional**: Try removing the mock entirely and running tests — if WASM loads in Node (test env), tests may pass. If not, the mock + new graceful-fallback test is sufficient.
</details>
