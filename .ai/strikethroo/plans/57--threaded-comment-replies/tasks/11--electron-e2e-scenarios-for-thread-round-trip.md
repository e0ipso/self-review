---
id: 11
group: "e2e-coverage"
dependencies: [3, 4, 7]
status: "pending"
created: 2026-07-31
skills:
  - playwright
  - cucumber
complexity_score: 5
complexity_notes: "Spans two feature files and the shared fixture generator; the v2-in/v3-out round-trip assertion is the only e2e proof that the namespace bump does not break resume."
execution_profile: "standard-implementation"
---
# Electron e2e scenarios for thread round-trip

## Objective

Retarget the electron e2e suite at v3, and add scenarios covering reply serialization in
`07-xml-output.feature` and the v2-in / v3-out resume round-trip plus reply loading in
`08-resume.feature`.

## Skills Required

Playwright + Cucumber against the packaged Electron app; XML assertions in step definitions.

## Acceptance Criteria

- [ ] `tests/features/07-xml-output.feature:22` asserts namespace `urn:self-review:v3`, and `:80`
      validates against `.agents/skills/self-review-apply/assets/self-review-v3.xsd`.
- [ ] `07-xml-output.feature` gains a scenario that adds a comment, replies to it twice, finishes the
      review, and asserts the written XML contains two `<reply>` elements **inside** that
      `<comment>`, in the order they were entered, and that the document validates against the v3
      XSD.
- [ ] `tests/fixtures/test-repo.ts` keeps emitting `urn:self-review:v2` for prior-review fixtures —
      that is what makes the resume scenarios prove backwards compatibility. Do **not** bump it.
- [ ] The fixture generator gains the ability to emit `<reply>` children on a prior-review comment,
      so a resume scenario can load a thread.
- [ ] `08-resume.feature` gains a scenario: load a `urn:self-review:v2` prior review, confirm its
      comments appear, click Finish Review, and assert the written document declares
      `urn:self-review:v3` — the silent-upgrade behaviour, asserted rather than assumed.
- [ ] `08-resume.feature` gains a scenario: load a prior review whose comment carries three replies
      (mixed authored and unauthored), confirm all three render beneath the comment **in document
      order** with the authored ones showing their model name and the unauthored one showing "You",
      then Finish Review and confirm the three replies survive the round-trip in the same order.
- [ ] Every new step is implemented in `tests/steps/07-xml-output.steps.ts` /
      `tests/steps/08-resume.steps.ts`.
- [ ] `npx bddgen` exits 0 with no undefined-step warnings for the new scenarios; `npm run lint`
      exits 0.
- [ ] The task report states explicitly that `npm run test:e2e:electron` was **not** run and why
      (the dev container has no display; AGENTS.md forbids it). Do not claim the suite passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `tests/features/07-xml-output.feature`, `tests/features/08-resume.feature`,
  `tests/steps/07-xml-output.steps.ts`, `tests/steps/08-resume.steps.ts`,
  `tests/fixtures/test-repo.ts`.
- The electron tier requires packaging + xvfb and **cannot run in the dev container**. `npx bddgen`
  is the only in-container check; the host run belongs to the plan's Self Validation step 7.
- Read the existing steps files first. `07-xml-output.steps.ts` already has XML-assertion helpers and
  a validate-against-XSD step; reuse them rather than adding a second XML-reading style.

## Input Dependencies

- Task 3: the serializer emits `<reply>` in v3.
- Task 4: the parser reads `<reply>` from a v2 document.
- Task 7: replies render in the UI with their test hooks.

## Output Artifacts

Electron e2e coverage of thread serialization and the v2→v3 resume upgrade.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**1. Retarget the two existing v2 references** in `tests/features/07-xml-output.feature`:

```gherkin
    And the XML should have a root element "review" with namespace "urn:self-review:v3"
```

```gherkin
    Then the output file should validate against ".agents/skills/self-review-apply/assets/self-review-v3.xsd"
```

**2. Extend the fixture generator.** `tests/fixtures/test-repo.ts` builds prior-review XML from a
data table. Its `commentXml` helper needs to accept replies. Keep the root `<review>` element on
`urn:self-review:v2` — the whole point of these fixtures is that the app reads older documents.
Sketch:

```ts
function replyXml(reply: { body: string; author?: string }): string {
  const authorAttr = reply.author ? ` author="${escapeXml(reply.author)}"` : '';
  return `      <reply${authorAttr}>\n        <body>${escapeXml(reply.body)}</body>\n      </reply>`;
}
```

and emit those after the comment's other children. Follow whatever table-parsing convention the
existing steps use to get replies in from Gherkin — a `replies` column holding a `|`-separated list,
or a separate `And that comment has these replies:` table. Prefer the separate table: authors need to
be expressible per reply, and stuffing that into one cell gets unreadable fast.

Note the fixture emits a `<reply>` inside a document declaring `urn:self-review:v2`, which is not
valid against the frozen v2 schema. That is fine and intentional — nothing validates the fixture, and
the parser is namespace-blind. If a step *does* validate a prior-review fixture, use the v3 schema
for it and say so in a comment.

**3. Scenarios for `07-xml-output.feature`:**

```gherkin
  Scenario: XML contains replies nested inside their comment in order
    When I launch self-review
    And I add a comment "Original finding" on new line 5 of "src/auth/login.ts"
    And I reply "first response" to that comment
    And I reply "second response" to that comment
    And I click "Finish Review"
    Then the output file should contain valid XML
    And that comment should contain 2 reply elements
    And the reply bodies should read "first response", "second response" in that order
    And the output file should validate against ".agents/skills/self-review-apply/assets/self-review-v3.xsd"
```

The order assertion must read the replies positionally out of the parsed document, not test for
substring presence. Both bodies being present says nothing about order, and order is the entire
feature.

**4. Scenarios for `08-resume.feature`:**

```gherkin
  Scenario: A v2 prior review is loaded and saved as v3
    Given a prior review XML file "review.xml" with these comments:
      | file              | new_line_start | new_line_end | body          | category |
      | src/auth/login.ts | 5              | 5            | Fix this typo | nit      |
    When I launch self-review with "--resume-from review.xml"
    Then the comment "Fix this typo" should be displayed at new line 5 of "src/auth/login.ts"
    When I click "Finish Review"
    Then the XML should have a root element "review" with namespace "urn:self-review:v3"
    And the output file should validate against ".agents/skills/self-review-apply/assets/self-review-v3.xsd"

  Scenario: Resumed threads render and round-trip in document order
    Given a prior review XML file "review.xml" with a comment "Original finding" on new line 5 of "src/auth/login.ts" carrying these replies:
      | body               | author        |
      | The caller guards it |             |
      | Confirmed, withdrawing | Claude Opus 5 |
      | Noted                |               |
    When I launch self-review with "--resume-from review.xml"
    Then the comment "Original finding" should show 3 replies
    And the reply bodies should read "The caller guards it", "Confirmed, withdrawing", "Noted" in that order
    And reply 2 should be attributed to "Claude Opus 5"
    And reply 1 should be attributed to "You"
    When I click "Finish Review"
    Then that comment should contain 3 reply elements
    And the reply bodies should read "The caller guards it", "Confirmed, withdrawing", "Noted" in that order
```

**5. Step definitions.** Reuse the test hooks from task 7 (`reply-btn-${commentId}`,
`thread-${commentId}`, `reply-${replyId}`) and task 6 (`reply-input`, `add-reply-btn`). If a shared
step name collides with one you added in task 10's webapp steps file, that is fine — the two tiers
have separate step registries (`tests/steps` vs `tests/webapp-steps`) and separate playwright
projects. Confirm that by reading `playwright.config.ts` before relying on it.

**Verification:**

```bash
npx bddgen && npm run lint
```

Read `bddgen`'s complete output — undefined steps surface as warnings, not failures.

`npm run test:e2e:electron` needs packaging plus a display and cannot run here. Report that
explicitly rather than implying coverage you did not exercise.

</details>
