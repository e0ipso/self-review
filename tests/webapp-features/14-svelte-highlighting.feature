Feature: Svelte syntax highlighting
  As a developer reviewing a Svelte component
  I want .svelte files highlighted in the diff view
  So that markup, script and template blocks are as readable as any other source file

  Background:
    Given the webapp is loaded with Svelte fixture data

  Scenario: Svelte component diff is syntax highlighted
    Then the file section for "src/lib/Counter.svelte" should contain highlighted code lines
    And the file section for "src/lib/Counter.svelte" should contain a "keyword" token with text "#if"
    And the file section for "src/lib/Counter.svelte" should contain a "namespace" token with text "on:"
