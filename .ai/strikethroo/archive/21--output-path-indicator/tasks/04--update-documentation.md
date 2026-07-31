---
id: 4
group: 'documentation'
dependencies: [1, 2]
status: 'completed'
created: '2026-02-27'
skills:
  - documentation
---

# Update AGENTS.md with New IPC Channel and UI Component

## Objective

Update the project documentation in `AGENTS.md` to reflect the new `output-path:change` IPC channel and the output path indicator UI component.

## Skills Required

- documentation: Technical writing for developer docs

## Acceptance Criteria

- [ ] IPC Channels table in AGENTS.md includes `output-path:change` with direction, payload, and purpose
- [ ] Project structure section mentions the output path footer in FileTree
- [ ] File writes section is updated to mention the save dialog can change the output path at runtime

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Follow existing table format in AGENTS.md for IPC channels
- Keep documentation concise and consistent with existing style

## Input Dependencies

- Task 1: IPC channel names and payload types
- Task 2: UI component location and behavior

## Output Artifacts

- Updated `AGENTS.md`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### IPC Channels Table

Add a new row to the existing table:

| Channel              | Direction       | Payload              | Purpose                                    |
| -------------------- | --------------- | -------------------- | ------------------------------------------ |
| `output-path:change` | Renderer → Main | `OutputPathInfo \| null` | Open native save dialog to change output path |

### Project Structure

In the components section, note that `FileTree.tsx` now includes an output path footer with writability status and change button.

### File Writes Section

Update the "File writes" bullet point under Critical Conventions to mention that the output path can be changed at runtime via the save dialog (default remains `./review.xml`).
</details>
