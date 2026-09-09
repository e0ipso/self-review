Feature: Applying a Suggestion
  As a developer reviewing a change
  I want to write a suggestion's proposed code into the working file
  So that I do not retype a fix I have already read and approved

  # No Background: every scenario needs a different host, so each declares
  # its own Given. The harness adapter answers as the Electron host would
  # (packages/core/src/review-handlers.ts) and never runs the apply engine,
  # so what these scenarios pin down is the control's own contract: when it
  # renders at all, which button it offers, and what it reports afterwards.
  #
  # The engine that byte-compares the anchored lines and rewrites the file
  # is Node-only and has no browser surface; its ten refusal reasons are
  # covered in packages/core/src/apply-suggestion.test.ts.
  #
  # The host's own `destination-required` refusal has no browser surface
  # either: once a destination picker is wired up, the control asks for a
  # directory before it ever attempts an apply, so the refusal is defence in
  # depth behind a flow the reviewer cannot take. It belongs to
  # review-handlers coverage, not here.

  Scenario: A host that cannot write offers no Apply control
    Given the webapp is loaded with fixture data
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    Then the displayed comment should show a suggestion block
    And the suggestion should offer no apply control

  Scenario: Applying reports the result and retires the button
    Given the webapp is loaded with a host that applies suggestions
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    When I click "Apply" on that suggestion
    Then the suggestion should report "applied"
    And the apply control should read "Applied to src/auth/login.ts. Replaced 1 line."
    And the suggestion should offer no apply button

  Scenario: A refused apply names the reason and keeps the button
    Given the webapp is loaded with a host that refuses to apply suggestions
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    When I click "Apply" on that suggestion
    Then the suggestion should report "refused" with reason "context-mismatch"
    And the apply control should read "Not applied. Those lines no longer match the code this suggestion was written against."
    And the suggestion should offer an apply button

  Scenario: A temporary clone asks for a destination before it applies
    Given the webapp is loaded with a temporary-clone remote session and a destination picker that answers "chosen"
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    Then the suggestion should offer to choose a destination
    And the apply control should read "This pull request was cloned into a temporary directory. Choose where to write it."
    When I click "Choose destination" on that suggestion
    Then the suggestion should report "applied"

  Scenario: Dismissing the destination picker leaves the request in place
    Given the webapp is loaded with a temporary-clone remote session and a destination picker that answers "cancelled"
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    When I click "Choose destination" on that suggestion
    Then the suggestion should offer to choose a destination
    And the suggestion should report no apply outcome

  Scenario: A destination inside the temporary clone is refused
    Given the webapp is loaded with a temporary-clone remote session and a destination picker that answers "rejected"
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    When I click "Choose destination" on that suggestion
    Then the suggestion should report "refused" with reason "destination-inside-temporary-clone"

  Scenario: A reused clone applies without asking for a destination
    Given the webapp is loaded with a reused-clone remote session and a destination picker that answers "chosen"
    And I have added a comment with a suggestion on new line 5 of "src/auth/login.ts"
    Then the suggestion should offer an apply button
    When I click "Apply" on that suggestion
    Then the suggestion should report "applied"
