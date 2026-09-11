---
id: 7
group: "serve-mode-node-cli-package"
dependencies: [5]
status: "completed"
created: 2026-09-09
skills:
  - markdown
  - technical-writing
complexity_score: 3
execution_profile: "docs-and-config"
---
# Document serve mode

## Objective
Document the new capability where a user and a future contributor will each look
for it: the application README, the package README, and `AGENTS.md`.

## Skills Required
`markdown` and `technical-writing`.

## Acceptance Criteria
- [ ] The application README gains a serve-mode section covering installation, invocation, the fixed output path, the review lifecycle, and a plain statement that there is no authentication and the listener is loopback-only.
- [ ] `packages/serve/README.md` covers installation and invocation as an externally invoked command.
- [ ] `AGENTS.md` records that the review interface now has two front ends over different transports, so a change to the engine layer in `packages/core` affects both.
- [ ] The access-control statement is plain rather than reassuring: loopback binding is the whole of the story, and a reader deserves to know that before exposing a port.
- [ ] Every file path cited in the documentation exists — verify each with `ls`.
- [ ] No changes to documentation for the existing end-to-end harness, which remains the isolated test of the React package.

## Technical Requirements
`AGENTS.md` is the AI-facing contract for this repository. Its Project Structure
tree and its IPC channel table both describe a single-front-end application; the
tree needs `packages/serve`, and the prose needs to stop implying IPC is the only
transport.

Do not overstate the security posture. The plan is deliberate that loopback
binding is stated plainly rather than presented as security.

## Input Dependencies
Task 5, so the client and its invocation are settled before they are described.

## Output Artifacts
Updated `README.md` and `AGENTS.md`, and a new `packages/serve/README.md`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Application README: add a serve-mode section. Cover how to install and invoke it, that the output path is fixed by a startup argument and cannot be changed from the browser, that completing the review writes the file and stops the process, and that a closed tab does nothing. State plainly that the listener binds to loopback only and there is no authentication.
2. `packages/serve/README.md`: shorter. What it is, how to install and run it, and the same access-control statement.
3. `AGENTS.md`:
   - Add `packages/serve/` to the Project Structure tree.
   - Update the npm-workspaces paragraph to name four packages.
   - Add a short subsection recording the two front ends and the shared engine layer in `packages/core` that both reach.
   - Check whether any wording implies IPC is the only transport into the review engine, and fix what does.
4. Verify every path you cite: `grep -oE "packages/[a-z]+/src/[A-Za-z0-9_-]+\.ts" AGENTS.md | sort -u` and `ls` each result.
5. Do not touch the webapp harness documentation.
</details>
