---
id: 3
group: "xml-semantics"
dependencies: [2]
status: "completed"
created: 2026-10-01
skills:
  - xml
  - typescript
complexity_score: 7
complexity_notes: "Encoder and decoder must change together under a byte-exact contract, plus semantic anchor validation and error-policy changes that ripple to callers."
execution_profile: "complex-architecture"
---
# Make review XML lossless, validate imported anchors, and stop exiting from library code (R03)

## Objective
Review XML roundtrips text byte-for-byte (numeric-looking strings, `false`/`0`, entity-looking literals, CR/LF/CRLF/tab in text and path attributes); resume import validates anchors semantically and visibly downgrades unverifiable ones instead of poisoning the final save; XML-illegal characters produce an actionable structured error; core XML functions throw typed errors instead of calling `process.exit`. Provide the shared anchor validator that Apply (task 11) reuses.

## Skills Required
XML parsing/serialization semantics (fast-xml-parser, XSD/xmllint) and TypeScript library design.

## Acceptance Criteria
- [x] `parseTagValue`/attribute value coercion is disabled; body `00123`, category `007`, reply `1e3`, original code `0`, proposed code `false` and empty strings survive save→parse unchanged (no `||` falsy fallbacks).
- [x] One bounded, single-pass encode/decode contract: the serializer emits CR, LF (in attributes) and TAB (in attributes) as numeric character references; the parser decodes exactly the five predefined entities plus decimal/hex numeric references in one pass, so literal text such as `&amp;#13;`, `&#13;` typed by a user, or `&lt;` survives a roundtrip exactly and nothing is decoded twice. Full HTML entity decoding is NOT enabled.
- [x] Output still validates against `self-review-v3.xsd` with xmllint, and a conformant parser (`xmllint --noout` plus a check with Python `xml.etree` or `xmllint --xpath`) recovers the same bytes for CRLF / lone CR / tab text and quote/backslash/newline filenames.
- [x] New `packages/core/src/anchor-validation.ts` exports a pure validator for line ranges (positive safe integers, start ≤ end, exactly one of old/new side, optional upper bound) used by the resume import here and by Apply in task 11.
- [x] Resume import rejects NaN/zero/negative/fractional/reversed/both-sided ranges and unsupported suggestion shapes: such comments are downgraded to file-level, non-actionable feedback (the suggestion's original/proposed text preserved in the body as fenced code, not as an actionable `Suggestion`), and a diagnostic is surfaced: written to stderr by hosts and carried in `ResumeLoadPayload` (new optional `importDiagnostics: string[]` in `@self-review/types`) and rendered by the React package as a non-blocking warning alongside the existing drift warning.
- [x] The serializer detects XML-illegal characters (C0 controls other than TAB/LF/CR, U+FFFE/U+FFFF, lone surrogates) in any text or attribute and throws a typed error identifying the comment/reply and field; it never strips them silently.
- [x] `xml-parser.ts` contains no `process.exit`; parse/validation failures throw a typed `ReviewXmlError` (with `.code` and human-readable message, never `[object Object]`). All callers (`src/main`, `packages/serve`, `packages/core` startup/fetch-comments) handle the error and keep their current user-visible behavior (stderr message + host decides exit). Schema diagnostics are formatted as readable strings.
- [x] Regression tests in `packages/core/src/xml-*.test.ts` cover every case above; `npm run test:unit` and `npm run typecheck:packages` pass. XSD files untouched unless an attribute change is unavoidable (if so, both copies stay byte-identical and `xsd-schema.test.ts` passes).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/xml-parser.ts`, `packages/core/src/xml-serializer.ts`, new `packages/core/src/anchor-validation.ts`, `packages/core/src/index.ts` exports, `packages/types/src/index.ts` (`ResumeLoadPayload.importDiagnostics`, error code types if needed), callers of the parser (`grep -rn "parseReviewXml\|xml-parser" src packages --include=*.ts`), React drift-warning component for diagnostics display.
- Use fast-xml-parser options `parseTagValue: false`, `parseAttributeValue: false`, `processEntities: false` (and decode yourself) or an equivalent configuration proven by tests not to double decode.

## Input Dependencies
Task 2 (fast-xml-parser upgraded).

## Output Artifacts
- `anchor-validation.ts` validator (consumed by task 11).
- Typed `ReviewXmlError` and XML-illegal-character error (consumed by task 10 publisher and tasks 14/15 hosts).
- `importDiagnostics` on `ResumeLoadPayload`.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R03 and R18, and the probe `docs/codebase-audit-2026-10-01/core-probes.cjs` (XML section) to reproduce failures first (RED).
2. Parser locations from the audit: `xml-parser.ts:47,52–57,130,187–220`; serializer `xml-serializer.ts:754–768,991–998`. The guide parser already disables coercion — mirror its option style.
3. Why both sides must change: XML parsers normalize raw CRLF/CR to LF (spec §2.11) and attribute whitespace to spaces (§3.3.3). The only lossless representation is character references. fast-xml-parser leaves `&#13;` literal unless entity processing is configured; enabling `htmlEntities` decodes far more than needed and decodes `&amp;#13;` into a CR (double decode). Implement a single regex pass over raw text: `/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g` → mapped character; reject/leave invalid code points. Disable the library's own entity processing so there is exactly one decoding.
4. Serializer: escape `&<>"'` as today, plus `\r` → `&#13;` everywhere, `\n`/`\t` → `&#10;`/`&#9;` in attributes. Check CDATA usage if any — CDATA cannot carry `\r` losslessly either; prefer escaped text.
5. Illegal characters: XML 1.0 Char = `#x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]`. Throw `XmlIllegalCharacterError` (`code: 'xml-illegal-character'`, `commentId`, `field`, `codePoint`).
6. Downgrade policy for invalid anchors: keep comment id/body/category/author/replies/severity/confidence; clear line fields; if it had a suggestion append to body:
   ```
   _Imported suggestion could not be anchored (reason)._
   Original:
   ```(fence)...
   ```
   and push a diagnostic `"<file>: comment <id> anchor <reason>; kept as file-level feedback"`.
7. Validator API suggestion:
   ```ts
   export type AnchorSide = 'old' | 'new';
   export interface LineAnchor { side: AnchorSide; start: number; end: number }
   export type AnchorCheck = { ok: true; anchor: LineAnchor } | { ok: false; reason: string };
   export function validateLineAnchor(c: { oldLineStart?: unknown; oldLineEnd?: unknown; newLineStart?: unknown; newLineEnd?: unknown }, maxLine?: number): AnchorCheck | null /* null = file-level */;
   ```
8. `process.exit` removal: find all callers; in Electron `src/main/main.ts` keep the stderr+exit at the host level (host decides). Serve `startup.ts` likewise. Update tests that expected exit.
9. React diagnostics display: find where `remoteDrift` warning renders (`grep -rn remoteDrift packages/react/src`) and add a sibling non-blocking list. Keep shadcn components.
10. Other tasks run concurrently (task 8 edits `RenderedMarkdownView.tsx`; task 9 edits `FileSection.tsx`/`DiffViewer.tsx`). Re-read before edits, keep edits minimal there, never revert others' work or the unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (save→parse roundtrips with real xmllint validation). Test custom logic and edge cases; do not test fast-xml-parser itself. Combine scenarios into table-driven tests.
</details>
