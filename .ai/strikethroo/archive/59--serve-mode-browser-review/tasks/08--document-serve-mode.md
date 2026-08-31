---
id: 8
group: "serve-mode"
dependencies: [5]
status: "completed"
created: 2026-08-28
skills:
  - markdown
  - technical-writing
complexity_score: 3
execution_profile: "docs-and-config"
---
# Document serve mode and the shared handler module

## Objective
Document how to run serve mode, what its security posture actually is, and the fact
that handler logic now has two callers.

## Skills Required
`markdown` and `technical-writing`.

## Acceptance Criteria
- [x] `README.md` gains a serve-mode section covering the `serve` subcommand and its flags, the loopback default, the fixed output path, and the explicit finish.
- [x] The README states plainly that serve mode has no authentication and is intended to be reached over a forwarded loopback port.
- [x] `AGENTS.md` and `CLAUDE.md` note the second front end and the shared handler module, so future work knows both callers exist.
- [x] Documentation describes only what was built; no aspirational features appear.
- [x] Runnable: `grep -c 'serve' README.md` returns non-zero, and the flags shown in the README match the parser's actual accepted forms.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Markdown. Existing `README.md`, `AGENTS.md` and `CLAUDE.md`.

## Input Dependencies
The completed feature, so the documentation describes real behaviour.

## Output Artifacts
User-facing and agent-facing documentation for serve mode.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

Be accurate about the security posture rather than reassuring. Serve mode has no
authentication; loopback binding is the entire protection, and that is a deliberate v1 decision, not
an omission to gloss over. A reader deciding whether to expose the port needs to understand that
binding it publicly would expose an unauthenticated review session with filesystem read access
scoped to the served repository.

Cover the two behaviours that will otherwise surprise people: the output path cannot be changed from
the served UI, and finishing a review stops the server. Both are intentional, and saying why is
worth a sentence each.

Mention the motivating use case concretely — reviewing a diff that lives inside an isolated VM from
a browser on the host — because it explains the design in a way an abstract description does not.

For `AGENTS.md` and `CLAUDE.md`, the important fact is that handler logic is shared by the Electron
IPC registrations and the HTTP routes. Anyone changing one needs to know the other exists. Keep it
short; this is a pointer, not a tutorial.

Plan 58 established a `docs/intent/` convention. If that convention is being followed for features
of this size, an intent document capturing the lifecycle and output-path reasoning belongs there
too — check whether the maintainer expects one before adding it, rather than assuming.

</details>

---

**The README section was rewritten twice after this task.** Once when `serve` became a subcommand,
and once on review feedback to explain use rather than argue design. The criteria above describe
what the task delivered, not the section as it now stands.
