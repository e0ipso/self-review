---
name: kk-bootstrap
description: First-time bootstrap of the project knowledge base from existing markdown documentation. Surveys docs, follows cross-references, and writes new node files directly under `.ai/kenkeep/nodes/`. Supervised by the user, who reviews each node on disk before accepting or deleting it. Use when the user wants to seed an empty knowledge base from the project's existing docs.
---

<!-- Version: 6 -->

# kk-bootstrap

You are doing a one-time bootstrap of this project's knowledge base from its existing documentation. The user invoked this skill in their normal session, so they are watching and can correct you in-flight if you go off track.

## Your task

Survey the project's existing markdown documentation, extract candidate knowledge nodes, and write them as new node files directly under `nodes/`. The user reviews each written file and accepts by leaving it in place or rejects by deleting it. You will work judgmentally, exploring, sampling, following cross-references, not exhaustively. This is a one-pass operation, supervised, and **you** are the LLM doing the extraction — there is no sub-agent and no runner.

## Inputs

- An optional path argument from the user. If provided, treat that as the root of the docs scope. If absent, default to the repo root (the `finddocs` primitive already filters out non-knowledge content via `.gitignore`, `.kkignore`, and a static skip list — see step 1).

## Configuration

Before you start, read `.ai/kenkeep/config.yaml` (falling back to `~/.config/kenkeep/config.yaml`) for any user preferences (tags vocabulary, scope hints, etc.). Apply what is relevant.

## Resolve the project root

Resolve the repo root (the directory containing `.ai/kenkeep`) with the shipped detector, then treat the printed path as the working directory for every command below:

```bash
KK_REPO_ROOT=$(node .ai/kenkeep/scripts/kk-detect-root.mjs) || exit $?
cd "$KK_REPO_ROOT" || exit $?
pwd
```

## Steps

### 1. Discover candidate docs

Invoke the `finddocs` primitive with hashes so you can dedupe against the prior bootstrap state:

```bash
npx --yes kenkeep@latest finddocs --from <scope> --with-hashes
```

`<scope>` is the user's path argument (e.g. `docs`) or omit `--from` to scan from the repo root. The output is one line per file:

```
+ <relpath>\t<sha256>
```

The primitive has already applied `.gitignore`, `.kkignore`, and the static skip list (filenames like `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `ENTRY.md`, `GRAPH.md`, `releases/**/*.md`); you will not see those.

Count the lines and **report briefly to the user before reading anything in depth**, e.g. "The CLI lists 30 markdown files across docs/, three module READMEs, two top-level overviews. I'll prioritize the overviews first, then sample modules." Use judgement to spot entry points, suspected-stale docs, and a sampling order from the deterministic list, but do not rebuild it.

**Stop and ask the user** if the list exceeds ~100 markdown files. That likely needs explicit scoping before proceeding.

### 2. Skip docs that are already in the state file

Read `.ai/kenkeep/.state/bootstrap-state.json` (it may not exist on a first run; that's fine — treat as empty). For each `+ <relpath>\t<sha>` line, check whether `docs[<relpath>].content_sha256 === <sha>`. If so, the file was already processed at this content hash by a prior run; skip it. Otherwise, the file is new or changed — include it in your working set.

### 3. Read entry points first

Read the top-level entry points completely (README.md, ARCHITECTURE.md, CONTRIBUTING.md, top-level docs hubs). They usually frame project vocabulary, name the major components, and establish the conventions vocabulary you'll need to recognize.

### 4. Sample and follow cross-references

Don't read every file end-to-end. Sample representative content and follow links between docs. If a top-level README mentions "see docs/architecture/auth.md for the authentication design," that's a high-signal pointer to follow.

For large reference docs (e.g. method-by-method API listings), skim section headers and only read prose sections, skipping auto-generated tables.

### 5. Decide which content warrants a node

For each piece of content that looks like project knowledge, decide which kind:

**Practice candidates** — imperative project guidance:
- Conventions ("always use X for Y").
- Prohibitions ("don't do X").
- Gotchas (warnings, "be careful with…").
- Rationale ("we chose X because Y").
- Tooling/workflow ("tests run with X").

Triggers in docs: imperative verbs ("use," "do," "avoid," "always," "never," "must"); rationale markers ("because," "since," "to avoid"); admonition blocks (`> Note:`, `> Warning:`); explicit do/don't sections.

**Map candidates** — what exists:
- Named features, modules, services and what they do.
- Vocabulary specific to this project.
- File-tree locations of major systems.

Triggers in docs: section headers naming components ("## Rivermark Cards Module"); definition patterns ("X is our service for Y"); explicit file-path references ("`modules/custom/x/`").

**Optional change-oriented clause (evidence-gated).** When the source doc states what to watch for when changing this entity — a check to run, an invariant to preserve, a related rule that constrains edits — you may end the map body with one short "When changing this, verify…" sentence that captures it. Add it only when the doc evidences it; never invent watch-out guidance to fill a template. If the doc says nothing about editing the entity, omit the clause.

When a piece of content has both aspects (e.g. "Use rm_analytics.dispatcher, our service for tracking events"), split it: practice owns "use the dispatcher"; map owns "what the dispatcher is."

**Skip** (content judgement only; filename-pattern skips are already handled by `finddocs`):
- Auto-generated API reference (method tables, parameter dumps).
- Boilerplate paragraphs inside otherwise-useful docs (standard license preamble, generic CI badges).
- General programming knowledge that's not project-specific (Drupal/React/Django basics).
- Aspirational TODOs and "we should eventually" content.
- Everything ruled out by the shared **knowledge admission criteria** — maintenance/lifecycle actions, project story or history (especially plan/ticket/issue references), and incidental one-off facts dressed up as conventions — plus the six-months keep test. Apply `.ai/kenkeep/.config/prompts/knowledge-admission.md` to every candidate; do not restate it here.

### 6. Draft each node body, then persist via `node write`

For each candidate, the drafted node has: a kind (`practice` | `map`), a short slug derived from the title (lowercase, hyphenated, ASCII), 1–5 short lowercase tags, an imperative-or-noun title ≤80 chars, a summary ≤140 chars, and a body of 1–4 short paragraphs.

**Confidence calibration.** Default `confidence: medium` for bootstrap content. Existing docs may be stale or aspirational; the reviewer needs to assess each file before accepting it. Use `confidence: high` only when the doc explicitly states the rule with rationale and the doc looks actively maintained. Use `confidence: low` when the rule is implicit, the doc is marked draft/deprecated/legacy, or the content is ambiguous.

#### Pick the drafting path (probe + fallback)

Before drafting anything, mint a run id and prepare the per-batch log directory — both paths use them:

```bash
RUN_ID=$(uuidgen 2>/dev/null || date -u +"bootstrap-%Y%m%dT%H%M%SZ")
mkdir -p .ai/kenkeep/_logs/bootstrap
LOG_DIR="$(pwd)/.ai/kenkeep/_logs/bootstrap"
```

Probe your tool surface and pick the parallel or inline path per the shared appendix `.ai/kenkeep/.config/prompts/sub-agent-delegation.md` (probe definition, the ≤5-per-turn concurrency cap and wave rule, the absolute-draft-path and issued/validated/invalid artefact shape). The bootstrap-specific details below say what each unit drafts and how the collector persists it.

#### Parallel path — orchestrator + sub-agent dispatch + collector

The unit of parallelism is **one candidate doc** (`<batchN>` numbered from 1). For each doc in the current wave (≤5 per orchestrator turn):

1. Compute its absolute draft path `${LOG_DIR}/${RUN_ID}__<batchN>.draft.json` and append the `issued` line to `${LOG_DIR}/${RUN_ID}__<batchN>.jsonl` before delegating:

   ```bash
   printf '{"ts":"%s","event":"issued","runId":"%s","batchN":%d,"doc":"%s","hash":"%s"}\n' \
     "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RUN_ID" <batchN> "<relpath>" "<sha256>" \
     >> "${LOG_DIR}/${RUN_ID}__<batchN>.jsonl"
   ```

2. Delegate the drafting of this one doc to a sub-agent with focused instructions:

   > You are drafting kenkeep node candidates for ONE source doc.
   > - Read the doc at relative path `<relpath>` (content sha256 `<sha256>`) in full.
   > - Decide whether it warrants 0, 1, or more nodes. Use the same practice/map rules as Step 5 of the parent skill.
   > - For each chosen node, produce exactly these keys: `{kind, slug, title, summary, tags[], confidence, body}`. Do not include `id` or YAML frontmatter — the host stamps both.
   > - Write the array as JSON (and nothing else) to the absolute path `<DRAFT_PATH>`. Zero nodes is a valid result; in that case write `[]`.
   > - On success, return only the absolute draft path.

**Collector turn — after every dispatched agent in the wave has returned**, for each batch's draft file:

1. Read and parse it as JSON. The expected shape is an array of objects with keys `kind`, `slug`, `title`, `summary`, `tags` (array), `confidence` (`high`|`medium`|`low`), and `body`.
2. On parse error or shape mismatch, append an `event:"invalid"` line, surface **"batch <batchN> produced invalid output, skipped"**, and continue — never abort the run.
3. For each validated draft, persist via `node write` (see below), passing the originating doc's `--source-doc` and `--source-hash`. The primitive locks its `bootstrap-state.json` update, so back-to-back invocations are safe.
4. Append an `event:"validated"` line with the count written and the resolved ids. Issue the next wave only after the current wave's collector turn finishes.

#### Inline fallback path

If the probe says no dispatch primitive exists, draft each candidate's node body inline in this session — same vocabulary (`kind`, `slug`, `title`, `summary`, `tags`, `confidence`, `body`) — and persist each one via `node write` immediately after drafting. Still write the per-batch JSONL log (one batch per doc): append an `event:"issued"` line before drafting and an `event:"validated"` line after the `node write` returns, so the artefact shape is identical across paths.

#### Persist via `node write`

Both paths funnel each surviving draft through the same persistence primitive, piping the body on stdin and folding the per-file hash-map update into the same invocation:

```bash
npx --yes kenkeep@latest node write <kind> <slug> \
  --title "<title>" --summary "<summary>" \
  --tags "<tag1,tag2,...>" \
  --confidence <high|medium|low> \
  --source-doc "<relpath>" --source-hash "<sha256>" <<'EOF'
<body markdown>
EOF
```

`--source-doc` and `--source-hash` MUST be provided together (the primitive errors out if only one is given). When both are present, the same invocation atomically updates `bootstrap-state.json` so a re-run of step 2 will skip this file. `--source-doc` is the relpath you saw in the `finddocs` output; `--source-hash` is the SHA-256 from the same line.

On success the primitive prints the resolved node id and exits 0. Capture it. If the slug collides with an existing node, the primitive auto-suffixes (`-2`, `-3`, …) so the printed id may differ from `<slug>`. On any non-zero exit, surface the stderr to the user and continue with the next candidate; do not retry blindly.

**Never overwrite an existing node.** `node write` will not overwrite — `ensureUniqueId` always produces a fresh id. If the candidate is genuinely the same scope as an existing node, **skip it** and call it out in your final report rather than letting it land as a `-2` sibling.

**Multi-source nodes.** If a candidate is sourced from multiple docs (you found the same convention discussed in two places), pick the most authoritative doc as the `--source-doc` / `--source-hash` pair and mention the other sources in the body (e.g. "Also documented in `docs/auth.md`."). Do not write duplicate nodes.

### 7. Refresh ENTRY.md and GRAPH.md

After all writes, rebuild the indices so the reviewer sees them in sync with the new nodes:

```bash
npx --yes kenkeep@latest index rebuild
```

### 8. Report back

When you're done, summarize for the user:

- How many docs you read; which ones you skipped and why.
- How many practice nodes you wrote.
- How many map nodes you wrote.
- Any candidates you skipped because they overlapped an existing node; the user may want to merge content manually.
- Any cross-references you noticed but didn't follow (the user might want to direct you to those).
- Any docs that looked stale or contradictory that the user should double-check.
- Confirmation that `ENTRY.md` and `GRAPH.md` were refreshed.

Then tell the user to review the written files, accept by leaving them in place, and reject by deleting them (`rm nodes/<folder>/<file>.md`).

## Constraints

- **Never overwrite an existing node in `nodes/`.** Bootstrap is conservative: if a candidate's scope is genuinely covered by an existing node, skip and report. Do not let `ensureUniqueId` paper over the overlap with a `-2` suffix.
- **Never auto-resolve perceived contradictions during bootstrap.** If you notice two docs that disagree, write only one as a node and surface the conflict in your final report so the user can decide. Do not write a second contradictory node.
- **Don't hallucinate rationale.** Only include "because…" content that's actually present in the source. If the doc just says "use X," your node says "use X," not "use X because of [made-up reason]." Quote or close-paraphrase from the source.
- **Don't try to read code files.** Stick to markdown documentation. The point of bootstrap is to extract what's already been written down.
- **Practice/map boundary is hard.** A practice candidate never becomes a map node, and vice versa. Split combined content into two nodes.
- **Defer to `finddocs` and `node write` for discovery, hashing, slug collision resolution, and state.** Do not reimplement them.

## When to stop

Stop and ask the user if:
- The `finddocs` list contains more than ~100 markdown files (likely needs scoping).
- You encounter a doc that's clearly contentious or version-specific and you can't tell which version is current.
- You realize you've been over-extracting (nodes piling up faster than the user can plausibly review).
- The user has not corrected you in a while but your confidence is dropping.

Bootstrap is supervised. Defer to the human when uncertain.
