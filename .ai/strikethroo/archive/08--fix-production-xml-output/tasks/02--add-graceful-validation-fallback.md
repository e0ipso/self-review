---
id: 2
group: 'fix-production-xml-output'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - typescript
---

# Add Graceful Validation Fallback in xml-serializer

## Objective

Ensure XML is always emitted even when the validation infrastructure (WASM load) fails. Distinguish between "validation tool broken" (graceful fallback: log warning, return XML) and "XML is invalid" (hard error: exit 1).

## Skills Required

- **typescript**: Restructure `serializeReview()` logic in `xml-serializer.ts`

## Acceptance Criteria

- [ ] `buildXml()` produces XML string first; validation is attempted in a try/catch
- [ ] If `validateXML()` throws due to WASM loading failure (infrastructure error): log warning to stderr, return XML anyway
- [ ] If `validateXML()` executes and reports invalid XML: remains hard error (throw, propagate to exit 1)
- [ ] Only infrastructure failures trigger graceful fallback; schema validation failures do not

## Technical Requirements

- **File**: `src/main/xml-serializer.ts`
- Current flow: buildXml → validate → return. New flow: buildXml → try validate → on WASM/infrastructure throw: log warning, return xml; on invalid XML: throw
- Use `console.error()` for logging (stdout is sacred per AGENTS.md)

## Input Dependencies

None.

## Output Artifacts

- Updated `serializeReview()` that returns XML even when validation infrastructure fails

## Implementation Notes

<details>
<summary>Step-by-step instructions</summary>

1. **Current structure** (lines 239–267): `buildXml()` runs, then `validateXML()` in try/catch. Any error is rethrown.

2. **New structure**:
   - Call `buildXml(state)` first and store in `xml`.
   - In try block: call `validateXML()`. If `!validationResult.valid`, log errors and throw (same as now).
   - In catch: if the error is from WASM loading failure (e.g. `path`, `ENOENT`, or generic infrastructure error), log a warning like `console.error('XML validation skipped (xmllint-wasm load failed):', error.message)` and return `xml`. Do NOT rethrow.
   - If the error is from schema validation (invalid XML), rethrow — the caller will exit(1).

3. **Distinguish error types**: WASM load failures typically throw with messages about file not found, module load, or similar. Schema validation failures are explicitly thrown when `!validationResult.valid`. You can check for `validationResult.valid === false` in the try block before any catch; in catch, assume infrastructure failure and return xml with warning.

4. **Simpler approach**: In catch, always treat as infrastructure failure and return xml with warning. The only case we rethrow is when we explicitly throw in the try block (invalid XML). So: catch block = log warning, return xml.
</details>
