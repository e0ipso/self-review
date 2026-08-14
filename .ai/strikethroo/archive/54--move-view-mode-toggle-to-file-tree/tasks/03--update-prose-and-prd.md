---
id: 3
group: "documentation"
dependencies: [1]
status: "completed"
created: "2026-05-03"
skills:
  - "markdown"
---
# Update E2E Gherkin Prose and PRD Sections to Reflect New Toggle Location

## Objective

Update the human-readable prose in the webapp e2e feature file and the three affected PRD sections so they describe the Split/Unified toggle as living in the file tree header rather than the toolbar. Selectors and step definitions are not touched — only narrative text.

## Skills Required

- `markdown`: Targeted edits to a Gherkin `.feature` file and a Markdown PRD with table rows and prose.

## Acceptance Criteria

- [ ] In `tests/webapp-features/05-view-modes-and-toolbar.feature`, the three lines that say "in the toolbar" **with reference to the view-mode toggle** are changed to "in the file tree". Specifically:
  - Line referencing the "Unified" view mode toggle in the "Switch to unified view mode" scenario.
  - Both lines referencing "Unified" and "Split" view mode toggles in the "Switch back to split view mode" scenario.
- [ ] All other "in the toolbar" mentions in the same feature file (theme, no-wrap, expand-all, collapse-all scenarios) are **unchanged**. The unrelated "Toolbar stays pinned when the diff pane scrolls" scenario, if present, is **unchanged**.
- [ ] The feature title `Webapp View Modes and Toolbar` is **unchanged** (still accurate — the file still tests other toolbar controls).
- [ ] In `docs/PRD.md` §5.5 (Toolbar control table), the row `| View mode toggle | Segmented button | Switch between Split and Unified diff views |` is **removed**. All other rows in the table are unchanged.
- [ ] In `docs/PRD.md` §5.3.2, the phrase "togglable via a control in the toolbar" is changed to "togglable via a control in the file tree header".
- [ ] In `docs/PRD.md` §5.2 (File Tree Navigator) **Behaviors** list, a new bullet is added describing the toggle, e.g.: `The header includes a Split/Unified diff-view toggle that controls the diff viewer's render mode.` Wording can vary slightly but must convey: (a) the control's location is the file tree header, (b) it switches between Split and Unified, (c) it controls the diff viewer.
- [ ] No changes to step definition files (`tests/webapp-steps/05-view-modes-and-toolbar.steps.ts`), `tests/recording/demo-recording.spec.ts`, `AGENTS.md`, or `CLAUDE.md`.
- [ ] No changes to source code.
- [ ] `npm run test:e2e` passes (the webapp e2e tier — Cucumber will continue to match steps because step definitions key on `data-testid`, not the prose).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- **Files to modify:**
  - `tests/webapp-features/05-view-modes-and-toolbar.feature`
  - `docs/PRD.md`
- **Files explicitly NOT modified:**
  - `tests/webapp-steps/05-view-modes-and-toolbar.steps.ts` — step definitions match by `data-testid`; prose changes do not break Cucumber matching because Gherkin `When/And/Then` text matches the step definition regex, not the natural-language qualifier.

  ⚠️ **Important caveat:** If the step definition regex literally requires the substring "in the toolbar" (e.g., a regex like `/I click the "(.+)" view mode toggle in the toolbar/`), then changing the feature prose to "in the file tree" **will** break the match. **Before editing the feature file, open `tests/webapp-steps/05-view-modes-and-toolbar.steps.ts` and confirm the relevant step regex either omits "in the toolbar" or uses a flexible matcher.** If the regex is rigid, update the step definition's regex (not its body) to match the new prose — this is the only allowed source change in this task.

## Input Dependencies

- **Task 1** must be completed first so that the documentation accurately reflects the implemented state. The PRD describes the system as it exists; updating PRD before the code lands would create a temporary mismatch.

## Output Artifacts

- Updated `tests/webapp-features/05-view-modes-and-toolbar.feature` (3 prose changes).
- Updated `docs/PRD.md` (1 row removed from §5.5, 1 phrase changed in §5.3.2, 1 bullet added in §5.2 Behaviors).
- Possibly updated `tests/webapp-steps/05-view-modes-and-toolbar.steps.ts` *only* if the step regex literally requires "in the toolbar" (see caveat above).

## Implementation Notes

<details>

### Exact Edit Map

#### `tests/webapp-features/05-view-modes-and-toolbar.feature`

Find each occurrence of:
- `When I click the "Unified" view mode toggle in the toolbar` → replace with `When I click the "Unified" view mode toggle in the file tree`
- `When I click the "Split" view mode toggle in the toolbar` → replace with `When I click the "Split" view mode toggle in the file tree`
- `And I click the "Unified" view mode toggle in the toolbar` → replace with `And I click the "Unified" view mode toggle in the file tree`
- `And I click the "Split" view mode toggle in the toolbar` → replace with `And I click the "Split" view mode toggle in the file tree`

Limit the replacement to these specific phrasings. Do **not** use a global find-and-replace on "in the toolbar" — the file contains unrelated scenarios for theme switching, line wrap, and expand/collapse-all that legitimately remain "in the toolbar".

#### `docs/PRD.md` §5.2 (File Tree Navigator) — add a Behavior bullet

In the **Behaviors** unordered list (the bullet list under "**Behaviors:**" near line 233), append a new bullet such as:

```markdown
- The header includes a Split/Unified diff-view toggle that controls the diff viewer's render mode.
```

Insert it as the last item in the Behaviors list, before the next subsection ("**File search/filter:**").

#### `docs/PRD.md` §5.3.2 (Diff View Modes)

Find:
```
Two view modes, togglable via a control in the toolbar:
```
Replace with:
```
Two view modes, togglable via a control in the file tree header:
```

#### `docs/PRD.md` §5.5 (Toolbar)

Find this row in the Toolbar control table:
```
| View mode toggle | Segmented button | Switch between Split and Unified diff views |
```
Delete the entire row. Leave the table structure (header row, separator row, other rows) intact.

### Verification

1. `grep -nE "in the toolbar" tests/webapp-features/05-view-modes-and-toolbar.feature` — no remaining hits should reference the view-mode toggle (other toolbar controls like theme/wrap/expand-all are fine to keep).
2. `grep -n "View mode toggle" docs/PRD.md` — should now have zero matches inside the §5.5 table (it may still appear in section headings or other documentation if any — verify removed only from the §5.5 toolbar table).
3. `grep -n "control in the toolbar" docs/PRD.md` — zero matches.
4. `grep -n "control in the file tree header" docs/PRD.md` — at least one match (in §5.3.2).
5. Run `npm run test:e2e` to confirm the webapp e2e suite still passes after the prose changes. If a scenario fails because the Cucumber step regex did not match the new prose, update the **regex** in `tests/webapp-steps/05-view-modes-and-toolbar.steps.ts` to accept the new wording (e.g., change `/in the toolbar/` to `/in the file tree/` for the relevant step). Do **not** change the step body.

### Why no AGENTS.md / CLAUDE.md update

Per the plan: those files do not enumerate toolbar contents at the granularity that mentions individual controls. Confirmed by reading `AGENTS.md` — the toolbar is referenced architecturally, not by control inventory.

</details>
