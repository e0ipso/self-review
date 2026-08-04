---
id: 10
group: "docs"
dependencies: [7, 8]
status: "completed"
created: 2026-08-04
skills:
  - documentation
complexity_score: 4
complexity_notes: "Breadth across many documents and three skill definitions, but every edit describes behavior fixed by earlier tasks; no design decisions remain"
---
# Documentation, conventions, and skill updates for remote mode

## Objective
Update every document the plan names so remote mode is a documented, discoverable
capability: project conventions (network, file writes, XSD freeze), product docs, user
docs, the three self-review skills (guide URL source, apply's third source branch,
critique inheriting via guide), and the kenkeep nodes staled by the schema change.

## Skills Required
Technical writing consistent with the repository's existing documentation voice.

## Acceptance Criteria
- [x] `AGENTS.md`: the "No network access" convention gains the documented remote-mode
      exception (network only on a user-supplied forge URL: git clone/fetch via git's own
      credentials, `gh`/`glab` for base-branch lookup and thread fetch only); the "File
      writes" convention gains the temporary clone directory (OS temp, removed on exit);
      the XSD freeze convention is reworded to "v1/v2 frozen; the current version may
      gain optional attributes additively"; the `fetch-comments` subcommand, remote
      source shape, `remote-id` (forward machinery, preserved on round-trip, no consumer
      yet), materialization model, ForgeProvider location, and splash-screen URL entry
      are documented in the relevant sections (architecture, IPC table for new channels,
      shared types).
- [x] `docs/PRD.md`: remote PR/MR review capability added to product requirements,
      scoped exactly as the plan (read-only toward the forge; posting explicitly out of
      scope).
- [x] `README.md`: user-facing usage for URL launch and `fetch-comments`, the
      materialization model (existing clone reuse, else temporary blobless clone; git's
      own credentials for private repos; `gh`/`glab` needed only for thread sync).
- [x] `.agents/skills/self-review-guide/SKILL.md`: accepts a PR/MR URL as diff source,
      materializing through the same clone-aware model (existing matching clone, else
      temporary blobless clone) so the skill reads surrounding code from a real checkout;
      `.agents/skills/self-review-apply/SKILL.md`: third source branch — when
      `review.xml` carries `remote-url`, re-materialize diff context the same way;
      `.agents/skills/self-review-critique/SKILL.md`: URL support noted as inherited
      through its guide-first step. The `.opencode/skills/*` symlinks are not replaced
      by copies (edit the real files under `.agents/skills/`).
- [x] Kenkeep nodes staled by this change are updated: at minimum the XSD freeze wording
      and v3 schema nodes (search `.ai/kenkeep/nodes/review-xml/` for freeze/v3 nodes)
      reflect "v1/v2 frozen, current version additively amendable" and the new optional
      attributes.
- [x] Verification: `npm run test:unit` stays green (the symlink and XSD sync assertions
      in `packages/core/src/xsd-schema.test.ts` still pass), and
      `npx kenkeep lint --verbose` reports no new findings for the touched nodes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Documentation only — no source-code changes in this task. XSD inline documentation was
  written in task 1; do not re-edit the schemas here.
- Match each document's existing structure and tone; keep additions succinct (the plan's
  own wording is a good source).
- Skill files are operating instructions for an LLM: the guide/apply materialization
  sections must give the concrete git recipe (clone `--filter=blob:none`, fetch
  `refs/pull/N/head` / `refs/merge-requests/N/head`, base-branch resolution) or point to
  running `self-review fetch-comments` where appropriate, so a non-thinking executor can
  follow them.

## Input Dependencies
- Task 7: final CLI surface of `fetch-comments`.
- Task 8: final IPC channels and remote-mode behavior to document.

## Output Artifacts
Updated `AGENTS.md`, `docs/PRD.md`, `README.md`, three SKILL.md files, refreshed kenkeep
nodes. Terminal documentation state of the plan.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read the current conventions in `AGENTS.md` verbatim before editing; amend in place,
   preserving the existing bullet/section style. New IPC channels come from task 8's
   shipped code — read `src/shared/ipc-channels.ts` and document what actually exists,
   not what was planned.
2. For the skills, read each SKILL.md fully first. The guide skill gets a "URL source"
   subsection in its diff-resolution step; apply gets its third source branch beside the
   existing git/directory branches; critique likely needs only a sentence.
3. Kenkeep: use the existing node format (frontmatter + body); update stale content
   in place rather than creating duplicates; check `.ai/kenkeep/nodes/review-xml/index.md`
   to locate the schema/freeze leaves.
4. Do not document features that were descoped (posting, `post` subcommand, degraded
   `.diff` tier) except where explicitly noting posting is out of scope in the PRD.
</details>
