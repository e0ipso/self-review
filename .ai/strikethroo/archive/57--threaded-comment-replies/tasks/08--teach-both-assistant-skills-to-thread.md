---
id: 8
group: "documentation"
dependencies: [1]
status: "completed"
created: 2026-07-31
skills:
  - markdown
  - technical-writing
complexity_score: 4
execution_profile: "docs-and-config"
---
# Teach both assistant skills to thread

## Objective

Update `self-review-apply/SKILL.md` and `self-review-critique/SKILL.md` to v3, teach both to read
threads in order with the last human turn as tie-breaker, and give critique the write-side rules for
authoring `<reply>` elements instead of re-raising findings.

## Skills Required

Technical writing for an LLM audience; Markdown.

## Acceptance Criteria

- [ ] Every `self-review-v2.xsd` and `urn:self-review:v2` reference in both `SKILL.md` files points
      at v3. Verified by `grep -rn "self-review-v2\|self-review:v2" .agents/skills/self-review-apply
      .agents/skills/self-review-critique` returning nothing.
- [ ] Both files' "Non-obvious semantics" lists gain reply entries covering: document order is
      conversation order; replies are flat; a reply carries no category/severity/confidence/
      suggestion; the root comment's metadata governs the thread.
- [ ] `self-review-apply/SKILL.md` states that a thread's replies are read in order and that **the
      last human turn (a reply with no `author` attribute) is the tie-breaker** over any earlier
      machine assertion, including over the root comment's `severity` and `confidence`.
- [ ] `self-review-critique/SKILL.md` states as an **exit criterion** — not a suggestion — that when
      run against a document already containing comments it appends `<reply>` to the existing thread
      rather than emitting a duplicate root comment for a finding already raised.
- [ ] `self-review-critique/SKILL.md` states that every reply it writes carries an `author`
      attribute, and that it must not put a `<suggestion>` or any thresholding attribute on a reply.
- [ ] `self-review-critique/SKILL.md` states plainly that a human reply refuting a finding is
      evidence the finding was wrong, and that conceding in a reply is a valid and expected turn.
- [ ] Both files' example XML documents show `xmlns="urn:self-review:v3"` and at least one shows a
      comment with two replies.
- [ ] `ls -l .opencode/skills/self-review-apply .opencode/skills/self-review-critique` shows both are
      still symlinks, and `npm run test:unit` passes (`xsd-schema.test.ts` asserts this).
- [ ] `npm run lint` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `.agents/skills/self-review-apply/SKILL.md` and `.agents/skills/self-review-critique/SKILL.md`.
- **Edit through `.agents/`, never `.opencode/`.** The `.opencode/skills/` entries are symlinks into
  `.agents/`. Replacing a symlink with a copy makes opencode resolve the duplicate
  nondeterministically, and `xsd-schema.test.ts` fails on it.
- Do **not** touch `.agents/skills/st-code-review/SKILL.md`. Its v2 references and its dangling
  `<root>/config/schemas/self-review-v2.xsd` path are recorded as out of scope in the plan's Notes;
  it continues to emit v2 after this change.

## Input Dependencies

Task 1: `self-review-v3.xsd` exists at the canonical path.

## Output Artifacts

Two skill documents that let the conversation continue unattended.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**Known v2 references to fix** (line numbers as of the current tree, re-grep before editing):

- `self-review-apply/SKILL.md:15` — "keep in sync with `assets/self-review-v2.xsd`"
- `self-review-apply/SKILL.md:39` — the `xmllint --schema assets/self-review-v2.xsd` invocation
- `self-review-critique/SKILL.md:15` — "keep in sync with `../self-review-apply/assets/self-review-v2.xsd`"
- `self-review-critique/SKILL.md:126` — "Read the XSD schema at ..."
- `self-review-critique/SKILL.md:134` — the example `<review xmlns="urn:self-review:v2" ...>`
- `self-review-critique/SKILL.md:171` — the `xmllint` validation command

**Semantics bullets to add to both files' non-obvious-semantics lists:**

```markdown
- A `<comment>` may carry an ordered list of `<reply>` children. The comment is the root of the
  thread; each reply is a later turn in the conversation about it.
- Document order is conversation order. There are no timestamps and no identifiers — the earlier
  reply is the earlier turn, and nothing else sorts them.
- Replies are flat. A reply is never nested inside another reply. A reply that answers an earlier
  reply says so in prose.
- A reply carries `<body>`, an optional `author`, and optional `<attachment>` children. It carries no
  category, no severity, no confidence and no `<suggestion>` — all four are properties of the
  finding, and the finding is the root comment.
```

**For `self-review-apply/SKILL.md`,** add to the reading rules:

```markdown
Read a thread top to bottom before acting on it. The root comment states a finding; the replies
argue about it. **The last human turn wins.** A reply with no `author` attribute is the human
reviewer's, and it overrides every earlier machine assertion in that thread — including the root
comment's `severity` and `confidence`. If the human's last reply refutes the finding, do not apply
it, whatever the root comment claims about how consequential or certain it is.
```

**For `self-review-critique/SKILL.md`,** add a write-side section. This is the part that decides
whether the feature is human-only or not, so state it as a rule, not advice:

```markdown
## Replying to an existing review

When the target `review.xml` already contains comments — a second critique round, or a document a
human has answered — you are joining a conversation, not starting one.

- **Do not re-raise a finding that is already in the document.** If a comment already covers the
  issue you found, append a `<reply>` to that comment. Emitting a fresh root comment for a finding
  already present is a duplicate, and duplicates are the failure mode this rule exists to prevent.
- Set `author` to your model name on **every** reply you write, exactly as you already do for
  comments. A reply with no `author` is read as the human's, so omitting it misattributes your words.
- A reply carries no `<suggestion>` and no `severity`/`confidence`/`<category>`. If you want to
  propose concrete code, put it in the reply body as a fenced code block.
- Replies go at the end of the comment's children, after any `<attachment>`, and in the order the
  conversation happened.
- **A human reply that refutes your finding is evidence your finding was wrong.** Read it as
  evidence, not as an obstacle. Conceding — "Confirmed, withdrawing" — is a valid and expected turn,
  and it is more useful than restating the original claim in different words.

**Exit criterion:** when run against a document that already contains comments, the output contains
no duplicate root comment for a finding already present, and every `<reply>` you added carries an
`author` attribute.
```

**Example document** for `self-review-critique/SKILL.md:134`:

```xml
<review xmlns="urn:self-review:v3" timestamp="2026-02-28T14:30:00.000Z" git-diff-args="--staged" repository="/absolute/path/to/repo">
  <file path="src/parse.ts" change-type="modified" viewed="true">
    <comment new-line-start="42" new-line-end="44" author="Claude Opus 5" severity="major" confidence="medium">
      <body>`parseId` can return undefined here.</body>
      <category>bug</category>
      <reply>
        <body>The caller at line 40 guarantees non-null.</body>
      </reply>
      <reply author="Claude Opus 5">
        <body>Confirmed — withdrawing.</body>
      </reply>
    </comment>
  </file>
</review>
```

The unauthored reply is the human's; the authored one is the model conceding. Keep both in the
example — the shape of a concession is the thing being taught.

**Verification:**

```bash
grep -rn "self-review-v2\|self-review:v2" .agents/skills/self-review-apply .agents/skills/self-review-critique   # expect no output
ls -l .opencode/skills/self-review-apply .opencode/skills/self-review-critique                                    # expect symlinks
npm run test:unit && npm run lint
```

</details>
