---
name: kk-curate
description: Curate pending session logs into kenkeep nodes by reading sessions in-host, drafting curator actions, then deduping and persisting via the kenkeep primitives. Resolves any surfaced contradictions interactively with the user. Use when the user wants to process accumulated session captures, or when the SessionStart nudge reports pending session logs.
---

<!-- Version: 13 -->

# kk-curate

You are the curator. Read pending session logs in this session, decide an action per candidate, run a single dedup pass via the CLI primitive, persist surviving actions via `curate-persist`, resolve every open contradiction interactively with the user (applied only through `conflict resolve`), then regenerate indices and rebalance. There is no sub-agent and no runner: **you** are the LLM doing the curation.

**A no-op run is a correct outcome.** When every candidate is a rephrasing, low-signal, or already covered, the right result is zero writes and the existing nodes left untouched. Never manufacture edits to justify the run; report "no changes; the knowledge base is current" plainly.

## Resolve the project root

Resolve the repo root (the directory containing `.ai/kenkeep`) with the shipped detector, then treat the printed path as the working directory for every command below. The snippet first walks up from the current directory to the installed detector, so it also works when started from a nested package directory:

```bash
KK_REPO_ROOT=$(
  d=$PWD
  until [ -f "$d/.ai/kenkeep/scripts/kk-detect-root.mjs" ]; do
    if [ "$d" = / ]; then
      echo 'kk-detect-root: no .ai/kenkeep/scripts/kk-detect-root.mjs in this directory or its parents.' >&2
      exit 2
    fi
    d=$(dirname "$d")
  done
  cd "$d" && node .ai/kenkeep/scripts/kk-detect-root.mjs
) || exit $?
cd "$KK_REPO_ROOT" || exit $?
pwd
```

## 0. Extract proposals from pending session logs

For each session log with `proposal_status: pending`, extract proposals inline in this session before curation begins.

1. **List pending session logs.** Use `Glob` (or `ls`) to list `.ai/kenkeep/_sessions/*.md`. For each file, `Read` its frontmatter and filter for `proposal_status: pending`. Sort by `captured_at` ascending.

2. **Short-circuit.** If none are pending, proceed to Step 1 with no message.

3. **Load the extraction prompt.** Read `.ai/kenkeep/.config/prompts/proposal-extract.md` first (per-repo override). If that file does not exist, read the bundled package template at `templates/prompts/proposal-extract.md` (relative to the installed npm package). Follow the prompt's extraction rules — do not embed a copy here.

4. **Process each pending log sequentially** (in `captured_at` order). Failure on one log does not abort the rest:
   a. Read the file in full and note its frontmatter `transcript_hash`: it names the transcript version you are extracting from.
   b. Extract the transcript section (content between `## Transcript` and `## Proposal`). A log that was curated before and then grew keeps its already-curated turns under `## Curated prefix`; read them for context if you like, but never extract from them. `## Transcript` usually holds only uncurated turns. The exception is a capture that landed while an earlier curate run was finishing: the log then shows that run's turns under `## Transcript` too, so extraction may repeat knowledge already in the tree. Extract the section as it is: in Step 2, a candidate an existing node already covers is a `drop`, or a `modify` when it changes something.
   c. Apply the extraction rules from the prompt to produce a JSON object matching `ProposalOutputSchema`: `{ "practice": [...], "map": [...] }` where each entry has `{ type, tags, title, description, body, kk_confidence }`.
   d. Pipe the JSON into the CLI primitive, passing the hash from (a):

      ```bash
      echo '<json>' | npx kenkeep@latest session-log update-proposals <path> --status done --expected-hash "<transcript_hash>"
      ```

   e. On failure (malformed output, schema violation, or CLI error), call:

      ```bash
      npx kenkeep@latest session-log update-proposals <path> --status failed --error "<message>" --expected-hash "<transcript_hash>"
      ```

   f. Either call exits non-zero with `transcript changed since extraction` when a capture hook rewrote the log while you were extracting. Nothing was written and the log is still pending: re-read it once from (a) with its new hash and redo it, or leave it for the next run.

5. **Report summary** when at least one log was processed: `Extracted proposals from N session(s) (M failed).` (replace N and M with actual counts).

6. **Proceed** to Step 1.

## 0b. Stage changed harness memory files

The host harness may keep auto-memory files outside the repo (Claude Code's persisted memories; the other hosts contribute nothing today). Ask the primitive for the ones the per-user ledger has not seen at their current content:

```bash
npx --yes kenkeep@latest memory list
```

It prints one JSON document: `{"harness":"<id>","files":[{"iri","path","sha256","bytes","session_id"}]}`. `files` holds only new or changed memory files; `[]` (nothing changed, or a harness without native memory) is the normal case: proceed to Step 1 with no message. Unlike the other primitives this one is not LLM-free on Claude Code: it finds the memory files with one headless `claude -p` call (a billed model call that can take up to a minute; if it fails, `files` is `[]` and nothing is lost, the files come back next run). The other hosts spawn nothing. Listing writes nothing; a file stays listed until Step 5b marks it.

Bring each listed file into the same pipeline as a captured session, so it is deduped, contradiction-checked and persisted under the same rules:

1. `Read` the file from `path` and apply the extraction prompt from Step 0 to its text (the memory text is the transcript surrogate) to produce a `ProposalOutputSchema` object `{ "practice": [...], "map": [...] }`. The same admission criteria apply. A file that yields no candidates is still staged with empty arrays, so Step 5b can mark it.
2. Stage it as a `done` session log keyed by the file's content, so a rerun after a failure updates the same log instead of adding a second one:

   ```bash
   echo '<json>' | npx --yes kenkeep@latest session-log stage-live --session-id "<session_id>" --transcript-excerpt "<path>"
   ```

   `session_id` is the deterministic id `memory list` printed for that content (changed content gets a new one); `--transcript-excerpt` records the file text as the log's evidence. The staged log enters Step 1 like any other `done`, unprocessed log.
3. Keep a table of `iri`, `sha256` and `session_id` per staged file; Step 5b needs it.

If staging a file fails, report it and leave it unmarked: it is listed again on the next run.

## 1. Enumerate pending session logs

Use `Glob` (or `ls`) to list `.ai/kenkeep/_sessions/*.md`. For each file, `Read` its frontmatter and keep only those whose:

- `proposal_status: done`, AND
- not curated at its current version: either `curator_processed_at` is unset (no key, or empty string), or `curated_transcript_hash` is present and differs from `transcript_hash` (the session kept going after it was curated; only its new turns were extracted). A stamp without `curated_transcript_hash` predates version binding and is never re-admitted.

Sort the surviving set by `captured_at` ascending. This is the canonical order — preserve it.

**Short-circuit.** If the surviving set is empty, print exactly one line and skip to Step 6a (conflicts left open by earlier runs are reviewed even when no session is pending):

```
No pending session logs to curate.
```

If `conflict prepare` then reports `count: 0`, print `Nothing to do.` and stop.

## 2. Read sessions in batches of ≤10 and draft curator actions

The cost of giving you too much context at once is bad output quality, so batch the work. Process up to **10 sessions per batch**. Partition the sorted pending sessions into consecutive batches of ≤10 (preserving `captured_at` order). Number the batches `1..N`.

Mint the run id once, up-front. Every per-batch file and the dedup call in Step 4 reuse it:

```bash
RUN_ID=$(uuidgen 2>/dev/null || date -u +"curate-%Y%m%dT%H%M%SZ")
mkdir -p .ai/kenkeep/_logs/curator
```

### What a batch draft holds (both paths)

Batch `N` writes one draft to the absolute path `$(pwd)/.ai/kenkeep/_logs/curator/${RUN_ID}__${N}.draft.json`. The draft records which sessions the batch consumed next to the actions drafted from them:

```
{"sessions":[{"session_id":"...","file":"<log filename>","transcript_hash":"..."}, ...],"actions":[ ... ]}
```

`sessions` lists **every** log in the batch, including one that yielded no action. Copy `session_id` and `transcript_hash` from each log's frontmatter as you read it; `file` is the log's bare filename under `.ai/kenkeep/_sessions/`. `curate-dedup` stamps only the sessions listed in valid drafts, never whatever happens to be pending on disk, and refuses to stamp a log whose `transcript_hash` changed after it was read. A batch that writes no draft, or an invalid one, consumes nothing: its sessions stay pending for the next run. Put each session in exactly one batch and write each batch's draft once.

`npx --yes kenkeep@latest schema curator-draft` prints the exact shape; `npx --yes kenkeep@latest validate curator-draft "<draft path>"` checks a draft.

### Choose path: parallel sub-agent dispatch vs. inline sequential

Probe your tool surface and pick the parallel or inline path per the shared appendix `.ai/kenkeep/.config/prompts/sub-agent-delegation.md` (probe definition, the ≤5-per-turn concurrency cap and wave rule, the absolute-draft-path and issued/validated/invalid artefact shape).

#### Parallel path (preferred when available)

The unit of parallelism is **one batch of ≤10 sessions** (`<N>` numbered from 1). For each batch in the current wave (≤5 per orchestrator turn):

1. Compute its absolute draft path and append the `issued` line before delegating:

   ```bash
   N=1  # batch index
   DRAFT_PATH="$(pwd)/.ai/kenkeep/_logs/curator/${RUN_ID}__${N}.draft.json"
   echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"issued\",\"runId\":\"${RUN_ID}\",\"batchN\":${N},\"sessions\":<count>}" \
     >> .ai/kenkeep/_logs/curator/${RUN_ID}__${N}.jsonl
   ```

2. Dispatch one sub-agent for the batch using the prompt in the sibling file `batch-agent-prompt.md`, substituting the batch's absolute session-file paths for `<list>` and the `DRAFT_PATH` above for `<DRAFT_PATH>`. The agent writes the batch draft (validating against `curator-draft`) to that path.

Await every sub-agent in the wave, then dispatch the next wave. After the **last** wave returns, run the collector (below) once.

#### Inline path (fallback)

If no sub-agent dispatch primitive is available, draft sequentially in this session. For each batch:

1. `Read` every session file in the batch in full, noting each one's frontmatter `session_id` and `transcript_hash`.
2. Each session's frontmatter `proposals:` block contains `practice: [...]` and `map: [...]` arrays. Each entry has `{ type, tags, title, description, body, kk_confidence }`.
3. For each candidate (practice and map, in order), decide an action: **add**, **modify**, **contradict**, or **drop**. Use the rules below. Use `candidate_origin = "<session_id>:<practice|map>:<index>"` where `<index>` is the zero-based position within its array and `<session_id>` is one of the batch's sessions.
4. `Write` the batch draft to its draft path: every session of the batch in `sessions`, the actions in `actions` (`[]` when the batch's sessions carried no candidates). Validate it (`npx --yes kenkeep@latest validate curator-draft "<draft path>"`), fix any path-referenced errors, and re-validate until it passes.

Repeat until every batch has a draft, then run the collector once.

### Collect the drafts (both paths)

```bash
COLLECTED=$(mktemp -t kk-curate-collected.XXXXXX.json)
npx --yes kenkeep@latest drafts collect --run-id "$RUN_ID" > "$COLLECTED"
```

`drafts collect` reads every draft of the run and prints one JSON document on stdout (captured into `$COLLECTED`, the Step 4 dedup input):

```
{"runId":"...","batches":[{"batch":N,"status":"valid|invalid","reason":"..."}, ...],"consumed":[{"session_id":"...","file":"...","transcript_hash":"..."}, ...],"actions":[ ... ]}
```

Only **valid** drafts contribute to `consumed` and `actions`: the draft parses, matches `curator-draft`, and every `candidate_origin` names one of its own `sessions`. An **invalid** draft is flagged in `batches` with a `reason` and reported on stderr (`batch <N> produced invalid output, skipped`); a batch you dispatched that is absent from `batches` wrote no draft. Neither consumes its sessions: they stay pending and the next `/kk-curate` picks them up. One bad batch never aborts the run. The collector exits non-zero only when no draft survived. Then nothing is consumed: report the skipped batches, skip Steps 3–5, and continue at Step 6 (conflicts left open by earlier runs still need review). Note every invalid or missing batch and its session count for the Step 6 report.

### Action rules

#### `add` — new knowledge

Use when the candidate is genuinely new and you have no strong signal that an existing knowledge base node already covers the same scope. When a candidate appears to overlap an existing node, prefer `drop` over `add`.

Signs an addition is correct:
- The topic is new to the knowledge base.
- The candidate has unique content (rationale, scope, examples) that isn't elsewhere.
- Existing related nodes are about adjacent things, not this thing.

The wrapper derives the slug from the title and auto-suffixes (`-2`, `-3`, …) if it would collide on disk — but if you sense a real overlap, prefer **drop** (or, when the candidate refines the existing node, **modify**).

An `add` also carries a **home branch**: the existing folder under `nodes/` where the leaf lives. You pick it in the same reasoning pass that sets `kk_relates_to` / `kk_depends_on` (see "Relate and place" below) and record it on the action's `home_folder` field. Leave `home_folder` unset/null/empty and the writer derives a folder from the leaf's own edges and tags; the root (the root fallback) is reached only when that derivation also finds nothing.

#### `modify` — refines an existing node

Use when an existing node already covers this topic, but the candidate extends or refines it without negating it.

Signs a modification is correct:
- An existing node has the same scope (same convention, same module, same gotcha) but the candidate adds: an updated example, expanded rationale, a newly-supported case, a missing detail, or a clarification.
- The two are compatible (both can be true at the same time).
- The candidate's content is genuinely new relative to the existing body, not just a rephrasing.

A modification overwrites the existing leaf in place at its current path by id (`nodes/<...>/<target_node_id>.md`, wherever it currently lives in the tree) with the merged content; it never relocates the leaf and never sets `home_folder`. `target_node_id` is required and must already exist on disk; if it doesn't, `curate-persist` reports the action as failed and writes nothing, so verify the target exists by `Glob`ing `nodes/` (or reading the relevant branch `index.md`) before emitting a `modify` action.

**End-state rewrite rule.** The merged body reads as the current state in present tense. Never append "previously…" or "earlier this used to…" paragraphs, and never narrate "the project moved from X to Y" inside the body. When the new candidate's information is a transition narrative, rewrite the existing node body so that only the new end-state claim remains visible. The knowledge base is the project's current state, not its changelog.

**Important:** if the candidate is essentially the same content as the existing node, just rephrased, **drop it** instead. Modifications must add real new information.

**Modification restraint.** Apply the shared modification-restraint criteria in `.ai/kenkeep/.config/prompts/knowledge-admission.md` (the single source for these rules): prefer a minimal in-place edit over a rewrite and never churn an accurate node; every edit must trace to the specific proposal or conflict that caused it (impact-plan style: source change → node affected → edit needed → why); and never make formatting-only edits to an existing node. A `modify` that would only tidy prose is a `drop`.

#### `contradict` — negates an existing node

Use when the candidate directly negates an existing valid node (they cannot both be true at the same time, in the same scope). The user later resolves the conflict in-session.

Signs a contradiction is real:
- The existing node says "always X" or "do X for case Y"; the candidate says "never X" or "don't do X for case Y."
- The user explicitly reversed a prior decision in the session that produced this candidate.
- The candidate's scope overlaps the existing node's scope completely, not partially.

**Important:** if the candidate's scope is a *subset* or *exception* to the existing node, this is NOT a contradiction; it's an addition (or modification) with `kk_relates_to`. Example: if the existing node says "use the default cache tags," and the candidate says "for personalized pages, use per-user cache contexts instead," these can both be true — emit **add** with `kk_relates_to: [<existing node id>]`, not `contradict`.

A contradiction does not modify any node file. The dedup primitive writes the conflict to `.ai/kenkeep/conflicts/<id>.md`; the conflict-resolution flow (Step 6 below) walks each file and asks the user. Make your `proposed_node` and `rationale` complete enough that the user can decide without re-running you. When the session negates the node without yielding a replacement rule, omit `proposed_node` (or set it to `null`): the contradiction still becomes a pending conflict, and `rationale` alone must then carry the evidence.

**Choosing `target_node_id`.** Point at the single existing node whose claim the candidate negates. If two existing nodes both overlap, pick the tightest scope match and mention the second in `rationale`; do not emit two `contradict` actions for the same candidate.

**Phrasing `rationale`.** State, in one or two sentences, which existing claim the candidate negates and why both cannot be true simultaneously. The reviewer reads this first.

**End-state body.** The `proposed_node.body` describes only the new end state in present tense. The reviewer who reads only the new node's body should see the current rule as if it had always been the rule.

#### `drop` — no change

Use when the candidate should not result in any change. Reasons to drop:

- It's a near-rephrasing of an existing node with no new information.
- The `kk_confidence` is low and the content is vague.
- The candidate captured general programming knowledge, not project-specific.
- The candidate is internally inconsistent or refers to things that don't exist elsewhere.
- **Change-oriented framing** — transition narratives, migration stories, rename or removal logs, "we used to do X, now we do Y" wording. Automatic drop regardless of confidence. The knowledge base describes the project's current end state, not its history.
- **Anything ruled out by the shared knowledge admission criteria** — maintenance/lifecycle actions, project story or history (especially plan/ticket/issue references), and incidental one-off facts dressed up as practices. Apply `.ai/kenkeep/.config/prompts/knowledge-admission.md` (which also carries the six-months keep test and the salvage rule); these are automatic drops.
- **Non-productive provenance signals** in the candidate body or description:
  - hedged/tentative wording ("we might", "we could", "potentially", "the idea is to"). Practice nodes describe rules, not hypotheses.
  - references to hypothetical or unrealized entities ("the planned X", "once we add Z"). Map nodes describe what is.
  - plan- or task-scoped framing ("for this plan, we will…", "the success criterion is…").
  - low `kk_confidence` + no rationale + no concrete example.

  Weigh these together; drop when the combined signature suggests a non-productive session. Single-signal cases do not auto-drop.

**Salvage rule.** Apply the salvage rule and keep test from `.ai/kenkeep/.config/prompts/knowledge-admission.md`: when a candidate narrates a transition, maintenance action, or story but also conveys a clean durable principle or current-state fact, extract that durable part and keep it via `add` or `modify` (rewritten as a standing rule or present-tense fact); when the whole candidate is the journey, drop it.

### Relate and place

The knowledge base is a nested topical folder tree under `nodes/`: a root index node, branch index nodes, and leaves at any depth. For every `add`, run a single reasoning pass that produces two outputs at once: the cross edges and the home branch. Do not make a second pass.

1. **Descend the tree.** Start from the root index node (`nodes/index.md`) and follow it into the branch index nodes whose summaries are relevant to the candidate. The index nodes list their child folders and leaves, so you can walk toward the nearest existing notes the same way discovery does.
2. **Set the cross edges.** From the nearest existing leaves, set `kk_relates_to` (and `kk_depends_on` where one node genuinely depends on another) by id. Edges resolve by id and are independent of where the leaf lives. For a **map** node in particular, prefer `kk_relates_to` edges to the practice nodes that govern changing that entity — the "watch out when editing this" knowledge lives in those practices, and the edge is what lets an agent reach it from the map node. When the candidate or its session evidenced a concrete edit-time check, also keep a short optional "When changing this, verify…" clause in the map body; never invent one to fill a template.
3. **Rank the home branch.** From the same descent, rank the existing index nodes (folders) by how well their subtree fits the candidate's topic, and pick the single best-fitting existing folder. Record it on the action as `home_folder` (a topical path relative to `nodes/`, e.g. `cli` or `knowledge-base/index`). Identity is the id and never depends on the chosen folder.
4. **Root fallback.** If no existing folder clears your relevance bar, leave `home_folder` unset/null/empty. Leaving it empty is still correct here; it does not mean the leaf stays loose. The writer then derives a folder from the candidate's own `kk_relates_to`, `kk_depends_on`, and tags, and only falls back to the `nodes/` root when that derivation also finds nothing. No rebalance pass relocates a root leaf. Never force a weak fit just to avoid the root: it matters more now, because a weak explicit choice would override a better derived one.

`modify`, `contradict`, and `drop` never set `home_folder`. A `modify` (dedupe-update) rewrites the existing leaf in place at its current path by id, with no folder argument and no relocation.

### Constraints (apply to every action)

- **Never cross the practice/map boundary.** A practice candidate never becomes a map node, and vice versa.
- **Never overwrite an unrelated node.** `modify` must target a node whose scope genuinely matches the candidate; otherwise prefer `add` (with `kk_relates_to`) or `contradict`.
- **Be conservative.** When uncertain between add and modify, prefer modify (less duplication). When uncertain between modify and drop, prefer drop (less noise).
- **Never change tree structure during curation.** The curation step (drafting and persisting leaves, Steps 2 to 6) places a leaf into an existing folder; it never creates, splits, or merges folders or branches. The only structural outcome curation may produce is the root fallback (a leaf at the `nodes/` root), and that now happens only when the writer's own edge-and-tag derivation also finds nothing. Structural changes happen only in the final rebalance phase (Step 7b), and only when the deterministic trigger fires.

### Action object schema

Each action conforms to `CuratorActionSchema`; an array of them is the `curator-output` contract, and a batch draft carries one under `actions`. Get the exact shape from the CLI rather than re-deriving it, and validate before dedup:

- `npx --yes kenkeep@latest schema curator-draft` prints the JSON Schema of a draft (its `sessions`, and the action object with its nested `proposed_node`).
- After you write a batch's draft on the inline path, run `npx --yes kenkeep@latest validate curator-draft "<draft path>"`; on a non-zero exit, read the path-referenced errors, fix the offending entries, and re-validate until it passes. (`drafts collect` re-validates every draft and invalidates the batch instead of aborting the run.)

The operative semantics stay above and are yours to apply: which action to choose (add/modify/contradict/drop), the end-state rewrite rule, tightest-scope contradiction, and `home_folder` placement. Only `add` sets `home_folder`; `modify`, `contradict`, and `drop` omit it; `drop` needs only `candidate_origin` and `rationale`; `contradict` may omit `proposed_node` when no replacement rule emerged but always needs a non-empty `rationale`. The schema enforces the rest, including rejecting any unknown `proposed_node` key.

## 3. Mint the survivors tmpfile

`$RUN_ID` was minted at the top of Step 2 and `$COLLECTED` holds the collector's document on both paths. Mint only the survivors file:

```bash
SURVIVORS=$(mktemp -t kk-curate-survivors.XXXXXX.json)
```

## 4. Dedup and stamp via the primitive

Invoke `curate-dedup` with the collector's document as its input:

```bash
npx --yes kenkeep@latest curate-dedup \
  --input "$COLLECTED" --output "$SURVIVORS" --run-id "$RUN_ID"
```

Dedupe ranges over the whole tree: existing leaves are read from every folder under `nodes/` (at any depth), so a duplicate is matched wherever it currently lives. The behavior is unchanged from a flat space; only the search surface is the whole tree. A duplicate updates the existing leaf in place at its current path by id (a `modify`), with no relocation.

The primitive validates the document **before any write**: it must be `{ actions, consumed }`, every action's `candidate_origin` must belong to a consumed session, and every consumed session must still be a done, unprocessed log under `_sessions/` at the same `transcript_hash` its draft recorded. A refusal from these checks exits non-zero with nothing written; read the message. `already processed` means another run stamped that session meanwhile; `changed since it was drafted` means a capture hook grew that session after you read it. In either case do not retry with the same document; start over from Step 1 (the grown session comes back as pending with only its new turns to extract).

Once validation passes, the call writes in a fixed order: the survivors file, then the conflict files, then the session stamps. Each file is replaced in one rename, but the sequence as a whole is not undone on failure. A message starting with `write failed:` means an I/O error (a full disk, a session log another process kept locked) stopped the sequence partway, and the writes before it are already on disk. Do not start over from Step 1 and do not run Step 5 yet. Check which sessions in `consumed` already carry `curator_run_id: $RUN_ID`:

- None of them: fix the cause and rerun the same `curate-dedup` command with the same `--run-id`. It rewrites the same survivors and conflict files.
- Some of them: the survivors file and every conflict file are complete, because stamps come last. Continue with Step 5. Sessions left unstamped stay pending and come back in the next run; report them in Step 6.

This single call then:

- Dedups the actions (cross-batch overlaps collapse; higher confidence wins). A surviving `add` keeps its `home_folder` through dedup untouched.
- Mints `${RUN_ID}-N` conflict ids for each surviving `contradict` action and writes `.ai/kenkeep/conflicts/<id>.md` files.
- Stamps `curator_processed_at` / `curator_run_id` plus `curated_transcript_hash` / `curated_transcript_chars` (the version consumed) into **exactly** the sessions listed in `consumed`, including a session that yielded no action, and into no other log. Sessions from invalid or missing batches, and logs that arrived after the batches were formed, are never stamped.
- Writes the non-conflict survivors (the actions you still need to persist as nodes) to `$SURVIVORS`.

It prints one line of JSON on stdout:

```
{"kept":N,"conflicts":M,"stamped":K,"runId":"..."}
```

`stamped` equals the size of `consumed`. Capture and report these numbers to the user.

## 5. Persist surviving actions via `curate-persist`

Persist `$SURVIVORS` in one pass with the deterministic primitive (the same one `kk-session-extract` uses) instead of a hand-rolled `node write` loop:

```bash
npx --yes kenkeep@latest curate-persist --input "$SURVIVORS"
```

`curate-persist` validates the survivors against the curator-output contract, then for each action writes `add`/`modify` via the shared node writer (an `add` lands in its `home_folder` when you chose one, or a folder the writer derives from the leaf's own `kk_relates_to`, `kk_depends_on`, and tags when you left it empty, or the `nodes/` root only when that derivation also finds nothing; a `modify` rewrites in place at the target's current path by id and never relocates), skips `drop`, and rejects `contradict` (conflicts belong to `curate-dedup`). It prints one JSON summary on stdout: `written`, `dropped`, `failed`, `already_applied`, and per-action `results` with `status`, the resolved id and placement, and a `reason` for each failure. It exits non-zero when the input is invalid (nothing written) or when at least one action failed. Successful writes are kept either way.

Capture the summary: you report the per-leaf placement (the folder you chose, `derived: <folder>` when the writer derived it, or `root fallback`) and any per-action failures in Step 6. A `modify` whose `target_node_id` was missing on disk surfaces as a failed action in the results (the writer never creates a node for it); call it out so the user knows the update did not land.

**Failures and retry.** `curate-dedup` already stamped the consumed sessions, so a failed action does not come back through Step 1; `$SURVIVORS` and the `failed` results are its only record. To retry a failure:

1. Fix its cause. For a `home_folder` that does not exist, edit that one action in `$SURVIVORS` to name an existing folder, or empty `home_folder` so the writer derives one. Do not create the folder: curation never changes tree structure. A `modify` whose target is missing cannot be fixed by retrying; report it.
2. Rerun the same command with the same `$SURVIVORS`. Before each `add` the primitive looks for a leaf that already carries the action's `candidate_origin` in `kk_derived_from` with the same fields and body, and a `modify` that would leave its target unchanged is a no-op. Both report `already-applied` and are not touched, so a successful `add` is never written twice (no `-2` copy) and a `modify` is never re-applied. Only the actions that have not landed are attempted.
3. Never write, copy or edit a leaf file by hand to get around a failure.

A rerun after everything landed is a no-op (exit 0, nothing written). Report every failure you could not fix in Step 6 with its `candidate_origin` and `reason`.

## 5b. Mark the processed harness memory files

Mark files only when the last `curate-persist` run over `$SURVIVORS` exited 0 with `"failed":0`. If any action is still failed, leave **every** file staged in Step 0b unmarked, whatever the failed action's `candidate_origin` says. `curate-dedup` keeps one action per duplicate and drops the other origins, so an action drawn from a memory file can survive under another session's origin (or another memory file's), and the origins in the summary cannot tell you which files' knowledge is missing. After you fix a failure and a rerun of `curate-persist` reports `"failed":0`, mark them then.

When persist is clean, record each file staged in Step 0b whose `session_id` appears in the collector's `consumed` list and whose log now carries `curator_run_id: $RUN_ID`:

```bash
npx --yes kenkeep@latest memory mark "<iri>" --hash "<sha256>" --run-id "$RUN_ID"
```

`curate-dedup` wrote its conflicts and stamped its log, and `curate-persist` wrote every surviving action, so the knowledge is on disk before the ledger says so. Leave a file unmarked when its batch was invalid or missing, when any persisted action failed, or when Steps 3 to 5 were skipped: `memory list` returns it on the next run. A non-zero exit means the file changed during the run; it is listed again next time. Carry the marked and unmarked files into the Step 6 report.

## 6. Report the content summary, then resolve conflicts

Tell the user the headline numbers (`kept`, `conflicts`, `stamped`, `runId`), the count of nodes written, the count of drops, and the harness memory files marked in Step 5b (and any left unmarked, with the reason). If the collector flagged any batch as `invalid` or `missing`, say so explicitly (`Batch <N> skipped (<reason>): <count> session(s) stay pending for the next run`) so the user knows those captures were not lost but also not curated. Also list the **placement decision per written leaf**, reading the `placement` value `curate-persist` reported: for each `add` you persisted, report its id and where it landed, a folder you chose, `derived: <folder>` when the writer derived it from the leaf's own edges and tags, or `root fallback` when neither found one; for each `modify`, `placement` reads `in place`. This distinguishes your choice from the writer's derivation so the human can review both alongside content.

**No-op is a correct outcome.** When `nodes_written == 0` (every candidate was dropped), the knowledge base was already current. Say so plainly ("no changes; the knowledge base is current") rather than apologising for an empty write set. An empty write set is the preferred result when nothing proposed real new information.

**Conflicts are reviewed on every run, not only when this run minted some.** A conflict left open by an earlier run (pending, or skipped by the human) is still a decision the human has not made. Always continue to 6a, even when `conflicts == 0` for this run and even when Step 1 found no pending session logs.

### 6a. Prepare the open conflicts

Run the deterministic primitive once to get every open conflict in presentation order, each with its computed default reply:

```bash
npx --yes kenkeep@latest conflict prepare
```

It reads every open conflict file (`status: pending` or `status: skipped`, from this run and earlier ones), sorts and groups them (by `target_node_id`, then the proposal's kind, then `detected_at`; consecutive conflicts sharing a `target_node_id` form a group), computes each conflict's default reply with the diff-ratio rules against the target as it is on disk, **stamps that default on the conflict file** (`default_decision`) so an empty reply later applies exactly what you displayed, and prints `{"count":N,"conflicts":[...]}`. Each conflict carries `id`, `status`, `target_node_id`, `candidate_origin`, `rationale`, the complete `proposal` (`title`, `type`, `description`, `tags`, `body`, `kk_confidence`, `kk_relates_to`, `kk_depends_on`) or `proposal: null` with `has_proposal: false` when the contradiction proposes no rewrite, `group_id`, `first_in_group`, the resolved `existing` node (rendered once per group on `first_in_group`; `null` when the target is missing on disk), `lines_changed` / `total_lines` / `ratio`, and the recommended `default` (`accept`, `reject` or `skip`). Walk `conflicts` in the given order; the defaults are recommendations, not determinations.

- If `count` is `0`, print `No open conflicts.` and continue to Step 7.
- If the primitive exits non-zero, it found an open conflict file it cannot read (for example one written in the legacy shape before conflict files carried `schema_version`). It prints hand-review guidance per file on stderr; show that guidance to the user verbatim, do not resolve or edit those files yourself, and continue to Step 7. Conflict files it could read are not listed until the broken ones are dealt with.

### 6b. Present each conflict

For every conflict in the prepared list:

1. If `first_in_group` and `existing` is non-null, show the existing node's `title`, `description`, and the relevant body excerpt ONCE for the group. When `existing` is `null`, say the target `target_node_id` is missing on disk: Accept cannot apply, and the primitive already made `skip` the default.
2. Show the proposed contradiction concisely: the `rationale`, and when `has_proposal` is true the proposal's `title`, `kk_confidence`, `description`, `tags` and `body`. When `has_proposal` is false, say there is nothing to accept: the human only decides whether the existing node stands (`reject`), is kept under review as a record (`keep`) or is deferred (`skip`).

### 6c. Ask the user and parse the reply

Ask the user with the default highlighted, e.g.:

```
Accept this proposal? [y/N/s/k] (default: reject)
```

Capitalize the letter of the prepared `default` in the bracket group (`accept` → `Y`, `reject` → `N`, `skip` → `S`) and name it after `default:` so it is visually obvious.

Parse the reply with these rules:

- `y`, `Y`, `yes` → `accept`.
- `n`, `N`, `no` → `reject`.
- `s`, `S`, `skip` → `skip`.
- `k`, `K`, `keep` → `keep`.
- **Empty → the displayed `default`**, whatever it is. Never map an empty reply to `accept` on its own.
- Anything else → re-prompt the SAME conflict with the same default highlighted. Do not infer intent from prose like "looks good", "yes please", or "skip this one"; require one of the listed tokens.

### 6d. Apply the decision via the primitive

Apply every decision through the deterministic primitive, never by writing or deleting a node or a conflict file yourself:

```bash
npx --yes kenkeep@latest conflict resolve <id> --decision <accept|reject|keep|skip>
```

For an **empty reply**, run it **without** `--decision`: the primitive applies the `default_decision` that `conflict prepare` stamped, so the human gets exactly the default they saw. It prints one JSON document (`id`, `decision`, `status`, `target_node_id`, `target_path`, `decided_at`, and `error` when the decision could not be applied):

- `accept` → `status: accepted`. The existing `target_node_id` node is rewritten **in place** through the same modify path `curate-persist` uses: same id, same path (`target_path`), `kk_derived_from` extended with the conflict's `candidate_origin`, every other field from the stored proposal. It never creates a node. Count it for Step 7.
- `reject` → `status: rejected`. The existing node is unchanged.
- `keep` → `status: kept`. The existing node is unchanged; the conflict file stays as a durable record for the human to commit. Use this rarely.
- `skip` → `status: skipped`. The existing node is unchanged and the conflict stays **open**: `conflict prepare` lists it again on the next run, and the rebalance trigger keeps its target stable until the human decides.

Exit `1` with `error` in the document leaves `status` at its previous value (`pending` or `skipped`). The `error` prefix tells three outcomes apart. Read it, and the document's `decision`, before you answer the user:

- An `error` starting with `decision applied to the target but the conflict file could not be updated` only follows `decision: accept`. The accept **landed**: the node at `target_path` already holds the proposal, but the conflict file still shows its previous `status`. Tell the user the node changed and the record did not, and show the `error`. Count it as accepted for Step 7, so the indices are rebuilt. Once the user has fixed the cause (for example a full disk), offer to re-run `conflict resolve <id> --decision accept`: it rewrites the node with the same content and records `accepted`.
- An `error` starting with `decision not recorded: the conflict file could not be updated and no node was changed` follows `decision: reject`, `keep` or `skip`. Nothing changed: the node is untouched and the record still shows its previous `status`. Tell the user the decision was not recorded and show the `error`. Do not count it for Step 7. Once the user has fixed the cause, offer to re-run `conflict resolve <id> --decision <decision>` with the document's `decision`, so the user's original choice is recorded rather than the prepared default.
- Any other `error` means the decision did not apply and nothing was written: the target is missing on disk, its kind differs from the proposal's, or there is no proposal to accept. Report the `error` to the user, then re-prompt the same conflict with `skip` as the default.

A conflict whose record was not updated comes back on the next `conflict prepare` if it is left as is. In every case, never write the node or the conflict file by hand and never retry `accept` without the user's go-ahead. Exit `1` with nothing on stdout is an input problem (unknown id, legacy shape, already decided): show the stderr line and move on.

After every conflict in a group is decided, move to the next group. Decided conflict files (`accepted`, `rejected`, `kept`) stay on disk as the record of the decision; the human commits or deletes them in git. Never `rm` a conflict file.

## 7. Rebuild the indices

After every content write of this run, including any conflict you accepted in Step 6 (skip Steps 7 and 7b entirely when nothing was written and nothing was accepted):

```bash
npx --yes kenkeep@latest index rebuild
```
## 7b. Rebalance (final phase, act-and-fold)

This is the last phase of curate and the only place tree structure changes. It folds in here: no second command, no second nudge. Run it after the leaves are written, the conflicts are decided (Step 6) and the indices rebuilt (Step 7), before the hand-off. The trigger never names the target of a still-open conflict (`pending` or `skipped`) as a split-leaf or create-branch candidate, so a human decision that is still outstanding keeps its target's id and path stable.

### 7b.1 Run the deterministic trigger

The trigger is deterministic and LLM-free: it reads Plan 1's per-folder occupancy / tag-diversity / leaf-size metrics, applies the hysteresis-gated decision rules, and prints a stable JSON decision. Run it and capture stdout:

```bash
npx --yes kenkeep@latest rebalance trigger
```

It prints exactly one JSON line:

```
{"actions":[{"branch":"<path>","operation":"<split-folder|split-leaf|merge|create-branch>"}, ...]}
```

**Skip path (zero added cost).** If `actions` is empty (`{"actions":[]}`), the tree is balanced past the hysteresis margin. Do **not** enter the LLM clustering step at all. Record "rebalance: no structural action" for the Step 8 summary and proceed to Step 8. This is the common case; most curate runs trip nothing and end exactly as they do today.

**Act path.** If `actions` is non-empty, continue to 7b.2. Reason only over the branches the trigger named; never widen the scope.

### 7b.2 Propose structural operations on the affected branches only

For each entry in `actions`, read only that branch (the named folder's `index.md` and its leaves, or the named leaf for `split-leaf` / `create-branch`) and decide a concrete operation. This is the only non-deterministic step in the whole run; it is quarantined behind the deterministic trigger and the human's commit gate. Do not touch any branch the trigger did not name.

Map each operation class to a concrete plan entry. For every NEW folder an operation creates, also author a one-line folder `summary`: a noun phrase / sentence fragment that completes `for more information on <summary>` (lowercase start, no trailing period, concise). Make it task-keyed, not just structural: after naming what lives in the folder, append a short `; read when <task pattern>` clause naming the tasks that should trigger descent (e.g. `the five harness adapters and their isolation rules; read before adding a harness or changing hook wiring`). Agents route by matching their task against these summaries, so the trigger clause is what makes descent reliable. The move primitive stamps it into the new folder's folder-summary sidecar, and every later deterministic rebuild self-preserves it; it is what the parent index splices into its `Load …` descent pointer.

- **split-folder** (`branch` is an over-full folder): cluster that folder's direct leaves into two or more topical subfolders. Emit `{"operation":"split-folder","branch":"<folder>","groups":[{"subfolder":"<name>","summary":"<fragment>","ids":["<id>", ...]}, ...]}`. Every id must be a current direct leaf of `branch`; assign each leaf to exactly one subgroup; author one `summary` per subfolder.
- **merge** (`branch` is a sparse/redundant folder): pick the best existing destination folder `into` (a sibling or parent whose topic subsumes the sparse branch; empty string for the `nodes/` root). Emit `{"operation":"merge","branch":"<folder>","into":"<destination>"}`. A merge creates no folder, so it authors no `summary`; the destination keeps its own self-preserved summary. The primitive rejects the plan when `branch` has no direct leaves or `into` does not exist (an earlier operation in the same plan may create it).
- **create-branch** (`branch` is a homeless root leaf, a novel top-level topic): choose a new top-level folder name and the leaves that belong in it. Emit `{"operation":"create-branch","folder":"<new-top-level>","summary":"<fragment>","ids":["<id>", ...]}`.
- **split-leaf** (`branch` is one bloated leaf covering two or more concepts): carve it into two or more new sub-documents under a folder named for the leaf. Emit `{"operation":"split-leaf","leafId":"<old-id>","folder":"<folder>","summary":"<fragment>","children":[{"title":"...","summary":"...","body":"...","tags":["..."],"relates_to":["..."],"depends_on":["..."]}, ...]}` with at least two children. The top-level `summary` describes the new folder; each child carries its own leaf `summary`. Distribute the old leaf's `kk_relates_to` / `kk_depends_on` edges deliberately: give each child only the targets its content genuinely relates to or depends on (a target may go to several children, or to none). Never cite `leafId` from a child; the primitive rejects the plan. Every child inherits the old leaf's `kk_derived_from` sources unchanged (factual provenance), the primitive mints new ids (`<type>-<slug of title>`, suffixed on collision) and records the old id in the redirect ledger (identity lineage); do not author ids. To link siblings, cite the sibling's derived id in `relates_to`; the primitive mints every child before writing any, so sibling links render the real paths.

Assemble all entries into one operation plan: `{"operations":[ ... ]}`. Write it to a tmpfile:

```bash
REBAL_PLAN=$(mktemp -t kk-rebalance-plan.XXXXXX.json)
# Write your {"operations":[...]} plan to $REBAL_PLAN.
```

### 7b.3 Apply the moves deterministically

Hand the plan to the deterministic move primitive. It applies every move as a content-byte-stable, id-stable git rename (split-leaf mints new ids plus a redirect), then runs the deterministic rebuild of the affected index nodes and `nodes_hash`. Do **not** relocate files or regenerate indexes by hand.

```bash
npx --yes kenkeep@latest rebalance move --input "$REBAL_PLAN"
```

It prints one JSON line, the structural summary you carry into Step 8:

```
{"moves":[{"operation":"...","id":"...","from":"...","to":"...","newIds":["..."],"redirectFrom":"...","unassignedEdges":{"relates_to":["..."],"depends_on":["..."]}}, ...]}
```

Capture it. A `split-leaf` move also reports `unassignedEdges`: the old leaf's edge targets no child took over. They are dropped from the tree, not silently kept; mention them in the Step 8 structural summary so the human can re-home them.

The primitive validates the whole plan against a simulated tree before it writes anything (every id at the path an earlier operation leaves it, minted child ids and sibling paths, duplicate split groups, destination conflicts): a bad later operation exits non-zero with zero changes on disk and a message on stderr; fix the plan and rerun. If the plan passes preflight but a disk write fails part-way (permissions, full disk), it exits non-zero and prints one JSON document instead: `{"error":"...","moves":[...]}`, where `moves` lists the moves that landed. Indexes are then stale against the partial tree. Do not repair anything yourself: show the human the error and the landed moves, tell them `git status` shows every changed and new file, and give both options (reverse the moves, or keep them and run `npx kenkeep index rebuild`), then stop. Do not commit, add, or restore anything: the structural moves and the curation leaf writes now sit together in one uncommitted working-tree diff. The human accepts by `git commit` and rejects just the structural moves by path-scoped `git restore`.

## 8. Hand off

Print the structural summary from the rebalance phase (Step 7b), distinct from and additional to the content summary of Step 6 so the human gets a legend for the structural diff:

- If 7b.1 reported no action, print one line: `Rebalance: no structural action (tree balanced).`
- Otherwise, for each move in the `{"moves":[...]}` summary, print one line naming the operation and the affected branch: a `split-folder` / `merge` / `create-branch` shows `<id>: <from> -> <to>`; a `split-leaf` shows `<old-id> -> <new-id>, <new-id>, ... (redirect recorded)`. Close with: `Review the structural diff with \`git diff --summary\` (R entries are renames); accept by \`git commit\`, reject just the structural moves with a path-scoped \`git restore\`.`

Then print exactly one summary line and stop:

```
Curated <nodes_written> nodes; <drops> dropped; <accepted> conflict(s) accepted, <open> still open. Review the written files under .ai/kenkeep/nodes/ and the conflict records under .ai/kenkeep/conflicts/.
```

`ENTRY.md` and `GRAPH.md` were refreshed in Step 7 (and again by the rebalance move primitive if the rebalance phase acted), so accepted conflicts are already reflected in navigation. Any structural moves from Step 7b sit in the same uncommitted diff as the content writes and the conflict records; the human accepts everything by `git commit` or rejects just the structural moves with a path-scoped `git restore`.


## Constraints

- The reply contract for conflict resolution is strictly `y`/`n`/`s`/`k` (or their long forms / empty for the displayed default). Do not accept paraphrased prose as an answer; re-prompt instead.
- If no session logs are pending, print the Step 1 one-line message and still run `conflict prepare` (Step 6a): conflicts left open by earlier runs are reviewed independently of new sessions. Stop only when it reports `count: 0`.
- Every conflict decision is applied through `conflict resolve`, never by writing a node, editing a conflict file or deleting one by hand. Accept rewrites the existing target in place (same id, same path); a missing target makes Accept fail explicitly and the default `skip`. Keep (`kept`, decided) and Skip (`skipped`, still open) are distinct outcomes.
- If `.ai/kenkeep/conflicts/` is empty or every file has a decided `status` (`accepted`, `rejected`, `kept`), `conflict prepare` reports `count: 0` and there is nothing to resolve.
- Rebalance (Step 7b) runs only as the final phase of curate, after the conflicts are decided and the indices rebuilt; it is never a separate command or nudge. When `rebalance trigger` reports `{"actions":[]}`, skip the LLM clustering step entirely (zero added cost) and report no structural action. When it fires, reason only over the branches it names, never widen the scope, and apply moves only through the `rebalance move` primitive. Never relocate files or regenerate indexes by hand, and never `git add`, `git commit`, or `git restore` anything.
- On both paths every batch writes a draft that lists the sessions it consumed; those lists, from valid drafts only, are the only thing that decides which sessions `curate-dedup` stamps. Never stamp, edit, or delete a session log by hand, and never list a session the batch did not read.
- Survivors are persisted only through `curate-persist`. A failed action is retried by rerunning that same command on the same `$SURVIVORS` after fixing its cause; it never falls back to writing a leaf by hand.
- Harness memory files enter the run only through `memory list` and `session-log stage-live` (Step 0b) and leave the queue only through `memory mark` after `curate-persist` reported no failed action (Step 5b). Never edit `memory-ledger.json` by hand and never mark a file while any persisted action is still failed.
- The dedup primitive takes no run-level lock and refuses a document whose consumed sessions are already stamped, so a re-run with the same `$COLLECTED` and a different `runId` fails closed rather than double-stamping, but it would still be a wasted run. One `curate-dedup` call per run.
