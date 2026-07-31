---
name: kk-curate
description: Curate pending session logs into kenkeep nodes by reading sessions in-host, drafting curator actions, then deduping and persisting via the kenkeep primitives. Resolves any surfaced contradictions interactively with the user. Use when the user wants to process accumulated session captures, or when the SessionStart nudge reports pending session logs.
---

<!-- Version: 11 -->

# kk-curate

You are the curator. Read pending session logs in this session, decide an action per candidate, run a single dedup pass via the CLI primitive, persist surviving actions via `curate-persist`, regenerate indices, and resolve any surfaced contradictions interactively with the user. There is no sub-agent and no runner — **you** are the LLM doing the curation.

**A no-op run is a correct outcome.** When every candidate is a rephrasing, low-signal, or already covered, the right result is zero writes and the existing nodes left untouched. Never manufacture edits to justify the run; report "no changes; the knowledge base is current" plainly.

## Resolve the project root

Resolve the repo root (the directory containing `.ai/kenkeep`) with the shipped detector, then treat the printed path as the working directory for every command below:

```bash
KK_REPO_ROOT=$(node .ai/kenkeep/scripts/kk-detect-root.mjs) || exit $?
cd "$KK_REPO_ROOT" || exit $?
pwd
```

## 0. Extract proposals from pending session logs

For each session log with `proposal_status: pending`, extract proposals inline in this session before curation begins.

1. **List pending session logs.** Use `Glob` (or `ls`) to list `.ai/kenkeep/_sessions/*.md`. For each file, `Read` its frontmatter and filter for `proposal_status: pending`. Sort by `captured_at` ascending.

2. **Short-circuit.** If none are pending, proceed to Step 1 with no message.

3. **Load the extraction prompt.** Read `.ai/kenkeep/.config/prompts/proposal-extract.md` first (per-repo override). If that file does not exist, read the bundled package template at `templates/prompts/proposal-extract.md` (relative to the installed npm package). Follow the prompt's extraction rules — do not embed a copy here.

4. **Process each pending log sequentially** (in `captured_at` order). Failure on one log does not abort the rest:
   a. Read the file in full.
   b. Extract the transcript section (content between `## Transcript` and `## Proposal`).
   c. Apply the extraction rules from the prompt to produce a JSON object matching `ProposalOutputSchema`: `{ "practice": [...], "map": [...] }` where each entry has `{ type, tags, title, description, body, kk_confidence }`.
   d. Pipe the JSON into the CLI primitive:

      ```bash
      echo '<json>' | npx kenkeep@latest session-log update-proposals <path> --status done
      ```

   e. On failure (malformed output, schema violation, or CLI error), call:

      ```bash
      npx kenkeep@latest session-log update-proposals <path> --status failed --error "<message>"
      ```

5. **Report summary** when at least one log was processed: `Extracted proposals from N session(s) (M failed).` (replace N and M with actual counts).

6. **Proceed** to Step 1.

## 1. Enumerate pending session logs

Use `Glob` (or `ls`) to list `.ai/kenkeep/sessions/*.md`. For each file, `Read` its frontmatter and keep only those whose:

- `proposal_status: done`, AND
- `curator_processed_at` is unset (no key, or empty string).

Sort the surviving set by `captured_at` ascending. This is the canonical order — preserve it.

**Short-circuit.** If the surviving set is empty, print exactly one line and stop (skip every step below):

```
No pending session logs to curate. Nothing to do.
```

## 2. Read sessions in batches of ≤10 and draft curator actions

The cost of giving you too much context at once is bad output quality, so batch the work. Process up to **10 sessions per batch**. Partition the sorted pending sessions into consecutive batches of ≤10 (preserving `captured_at` order). Number the batches `1..N`.

Mint the run id once, up-front — both the per-batch tmpfiles and Step 3's proposals file reuse it:

```bash
RUN_ID=$(uuidgen 2>/dev/null || date -u +"curate-%Y%m%dT%H%M%SZ")
mkdir -p .ai/kenkeep/_logs/curator
```

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

2. Dispatch one sub-agent for the batch using the prompt in the sibling file `batch-agent-prompt.md`, substituting the batch's absolute session-file paths for `<list>` and the `DRAFT_PATH` above for `<DRAFT_PATH>`. The agent writes its `CuratorAction` array (validating against `curator-output`) to that path.

After every sub-agent in the wave returns, the **collector turn** aggregates and validates the per-batch drafts with the deterministic primitive instead of a hand-rolled concat:

```bash
PROPOSALS=$(mktemp -t kk-curate-proposals.XXXXXX.json)
npx --yes kenkeep@latest drafts collect --run-id "$RUN_ID" --schema curator-output > "$PROPOSALS"
```

`drafts collect` reads every `${RUN_ID}__*.draft.json`, validates each batch against `curator-output`, concatenates the survivors into the JSON array on stdout (captured into `$PROPOSALS`), appends `validated`/`invalid` events to each batch's `.jsonl`, and reports skipped batches on stderr — never aborting on one bad batch. `$PROPOSALS` is then ready for Step 4; skip Step 3's re-mint. The single `curate-dedup` call in Step 4 runs once across every surviving batch's actions — identical to today.

#### Inline path (fallback)

If no sub-agent dispatch primitive is available, draft sequentially in this session — the shipped behaviour. For each batch:

1. `Read` every session file in the batch in full.
2. Each session's frontmatter `proposals:` block contains `practice: [...]` and `map: [...]` arrays. Each entry has `{ type, tags, title, description, body, kk_confidence }`.
3. For each candidate (practice and map, in order), decide an action: **add**, **modify**, **contradict**, or **drop**. Use the rules below. Use `candidate_origin = "<session_id>:<practice|map>:<index>"` where `<index>` is the zero-based position within its array.
4. Build the action object (schema below) and append to your in-session list of all actions across all batches.

Keep accumulating across batches until every batch is processed.

### Action rules

#### `add` — new knowledge

Use when the candidate is genuinely new and you have no strong signal that an existing knowledge base node already covers the same scope. When a candidate appears to overlap an existing node, prefer `drop` over `add`.

Signs an addition is correct:
- The topic is new to the knowledge base.
- The candidate has unique content (rationale, scope, examples) that isn't elsewhere.
- Existing related nodes are about adjacent things, not this thing.

The wrapper derives the slug from the title and auto-suffixes (`-2`, `-3`, …) if it would collide on disk — but if you sense a real overlap, prefer **drop** (or, when the candidate refines the existing node, **modify**).

An `add` also carries a **home branch**: the existing folder under `nodes/` where the leaf lives. You pick it in the same reasoning pass that sets `kk_relates_to` / `kk_depends_on` (see "Relate and place" below) and record it on the action's `home_folder` field. Leave `home_folder` unset/null/empty to land the leaf at the `nodes/` root (the root fallback).

#### `modify` — refines an existing node

Use when an existing node already covers this topic, but the candidate extends or refines it without negating it.

Signs a modification is correct:
- An existing node has the same scope (same convention, same module, same gotcha) but the candidate adds: an updated example, expanded rationale, a newly-supported case, a missing detail, or a clarification.
- The two are compatible (both can be true at the same time).
- The candidate's content is genuinely new relative to the existing body, not just a rephrasing.

A modification overwrites the existing leaf in place at its current path by id (`nodes/<...>/<target_node_id>.md`, wherever it currently lives in the tree) with the merged content; it never relocates the leaf and never sets `home_folder`. `target_node_id` is required and must already exist on disk; if it doesn't, the persistence step (`node write`) will create a fresh node instead, which is **not** what `modify` intends, so verify the target exists by `Glob`ing `nodes/` (or reading the relevant branch `index.md`) before emitting a `modify` action.

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

A contradiction does not modify any node file. The dedup primitive writes the conflict to `.ai/kenkeep/conflicts/<id>.md`; the conflict-resolution flow (step 7 below) walks each file and asks the user. Make your `proposed_node` and `rationale` complete enough that the user can decide without re-running you.

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
4. **Root fallback.** If no existing folder clears your relevance bar, leave `home_folder` unset/null/empty. The writer then places the leaf at the `nodes/` root. This is a deliberate, visible outcome, not an error; a later rebalance pass relocates it. Never force a weak fit just to avoid the root.

`modify`, `contradict`, and `drop` never set `home_folder`. A `modify` (dedupe-update) rewrites the existing leaf in place at its current path by id, with no folder argument and no relocation.

### Constraints (apply to every action)

- **Never cross the practice/map boundary.** A practice candidate never becomes a map node, and vice versa.
- **Never overwrite an unrelated node.** `modify` must target a node whose scope genuinely matches the candidate; otherwise prefer `add` (with `kk_relates_to`) or `contradict`.
- **Be conservative.** When uncertain between add and modify, prefer modify (less duplication). When uncertain between modify and drop, prefer drop (less noise).
- **Never change tree structure during curation.** The curation step (drafting and persisting leaves, Steps 2 to 6) places a leaf into an existing folder; it never creates, splits, or merges folders or branches. The only structural outcome curation may produce is the root fallback (a leaf at the `nodes/` root). Structural changes happen only in the final rebalance phase (Step 6b), and only when the deterministic trigger fires.

### Action object schema

Each action conforms to `CuratorActionSchema`; an array of them is the `curator-output` contract. Get the exact shape from the CLI rather than re-deriving it, and validate before dedup:

- `npx --yes kenkeep@latest schema curator-output` prints the JSON Schema (the action object and its nested `proposed_node`).
- After you assemble `$PROPOSALS`, run `npx --yes kenkeep@latest validate curator-output "$PROPOSALS"`; on a non-zero exit, read the path-referenced errors, fix the offending action(s), and re-validate until it passes.

The operative semantics stay above and are yours to apply: which action to choose (add/modify/contradict/drop), the end-state rewrite rule, tightest-scope contradiction, and `home_folder` placement — only `add` sets `home_folder`; `modify`, `contradict`, and `drop` omit it, and `proposed_node` is `null` only for `drop`. The schema enforces the rest, including rejecting any unknown `proposed_node` key.

## 3. Write the proposals tmpfile

`$RUN_ID` was minted at the top of Step 2 and is reused here. Mint `$SURVIVORS`, and `$PROPOSALS` if Step 2's collector did not already mint and populate it:

```bash
SURVIVORS=$(mktemp -t kk-curate-survivors.XXXXXX.json)
# Only run the next two lines if you came through the inline path:
PROPOSALS=$(mktemp -t kk-curate-proposals.XXXXXX.json)
# Then Write your accumulated actions array (JSON array, top-level) to $PROPOSALS.
```

If you came through the **parallel path**, `$PROPOSALS` already contains the concatenated, schema-validated actions array (`drafts collect` validated it) — skip ahead to Step 4. If you came through the **inline path**, `Write` your accumulated actions array (a JSON array, top-level) to `$PROPOSALS` now, then validate it: `npx --yes kenkeep@latest validate curator-output "$PROPOSALS"`. Fix any path-referenced errors and re-validate until it passes before Step 4.

## 4. Dedup and stamp via the primitive

Invoke `curate-dedup`:

```bash
npx --yes kenkeep@latest curate-dedup \
  --input "$PROPOSALS" --output "$SURVIVORS" --run-id "$RUN_ID"
```

Dedupe ranges over the whole tree: existing leaves are read from every folder under `nodes/` (at any depth), so a duplicate is matched wherever it currently lives. The behavior is unchanged from a flat space; only the search surface is the whole tree. A duplicate updates the existing leaf in place at its current path by id (a `modify`), with no relocation.

This single call atomically:

- Dedups your actions (cross-batch overlaps collapse; higher confidence wins). A surviving `add` keeps its `home_folder` through dedup untouched.
- Mints `${RUN_ID}-N` conflict ids for each surviving `contradict` action and writes `.ai/kenkeep/conflicts/<id>.md` files.
- Stamps `curator_processed_at` / `curator_run_id` into every pending session log it consumed.
- Writes the non-conflict survivors (the actions you still need to persist as nodes) to `$SURVIVORS`.

It prints one line of JSON on stdout:

```
{"kept":N,"conflicts":M,"stamped":K,"runId":"..."}
```

Capture and report these numbers to the user.

## 5. Persist surviving actions via `curate-persist`

Persist `$SURVIVORS` in one pass with the deterministic primitive — the same primitive `kk-session-extract` uses — instead of a hand-rolled `node write` loop:

```bash
npx --yes kenkeep@latest curate-persist --input "$SURVIVORS"
```

`curate-persist` validates the survivors against the curator-output contract, then for each action writes `add`/`modify` via the shared node writer (an `add` lands in its `home_folder`, or the `nodes/` root fallback when none was chosen; a `modify` rewrites in place at the target's current path by id and never relocates), skips `drop`, and rejects `contradict` (conflicts belong to `curate-dedup`). It prints one JSON summary on stdout (`written`, `dropped`, `failed`, and per-action `results` with the resolved id and placement) and exits non-zero only when the input is malformed or at least one valid action failed — successful writes are preserved either way.

Capture the summary: you report the per-leaf placement (`home_folder`, or `root fallback`) and any per-action failures in Step 7. A `modify` whose `target_node_id` was missing on disk surfaces as a failed action in the results — call it out so the user knows the update did not land.

## 6. Rebuild the indices

After all writes:

```bash
npx --yes kenkeep@latest index rebuild
```

## 6b. Rebalance (final phase, act-and-fold)

This is the last phase of curate and the only place tree structure changes. It folds in here: no second command, no second nudge. Run it after the leaves are written and the indices rebuilt (Step 6), before reporting.

### 6b.1 Run the deterministic trigger

The trigger is deterministic and LLM-free: it reads Plan 1's per-folder occupancy / tag-diversity / leaf-size metrics, applies the hysteresis-gated decision rules, and prints a stable JSON decision. Run it and capture stdout:

```bash
npx --yes kenkeep@latest rebalance trigger
```

It prints exactly one JSON line:

```
{"actions":[{"branch":"<path>","operation":"<split-folder|split-leaf|merge|create-branch>"}, ...]}
```

**Skip path (zero added cost).** If `actions` is empty (`{"actions":[]}`), the tree is balanced past the hysteresis margin. Do **not** enter the LLM clustering step at all. Record "rebalance: no structural action" for the Step 7 summary and proceed to Step 7. This is the common case; most curate runs trip nothing and end exactly as they do today.

**Act path.** If `actions` is non-empty, continue to 6b.2. Reason only over the branches the trigger named; never widen the scope.

### 6b.2 Propose structural operations on the affected branches only

For each entry in `actions`, read only that branch (the named folder's `index.md` and its leaves, or the named leaf for `split-leaf` / `create-branch`) and decide a concrete operation. This is the only non-deterministic step in the whole run; it is quarantined behind the deterministic trigger and the human's commit gate. Do not touch any branch the trigger did not name.

Map each operation class to a concrete plan entry. For every NEW folder an operation creates, also author a one-line folder `summary`: a noun phrase / sentence fragment that completes `for more information on <summary>` (lowercase start, no trailing period, concise). Make it task-keyed, not just structural: after naming what lives in the folder, append a short `; read when <task pattern>` clause naming the tasks that should trigger descent (e.g. `the five harness adapters and their isolation rules; read before adding a harness or changing hook wiring`). Agents route by matching their task against these summaries, so the trigger clause is what makes descent reliable. The move primitive stamps it into the new folder's folder-summary sidecar, and every later deterministic rebuild self-preserves it; it is what the parent index splices into its `Load …` descent pointer.

- **split-folder** (`branch` is an over-full folder): cluster that folder's direct leaves into two or more topical subfolders. Emit `{"operation":"split-folder","branch":"<folder>","groups":[{"subfolder":"<name>","summary":"<fragment>","ids":["<id>", ...]}, ...]}`. Every id must be a current direct leaf of `branch`; assign each leaf to exactly one subgroup; author one `summary` per subfolder.
- **merge** (`branch` is a sparse/redundant folder): pick the best existing destination folder `into` (a sibling or parent whose topic subsumes the sparse branch; empty string for the `nodes/` root). Emit `{"operation":"merge","branch":"<folder>","into":"<destination>"}`. A merge creates no folder, so it authors no `summary`; the destination keeps its own self-preserved summary.
- **create-branch** (`branch` is a homeless root leaf, a novel top-level topic): choose a new top-level folder name and the leaves that belong in it. Emit `{"operation":"create-branch","folder":"<new-top-level>","summary":"<fragment>","ids":["<id>", ...]}`.
- **split-leaf** (`branch` is one bloated leaf covering two or more concepts): carve it into two or more new sub-documents under a folder named for the leaf. Emit `{"operation":"split-leaf","leafId":"<old-id>","folder":"<folder>","summary":"<fragment>","children":[{"title":"...","summary":"...","body":"...","tags":["..."],"relates_to":["..."]}, ...]}` with at least two children. The top-level `summary` describes the new folder; each child carries its own leaf `summary`. The primitive mints new ids and records a redirect from the old id; do not author ids.

Assemble all entries into one operation plan: `{"operations":[ ... ]}`. Write it to a tmpfile:

```bash
REBAL_PLAN=$(mktemp -t kk-rebalance-plan.XXXXXX.json)
# Write your {"operations":[...]} plan to $REBAL_PLAN.
```

### 6b.3 Apply the moves deterministically

Hand the plan to the deterministic move primitive. It applies every move as a content-byte-stable, id-stable git rename (split-leaf mints new ids plus a redirect), then runs the deterministic rebuild of the affected index nodes and `nodes_hash`. Do **not** relocate files or regenerate indexes by hand.

```bash
npx --yes kenkeep@latest rebalance move --input "$REBAL_PLAN"
```

It prints one JSON line, the structural summary you carry into Step 7:

```
{"moves":[{"operation":"...","id":"...","from":"...","to":"...","newIds":["..."],"redirectFrom":"..."}, ...]}
```

Capture it. Do not commit, add, or restore anything: the structural moves and the curation leaf writes now sit together in one uncommitted working-tree diff. The human accepts by `git commit` and rejects just the structural moves by path-scoped `git restore`.

## 7. Report the summary, then handle conflicts

Tell the user the headline numbers (`kept`, `conflicts`, `stamped`, `runId`), the count of nodes written, and the count of drops. Also list the **placement decision per written leaf**: for each `add` you persisted, report its id and the folder it landed in (the chosen `home_folder`, or `root fallback` when none was chosen); for each `modify`, note it was updated in place at its current path. This lets the human review placement alongside content.

**No-op is a correct outcome.** When `nodes_written == 0` (every candidate was dropped), the knowledge base was already current — say so plainly ("no changes; the knowledge base is current") rather than apologising for an empty write set. An empty write set is the preferred result when nothing proposed real new information.

**Structural summary (rebalance).** Then print the structural summary from the rebalance phase (Step 6b), distinct from and additional to the content summary above so the human gets a legend for the structural diff:

- If 6b.1 reported no action, print one line: `Rebalance: no structural action (tree balanced).`
- Otherwise, for each move in the `{"moves":[...]}` summary, print one line naming the operation and the affected branch: a `split-folder` / `merge` / `create-branch` shows `<id>: <from> -> <to>`; a `split-leaf` shows `<old-id> -> <new-id>, <new-id>, ... (redirect recorded)`. Close with: `Review the structural diff with \`git diff --summary\` (R entries are renames); accept by \`git commit\`, reject just the structural moves with a path-scoped \`git restore\`.`

**If `conflicts == 0`**, print the placement lines, the structural summary, and then exactly one summary line, and stop:

```
Curated <nodes_written> nodes; <drops> dropped; no conflicts. Review the written files under .ai/kenkeep/nodes/.
```

Otherwise, proceed to step 7a.

### 7a. Prepare the pending conflicts

Run the deterministic primitive once to get the pending conflicts in presentation order, each with its computed default reply:

```bash
npx --yes kenkeep@latest conflict prepare
```

It reads the pending conflict files, sorts/groups them (by `target_node_id` with `null` last, then `proposed_kind`, then `detected_at`; consecutive conflicts sharing a non-null `target_node_id` form a group), computes each conflict's default reply with the diff-ratio rules, and prints `{"count":N,"conflicts":[...]}`. Each conflict carries `id`, `target_node_id`, `proposed_title`, `proposed_confidence`, `rationale`, `proposed_body`, `group_id`, `first_in_group`, the resolved `existing` node (rendered once per group on `first_in_group`), and the recommended `default` (`y`/`n`/`s`). Walk `conflicts` in the given order; the defaults are recommendations, not determinations.

### 7b. Present each conflict

For every conflict in the prepared list:

1. If `first_in_group` and `existing` is non-null, show the existing node's `title`, `description`, and the relevant body excerpt ONCE for the group.
2. Show the proposed contradiction concisely: `proposed_title`, `proposed_confidence`, the `rationale`, and the `proposed_body`.

(`s` is the safe default whenever there is no existing node to diff against; the primitive already encodes that.)

### 7d. Ask the user and parse the reply

Ask the user with the default highlighted, e.g.:

```
Accept this proposal? [Y/n/s/k] (default: Y)
```

Capitalize the default letter in the bracket group so it is visually obvious.

Parse the reply with these rules:

- Empty, `y`, `Y`, `yes` → take `y`.
- `n`, `N`, `no` → take `n`.
- `s`, `S`, `skip` → take `s`.
- `k`, `K`, `keep` → take `k`.
- Anything else → re-prompt the SAME conflict with the same default highlighted. Do not infer intent from prose like "looks good", "yes please", or "skip this one"; require one of the listed tokens. An empty reply takes the default.

### 7e. Apply the outcome

Map the chosen reply to actions:

- `y` (Accept proposal): rewrite the existing `target_node_id` node in place at its current path — `Glob` `nodes/**/<target_node_id>.md` to locate it (placement is topical) — with the proposed body and frontmatter (use `node write` against the existing `target_node_id` as the slug, which updates in place by id, or `Write` directly to the resolved path if you have the full frontmatter assembled), then `rm .ai/kenkeep/conflicts/<id>.md`.
- `n` (Reject proposal): `rm .ai/kenkeep/conflicts/<id>.md`. The existing node is unchanged.
- `s` (Skip): leave the conflict file alone. It re-surfaces on the next curate pass with `status: pending` intact. Do not edit or delete the file.
- `k` (Keep as record): leave the conflict file on disk as a historical record for later review. The existing node is unchanged. Use this rarely.

After every conflict in a group is decided, move to the next group.

## 8. Hand off

Tell the user to review the changed nodes and conflict files under `.ai/kenkeep/`. `ENTRY.md` and `GRAPH.md` were refreshed in step 6 (and again by the rebalance move primitive if the rebalance phase acted). Any structural moves from Step 6b sit in the same uncommitted diff; the human accepts everything by `git commit` or rejects just the structural moves with a path-scoped `git restore`.

## Constraints

- The reply contract for conflict resolution is strictly `y`/`n`/`s`/`k` (or their long forms / empty for default). Do not accept paraphrased prose as an answer — re-prompt instead.
- If no session logs are pending, short-circuit at step 1 with the one-line message. Do not invoke any primitive.
- If `.ai/kenkeep/conflicts/` is empty or every file has `status` other than `pending`, there's nothing to resolve; the fast-path message in step 7 already covers it.
- Rebalance (Step 6b) runs only as the final phase of curate; it is never a separate command or nudge. When `rebalance trigger` reports `{"actions":[]}`, skip the LLM clustering step entirely (zero added cost) and report no structural action. When it fires, reason only over the branches it names, never widen the scope, and apply moves only through the `rebalance move` primitive. Never relocate files or regenerate indexes by hand, and never `git add`, `git commit`, or `git restore` anything.
- The dedup primitive is non-locking and idempotent on a fresh `runId` — but do not re-run it with the same `$PROPOSALS` and a different `runId`; that double-stamps consumed sessions and double-writes conflict files. One `curate-dedup` call per session.
