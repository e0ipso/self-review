---
id: 7
group: "documentation"
dependencies: [2, 3]
status: "completed"
created: "2026-02-16"
skills: ["documentation"]
---

# Update Documentation and Self-Review-Apply Skill

## Objective

Update PRD.md, AGENTS.md, and the self-review-apply SKILL.md to reflect the new image attachment feature, asset directory, and dual-XSD-copy sync requirement.

## Skills Required

- `documentation`: Technical writing, maintaining consistency across project docs

## Acceptance Criteria

- [ ] PRD.md Section 10.4 updated to document that the app writes the XML output file AND an optional `.self-review-assets/` directory for image attachments
- [ ] AGENTS.md "Critical Conventions" section updated to reflect the new file write behavior and the dual-XSD-copy sync requirement
- [ ] Self-review-apply SKILL.md updated with instruction to read image attachment files when processing comments with `<attachment>` elements
- [ ] All documentation changes are accurate and consistent with the implementation

## Technical Requirements

- PRD update: change "writes exactly one file" to document the asset directory convention
- AGENTS.md: add note about keeping the standalone XSD and embedded XSD string in sync
- SKILL.md: add a step between existing steps 2 and 3 instructing the LLM to read attachment files

## Input Dependencies

- Task 2: XSD schema finalized (for accurate documentation of the schema)
- Task 3: Serializer behavior finalized (for accurate documentation of file writing)

## Output Artifacts

- Updated `docs/PRD.md`
- Updated `AGENTS.md`
- Updated `.claude/skills/self-review-apply/SKILL.md`

## Implementation Notes

<details>

### Step 1: Read the files

Read these files to understand current content:
- `docs/PRD.md` (find Section 10.4 or the relevant section about file writes)
- `AGENTS.md` (find the "Critical Conventions" section)
- `.claude/skills/self-review-apply/SKILL.md` (find where processing steps are listed)

### Step 2: Update PRD.md

Find the section that states the app "writes exactly one file" (likely Section 10.4). Update it to:

> The app writes the review XML output file (default `./review.xml`) and, when comments include image attachments, a `.self-review-assets/` directory containing the referenced image files. The asset directory is created alongside the XML output file only when attachments are present.

### Step 3: Update AGENTS.md

In the "Critical Conventions" section, update the "One file write" bullet:

> **File writes.** The app writes the review XML output file at the configured `output-file` path (default `./review.xml`). When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced images. No other files are written.

Add a new bullet about XSD sync:

> **XSD sync.** The XSD schema exists in two locations: `.claude/skills/self-review-apply/assets/self-review-v1.xsd` (standalone) and embedded as a string in `src/main/xml-serializer.ts`. Both copies must be kept in sync when the schema changes.

### Step 4: Update SKILL.md

Add an instruction for handling attachments. Between the existing processing steps, add:

> **Image Attachments**: For each comment with `<attachment>` elements, read the referenced image file using the Read tool to include it as visual context before processing the comment. The `path` attribute contains a relative path from the XML file to the image. If the image file does not exist, note this in your output and proceed with the text-based feedback only.

</details>
