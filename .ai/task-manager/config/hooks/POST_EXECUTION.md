# POST_EXECUTION Hook

## Validation Gates

Before marking the blueprint as complete, verify:

- [ ] All linting rules must pass without errors. If no linter is configured, skip this step
- [ ] All tests must pass successfully. If no test suite is configured, skip this step
- [ ] Verify all tasks in the plan have `status: "completed"` in their frontmatter
- [ ] Verify that the AGENTS.md documentation or related documentes are still correct after this
      plan execution

## Failure Behavior

If any validation gate fails:

- **Halt execution immediately** - do not proceed to summary generation or archival
- **Leave plan in `plans/` directory** for debugging and correction
- **Document the failure** in the plan file with details about which gate failed
- **Provide actionable next steps** for resolving the failure
