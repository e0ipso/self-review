---
id: 9
group: "documentation"
dependencies: [1]
status: "completed"
created: 2026-07-31
skills:
  - markdown
  - technical-writing
complexity_score: 3
execution_profile: "docs-and-config"
---
# Retarget project documentation at v3

## Objective

Update `AGENTS.md`, `docs/PRD.md` and `README.md` for the v3 bump and the threaded-reply capability,
including the fact that resuming a v1/v2 document silently upgrades it to v3 on save.

## Skills Required

Technical writing; Markdown.

## Acceptance Criteria

- [ ] `AGENTS.md` **XSD sync** convention names `self-review-v3.xsd`, and states that
      `self-review-v1.xsd` **and** `self-review-v2.xsd` are both frozen and must not be edited.
- [ ] `AGENTS.md` **XSD Schema Location** section points at
      `.agents/skills/self-review-apply/assets/self-review-v3.xsd`.
- [ ] `AGENTS.md` Critical Conventions gains a **Threaded replies** entry, sitting alongside the
      existing severity/confidence entry, covering: a `<comment>` may carry an ordered `<reply>` list;
      document order is conversation order; replies are flat; a reply carries no
      category/severity/confidence/suggestion; the last human turn is the tie-breaker for a consumer.
- [ ] `AGENTS.md` records that `--resume-from` reads v1/v2/v3 but always writes v3, so a round-trip
      through the app silently upgrades the document's namespace, and that the frozen v1/v2 schemas
      stay on disk so external consumers keep a validator.
- [ ] `docs/PRD.md` gains a short subsection on threaded replies as a product capability — what a
      reply can and cannot carry, and that conversation order is document order. Brief: this is one
      feature, not a restructure.
- [ ] `docs/PRD.md:410`, `:412` and `:479` reference v3 rather than v2, and its example document
      shows a comment with at least one reply.
- [ ] `README.md:275` shows `self-review-v3.xsd` in the directory tree.
- [ ] `grep -rn "self-review-v2\|self-review:v2" AGENTS.md README.md docs/PRD.md` returns nothing
      except deliberate references to v2 as a *frozen older* schema.
- [ ] `npm run lint` exits 0 and `npm run test:unit` still passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `AGENTS.md`, `docs/PRD.md`, `README.md`. `CLAUDE.md` just points at `AGENTS.md`; leave it.
- Do not touch `.agents/skills/**` — task 8 owns those files and editing them here causes a conflict.
- Do not hand-edit anything under `.ai/kenkeep/`. Several nodes name the v2 schema and go stale on
  this bump, but they are maintained through the kenkeep curation flow, not by hand. This is recorded
  as a follow-up, not a deliverable of this task.

## Input Dependencies

Task 1: `self-review-v3.xsd` exists at the canonical path.

## Output Artifacts

Project documentation consistent with the shipped schema.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**Exact known references** (re-grep before editing — line numbers drift):

- `AGENTS.md:257` — XSD sync convention, `self-review-v2.xsd`
- `AGENTS.md:327` — "The XSD schema lives at ..."
- `README.md:275` — `└── self-review-v2.xsd` in the directory tree
- `docs/PRD.md:410` — `xmlns="urn:self-review:v2"`
- `docs/PRD.md:412` — `xsi:schemaLocation="urn:self-review:v2 self-review-v2.xsd"`
- `docs/PRD.md:479` — "The XSD schema file (`self-review-v2.xsd`) is bundled ..."

**AGENTS.md Critical Conventions entry** — model it on the existing "Severity and confidence" entry,
same register:

```markdown
- **Threaded replies.** A `<comment>` may carry an ordered list of `<reply>` children. The root
  comment *is* the thread: it owns the anchor, `category`, `severity` and `confidence`, and its
  replies are turns in a conversation about it. Document order is conversation order — there are no
  reply IDs and no timestamps, and nothing else sorts them. Replies are flat, never nested. A reply
  carries a body, an optional `author` and optional attachments, and deliberately carries no
  category, severity, confidence or `<suggestion>`: a counter-proposal goes in the body as a fenced
  code block. For a consumer, the last human turn (a reply with no `author`) is the tie-breaker over
  any earlier machine assertion in that thread.
```

**AGENTS.md resume note** — add near the XSD sync convention:

```markdown
- **Read any version, write v3.** The parser is namespace-blind, so `--resume-from` loads v1, v2 and
  v3 documents identically. The serializer always emits `urn:self-review:v3`, so a document that
  round-trips through the app is silently upgraded. This is deliberate: `self-review-v1.xsd` and
  `self-review-v2.xsd` stay frozen on disk so a consumer holding an older document keeps a working
  validator.
```

**docs/PRD.md subsection** — keep it to roughly this length:

```markdown
#### Threaded Replies

A review comment can be answered. Replies nest inside the comment they answer, forming a single
thread: the comment states a finding, and each reply is a later turn in the conversation about it.
Both the human reviewer in the UI and an LLM writing the XML directly can add replies, so a
disagreement can be recorded as a conversation instead of by overwriting the original finding or
adding a disconnected comment on the same line.

A reply carries a body, an optional author, and optional image attachments. It deliberately carries
no category, severity, confidence or code suggestion: those describe the finding, and the finding is
the root comment. Replies are flat rather than nested, and their order in the document *is* the
conversation order — there is no timestamp and no identifier to sort by.
```

**Verification:**

```bash
grep -rn "self-review-v2\|self-review:v2" AGENTS.md README.md docs/PRD.md
npm run lint && npm run test:unit
```

Every surviving hit must be a deliberate mention of v2 as a frozen older schema. Read each one.

</details>
