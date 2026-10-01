Feature: Webapp configured font size
  As a reviewer who configured `font-size`
  I want the diff code text to use that size
  So that the setting has a visible effect

  Scenario: A configured font size sizes the diff code text
    Given the webapp is loaded with font size 20
    Then the diff code text should render at 20px

  Scenario: Without a configured font size the diff code text uses the default
    Given the webapp is loaded with fixture data
    Then the diff code text should render at 14px
