---
id: 10
group: "e2e-coverage"
dependencies: [7]
status: "pending"
created: 2026-07-31
skills:
  - playwright
  - cucumber
complexity_score: 5
execution_profile: "standard-implementation"
---
# Webapp e2e scenarios for replies

## Objective

Add Cucumber scenarios and their Playwright step definitions covering replying to a comment,
replying to a comment that already has replies, and editing and deleting a reply, in the webapp e2e
tier.

## Skills Required

Playwright locators and Cucumber step definition authoring in the existing `playwright-bdd` setup.

## Acceptance Criteria

- [ ] `tests/webapp-features/03-commenting.feature` gains a `# --- Replies ---` section with at
      minimum: reply to a comment that has none; reply to a comment that already has replies and
      assert the new reply lands **last**; edit a reply; delete a reply.
- [ ] Every new step is implemented in `tests/webapp-steps/03-commenting.steps.ts` (or a new
      colocated steps file registered the same way the existing ones are).
- [ ] `npx bddgen` exits 0 with no undefined-step warnings for the new scenarios. Capture and read
      the output — a warning here means the scenarios will silently no-op in CI.
- [ ] The order assertion is positional, not membership: after replying twice, assert the visible
      reply bodies equal `['first', 'second']` in that order, not that both are present.
- [ ] `npm run lint` exits 0.
- [ ] The task report states explicitly that `npm run test:e2e` was **not** run, and why (the dev
      container has no display; AGENTS.md forbids running e2e there). Do not claim the suite passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Webapp e2e drives `@self-review/react` through a Vite dev server with fixture data — no Electron,
  no packaging.
- Test hooks available from task 7: `reply-btn-${commentId}`, `thread-${commentId}`,
  `reply-${replyId}`; and from task 6: `reply-input`, `add-reply-btn`, `cancel-reply-btn`.
- Read `tests/webapp-steps/03-commenting.steps.ts` and `tests/webapp-steps/app.ts` first and follow
  their existing locator and world conventions. Do not invent a second style.

## Input Dependencies

Task 7: the reply UI with its `data-testid` hooks.

## Output Artifacts

Webapp e2e coverage of the reply affordance, running in CI.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**Scenarios to add** to `tests/webapp-features/03-commenting.feature`, in the existing Gherkin
register (imperative `When I click ...`, declarative `Then ... should ...`):

```gherkin
  # --- Replies ---

  Scenario: Reply to a comment
    Given I have added a comment "Original finding" on new line 5 of "src/auth/login.ts"
    When I click "Reply" on that comment
    Then a reply input box should appear beneath that comment
    When I type "I disagree, the caller guards this" in the reply input
    And I click "Reply" in the reply input
    Then the comment should show 1 reply
    And reply 1 should show "I disagree, the caller guards this"
    And reply 1 should be attributed to "You"

  Scenario: Replies are appended in order
    Given I have added a comment "Original finding" on new line 5 of "src/auth/login.ts"
    And I have replied "first" to that comment
    When I click "Reply" on that comment
    And I type "second" in the reply input
    And I click "Reply" in the reply input
    Then the comment replies should read "first", "second" in that order

  Scenario: Edit a reply
    Given I have added a comment "Original finding" on new line 5 of "src/auth/login.ts"
    And I have replied "typo here" to that comment
    When I click "Edit" on reply 1
    Then the reply should become an editable input pre-filled with "typo here"
    When I replace the reply text with "corrected"
    And I click "Reply" in the reply input
    Then reply 1 should show "corrected"

  Scenario: Delete a reply
    Given I have added a comment "Original finding" on new line 5 of "src/auth/login.ts"
    And I have replied "delete me" to that comment
    When I click "Delete" on reply 1
    Then the comment should show 0 replies
    And the comment should still show "Original finding"

  Scenario: Every comment offers a Reply action
    Given the webapp is loaded with a pre-existing comment authored by "Claude Opus 5"
    Then that comment should offer a "Reply" action
```

That last scenario needs a fixture with an authored comment. Check whether the webapp fixture setup
already supports pre-loading comments (`tests/webapp/` and the `Given the webapp is loaded with ...`
steps). **If it does not, drop that scenario and say so in your report** rather than building a
fixture-injection mechanism for one assertion — the "Reply on every comment regardless of author"
criterion is also covered by the Electron resume scenarios in task 11.

**Step definitions.** Model on the existing comment steps. Sketch:

```ts
When('I click {string} on that comment', async ({ page }, label: string) => { ... });

Then('the comment replies should read {string}, {string} in that order',
  async ({ page }, first: string, second: string) => {
    const bodies = await page.locator('[data-testid^="reply-"]').allInnerTexts();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain(first);
    expect(bodies[1]).toContain(second);
  });
```

Watch the selector: `[data-testid^="reply-"]` also matches `reply-btn-...` and `reply-input`. Use a
more precise anchor — scope to `[data-testid^="thread-"] > [data-testid^="reply-"]`, or give
`ReplyDisplay` a distinct attribute. If you change the markup contract, do it in task 7's files and
note it, do not fork a second convention here.

**Verification:**

```bash
npx bddgen && npm run lint
```

Read `bddgen`'s full output. Undefined steps are reported as warnings, not failures, so a silent
scroll-past leaves you with scenarios that never assert anything.

`npm run test:e2e` requires a display and cannot run in the dev container. State that plainly in your
report; the host run belongs to the plan's Self Validation step 7.

</details>
