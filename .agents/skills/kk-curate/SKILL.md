---
name: kk-curate
description: Curate pending session logs into kenkeep nodes by reading sessions in-host, drafting curator actions, then deduping and persisting via the kenkeep primitives. Resolves any surfaced contradictions interactively with the user. Use when the user wants to process accumulated session captures, or when the SessionStart nudge reports pending session logs.
---

<!-- Version: 1 -->

# kk-curate

You are the curator. Read pending session logs in this session, decide an action per candidate, run a single dedup pass via the CLI primitive, persist surviving actions via `node write`, regenerate indices, and resolve any surfaced contradictions interactively with the user. There is no sub-agent and no runner — **you** are the LLM doing the curation.

## Resolve the active harness

Substitute your own best-guess id for `<hint>` based on the runtime you are running inside (one of `claude`, `codex`, `copilot`, `cursor`, `opencode`). Run the materialization block exactly as-is (it lazy-writes `/tmp/kk-detect-harness.mjs` on first invocation):

```bash
if [ ! -f /tmp/kk-detect-harness.mjs ]; then
cat << 'EOF' > /tmp/kk-detect-harness.mjs
#!/usr/bin/env node
// kk-detect-harness: resolves the active knowledge base harness id.
// Mirrors src/harnesses/detect.ts resolveWithHint priority.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const REGISTERED = ['claude', 'codex', 'copilot', 'cursor', 'opencode'];
const ENV_DETECTORS = [
  { env: 'CURSOR_VERSION', value: '*nonempty*', harness: 'cursor' },
  { env: 'CLAUDECODE', value: '1', harness: 'claude' },
];
function findHint(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--hint' && i + 1 < argv.length) return argv[i + 1];
  }
  return undefined;
}
function detectFromEnv(env) {
  if (env.CLAUDECODE === '1') return 'claude';
  for (const d of ENV_DETECTORS) {
    if (d.value === '*nonempty*') {
      if (typeof env[d.env] === 'string' && env[d.env].length > 0) return d.harness;
    } else if (env[d.env] === d.value) return d.harness;
  }
  return undefined;
}
function findRepoRoot(start) {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, '.ai', 'kenkeep'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function readDefault(root) {
  if (!root) return undefined;
  const config = join(root, '.ai', 'kenkeep', 'config.yaml');
  if (!existsSync(config)) return undefined;
  const text = readFileSync(config, 'utf8');
  const m = text.match(/^cliDefaultHarness:\s*(\S+)/m);
  return m ? m[1] : undefined;
}
const hint = findHint(process.argv.slice(2));
if (hint && REGISTERED.includes(hint)) { process.stdout.write(hint); process.exit(0); }
const fromEnv = detectFromEnv(process.env);
if (fromEnv) { process.stdout.write(fromEnv); process.exit(0); }
const fromDefault = readDefault(findRepoRoot(process.cwd()));
if (fromDefault && REGISTERED.includes(fromDefault)) { process.stdout.write(fromDefault); process.exit(0); }
process.stderr.write('kk-detect-harness: could not resolve. Pass --hint <id> or set cliDefaultHarness in .ai/kenkeep/config.yaml.\n');
process.exit(2);
EOF
fi
HARNESS=$(node /tmp/kk-detect-harness.mjs --hint <hint>)
```

`$HARNESS` is not consumed by `curate-dedup` or `node write`, but `index rebuild` requires it.

## 0. Extract proposals from pending session logs

For each session log with `proposal_status: pending`, extract proposals inline in this session before curation begins.

1. **List pending session logs.** Use `Glob` (or `ls`) to list `.ai/kenkeep/_sessions/*.md`. For each file, `Read` its frontmatter and filter for `proposal_status: pending`. Sort by `captured_at` ascending.

2. **Short-circuit.** If none are pending, proceed to Step 1 with no message.

3. **Load the extraction prompt.** Read `.ai/kenkeep/.config/prompts/proposal-extract.md` first (per-repo override). If that file does not exist, read the bundled package template at `templates/prompts/proposal-extract.md` (relative to the installed npm package). Follow the prompt's extraction rules — do not embed a copy here.

4. **Process each pending log sequentially** (in `captured_at` order). Failure on one log does not abort the rest:
   a. Read the file in full.
   b. Extract the transcript section (content between `## Transcript` and `## Proposal`).
   c. Apply the extraction rules from the prompt to produce a JSON object matching `ProposalOutputSchema`: `{ "practice": [...], "map": [...] }` where each entry has `{ kind, tags, title, summary, body, confidence }`.
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

Probe your own tool surface. If your runtime exposes a primitive that delegates work to a sub-agent / task running in a separate context window, take the **parallel path**. Otherwise, take the **inline path**. Do not invent a primitive that does not exist — if your only "delegation" option is recursion into yourself or shelling out to a host binary in `-p` mode, that does **not** count, and you take the inline path.

The probe and the fallback are the same decision: make it once here, before issuing any batch, so you cannot end up in a half-state.

#### Parallel path (preferred when available)

For each batch `N` of ≤10 sessions, dispatch one sub-agent. Cap concurrency at **5 sub-agents per orchestrator turn**: if `N > 5`, issue the first 5 in one assistant turn, await all results, then issue the next wave. Rationale: the reference runtime documents a ~10 concurrent ceiling; staying at 5 leaves headroom for the host's own tool calls and bounds rate-limit risk.

Before dispatching batch `N`, append one JSON line to `.ai/kenkeep/_logs/curator/${RUN_ID}__${N}.jsonl`:

```bash
N=1  # batch index
DRAFT_PATH="$(pwd)/.ai/kenkeep/_logs/curator/${RUN_ID}__${N}.draft.json"
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"issued\",\"runId\":\"${RUN_ID}\",\"batchN\":${N},\"sessions\":<count>}" \
  >> .ai/kenkeep/_logs/curator/${RUN_ID}__${N}.jsonl
```

`DRAFT_PATH` is **absolute** — sub-agents run in their own contexts and may not share the host's cwd.

Each sub-agent receives instructions like the following (inline the rule restatement so the sub-agent does not need to re-read this file):

> You are drafting curator actions for ONE batch of pending session logs.
> - The batch contains these session files at absolute paths: `<list>`.
> - Read every file in full. Each session's frontmatter `proposals:` block has `practice: [...]` and `map: [...]` arrays whose entries are `{ kind, tags, title, summary, body, confidence }`.
> - For each candidate (in array order), decide one action and build a `CuratorAction` object. Use `candidate_origin = "<session_id>:<practice|map>:<index>"` (zero-based).
> - Action rules (full headings in the parent skill's "Action rules" subsection; the one-line restatement below is sufficient for batch drafting):
>     - **add**: candidate is genuinely new; no existing node already covers its scope. `target_node_id: null`.
>     - **modify**: an existing node covers the same scope and the candidate refines it without negating it; verify `target_node_id` exists on disk first; rewrite the merged body in present-tense end-state (no "previously…" prose).
>     - **contradict**: candidate directly negates an existing valid node (both cannot be true at the same scope); set `target_node_id` to the tightest-scope match.
>     - **drop**: near-rephrasing, low-signal, general programming knowledge, change-oriented framing, maintenance/lifecycle actions, project story or any plan/ticket/issue reference, incidental one-off facts dressed up as practices, or non-productive provenance signals; `target_node_id: null`, `proposed_node: null`.
> - Hard constraints: never cross the practice/map boundary; `proposed_node` keys are exactly `title|kind|tags|summary|body|confidence|relates_to` (any other key will be rejected downstream).
> - Write the actions as a JSON array (top-level) to the absolute path `<DRAFT_PATH>`. The file must contain exactly the JSON array, nothing else.
> - Return the path on success.

After every sub-agent returns, the **collector turn** runs entirely in the orchestrator's context:

1. For each batch `N`, read its draft file and parse it as JSON.
2. If parsing fails OR the result is not an array OR any element has unknown keys in `proposed_node` (the schema requires exactly `title|kind|tags|summary|body|confidence|relates_to`), surface to the user: `batch N produced invalid output, skipped`, append a `{"event":"invalid", ...}` line to that batch's `.jsonl`, and continue. **Never abort the run** — partial progress across surviving batches is more valuable than re-running everything.
3. For each valid batch, append a `{"event":"validated","count":<n>}` line to its `.jsonl`, then concatenate its actions into a single in-memory array.
4. Mint `$PROPOSALS` now (Step 3's `mktemp` is shared between paths — on the parallel path, do it here, then skip the re-mint in Step 3) and write the concatenated array to it so the rest of the skill is unchanged. A concise idiom:

   ```bash
   PROPOSALS=$(mktemp -t kk-curate-proposals.XXXXXX.json)
   PROPOSALS="$PROPOSALS" RUN_ID="$RUN_ID" node -e "
     const fs = require('fs'), path = require('path');
     const dir = '.ai/kenkeep/_logs/curator';
     const prefix = process.env.RUN_ID + '__';
     const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.draft.json'));
     const all = [];
     for (const f of files) {
       try {
         const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
         if (Array.isArray(arr)) all.push(...arr);
         else process.stderr.write('batch ' + f + ' invalid: not an array\n');
       } catch (e) { process.stderr.write('batch ' + f + ' invalid: ' + e.message + '\n'); }
     }
     fs.writeFileSync(process.env.PROPOSALS, JSON.stringify(all));
   "
   ```

   Any equivalent concatenation idiom is fine; the contract is `$PROPOSALS` contains the JSON array of all surviving batches' actions, ready for Step 4.

The single `curate-dedup` call in Step 4 then runs once across every surviving batch's actions — identical to today.

#### Inline path (fallback)

If no sub-agent dispatch primitive is available, draft sequentially in this session — the shipped behaviour. For each batch:

1. `Read` every session file in the batch in full.
2. Each session's frontmatter `proposals:` block contains `practice: [...]` and `map: [...]` arrays. Each entry has `{ kind, tags, title, summary, body, confidence }`.
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

#### `modify` — refines an existing node

Use when an existing node already covers this topic, but the candidate extends or refines it without negating it.

Signs a modification is correct:
- An existing node has the same scope (same convention, same module, same gotcha) but the candidate adds: an updated example, expanded rationale, a newly-supported case, a missing detail, or a clarification.
- The two are compatible (both can be true at the same time).
- The candidate's content is genuinely new relative to the existing body, not just a rephrasing.

A modification overwrites `nodes/<kind>/<target_node_id>.md` with the merged content. `target_node_id` is required and must already exist on disk; if it doesn't, the persistence step (`node write`) will create a fresh node instead, which is **not** what `modify` intends — so verify the target exists by reading `INDEX.md` (or `Glob`ing `nodes/<kind>/`) before emitting a `modify` action.

**End-state rewrite rule.** The merged body reads as the current state in present tense. Never append "previously…" or "earlier this used to…" paragraphs, and never narrate "the project moved from X to Y" inside the body. When the new candidate's information is a transition narrative, rewrite the existing node body so that only the new end-state claim remains visible. The knowledge base is the project's current state, not its changelog.

**Important:** if the candidate is essentially the same content as the existing node, just rephrased, **drop it** instead. Modifications must add real new information.

#### `contradict` — negates an existing node

Use when the candidate directly negates an existing valid node (they cannot both be true at the same time, in the same scope). The user later resolves the conflict in-session.

Signs a contradiction is real:
- The existing node says "always X" or "do X for case Y"; the candidate says "never X" or "don't do X for case Y."
- The user explicitly reversed a prior decision in the session that produced this candidate.
- The candidate's scope overlaps the existing node's scope completely, not partially.

**Important:** if the candidate's scope is a *subset* or *exception* to the existing node, this is NOT a contradiction; it's an addition (or modification) with `relates_to`. Example: if the existing node says "use the default cache tags," and the candidate says "for personalized pages, use per-user cache contexts instead," these can both be true — emit **add** with `relates_to: [<existing node id>]`, not `contradict`.

A contradiction does not modify any node file. The dedup primitive writes the conflict to `.ai/kenkeep/conflicts/<id>.md`; the conflict-resolution flow (step 7 below) walks each file and asks the user. Make your `proposed_node` and `rationale` complete enough that the user can decide without re-running you.

**Choosing `target_node_id`.** Point at the single existing node whose claim the candidate negates. If two existing nodes both overlap, pick the tightest scope match and mention the second in `rationale`; do not emit two `contradict` actions for the same candidate.

**Phrasing `rationale`.** State, in one or two sentences, which existing claim the candidate negates and why both cannot be true simultaneously. The reviewer reads this first.

**End-state body.** The `proposed_node.body` describes only the new end state in present tense. The reviewer who reads only the new node's body should see the current rule as if it had always been the rule.

#### `drop` — no change

Use when the candidate should not result in any change. Reasons to drop:

- It's a near-rephrasing of an existing node with no new information.
- The confidence is low and the content is vague.
- The candidate captured general programming knowledge, not project-specific.
- The candidate is internally inconsistent or refers to things that don't exist elsewhere.
- **Change-oriented framing** — transition narratives, migration stories, rename or removal logs, "we used to do X, now we do Y" wording. Automatic drop regardless of confidence. The knowledge base describes the project's current end state, not its history.
- **Maintenance or lifecycle actions** — version bumps, deprecations, releases, dependency updates, rebuilds, changelog edits ("we deprecated the old npm package"). The knowledge base records the current state, not the act that produced it. Automatic drop.
- **Project story or history, especially plan/ticket/issue references** — a candidate that names or links a plan, ticket, issue, work-order, or task id (e.g. "Plan 96 wire and fix serve UI interactions") is a red flag and an automatic drop. That history belongs in git, not the knowledge base.
- **Incidental facts disguised as practices** — a fact hit once while fixing a one-off problem, framed as a convention ("first publish requires a token"). A real practice is a rule the project deliberately and repeatedly follows; drop unless it is genuinely a standing principle.
- **Non-productive provenance signals** in the candidate body or summary:
  - hedged/tentative wording ("we might", "we could", "potentially", "the idea is to"). Practice nodes describe rules, not hypotheses.
  - references to hypothetical or unrealized entities ("the planned X", "once we add Z"). Map nodes describe what is.
  - plan- or task-scoped framing ("for this plan, we will…", "the success criterion is…").
  - low confidence + no rationale + no concrete example.

  Weigh these together; drop when the combined signature suggests a non-productive session. Single-signal cases do not auto-drop.

**Salvage rule for change-oriented, action, and story candidates.** When a candidate narrates a transition, a maintenance action, or project story but also conveys a clean durable principle or current-state fact (e.g. "we renamed `foo_service` to `bar_service`" plus "the service that fans out tracking events is `bar_service`"), extract that durable part and keep it via `add` or `modify`, rewritten as a standing rule or present-tense fact. When the entire candidate is the journey, the activity, or the history, drop the whole thing. The keep test: would this still be a deliberate operating principle or a current structural fact six months from now, independent of the activity that surfaced it?

### Constraints (apply to every action)

- **Never cross the practice/map boundary.** A practice candidate never becomes a map node, and vice versa.
- **Never overwrite an unrelated node.** `modify` must target a node whose scope genuinely matches the candidate; otherwise prefer `add` (with `relates_to`) or `contradict`.
- **Be conservative.** When uncertain between add and modify, prefer modify (less duplication). When uncertain between modify and drop, prefer drop (less noise).

### Action object schema

Each action you emit must conform to `CuratorActionSchema`:

```json
{
  "action": "add" | "modify" | "contradict" | "drop",
  "candidate_origin": "<session_id>:<practice|map>:<index>",
  "target_node_id": "<id-or-null>",
  "proposed_node": { /* see below; null for drop */ },
  "rationale": "why this action, in 1-3 sentences"
}
```

Field semantics by action:

| Field | add | modify | contradict | drop |
|---|---|---|---|---|
| `target_node_id` | `null` | required (must exist on disk) | required | `null` |
| `proposed_node` | required | required (merged) | required (new) | `null` |
| `rationale` | required | required | required | required |

The `proposed_node` object (for add/modify/contradict) has **exactly** these keys (no `id`, no `derived_from` — the wrapper stamps both):

- `title`: from candidate or refined
- `kind`: `"practice"` or `"map"`
- `tags`: array of relevant lowercase tags
- `summary`: ≤140 chars
- `body`: full markdown body (1–4 short paragraphs)
- `confidence`: `"low"` | `"medium"` | `"high"`
- `relates_to`: array of node ids this should link to (especially important for exception-style additions)

Any other key in `proposed_node` will be rejected by the dedup primitive's schema validation.

## 3. Write the proposals tmpfile

`$RUN_ID` was minted at the top of Step 2 and is reused here. Mint `$SURVIVORS`, and `$PROPOSALS` if Step 2's collector did not already mint and populate it:

```bash
SURVIVORS=$(mktemp -t kk-curate-survivors.XXXXXX.json)
# Only run the next two lines if you came through the inline path:
PROPOSALS=$(mktemp -t kk-curate-proposals.XXXXXX.json)
# Then Write your accumulated actions array (JSON array, top-level) to $PROPOSALS.
```

If you came through the **parallel path**, `$PROPOSALS` already contains the concatenated actions array — skip ahead to Step 4. If you came through the **inline path**, `Write` your accumulated actions array (a JSON array, top-level) to `$PROPOSALS` now. Either way, the array must validate against `CuratorOutputSchema` (an array of `CuratorAction`).

## 4. Dedup and stamp via the primitive

Invoke `curate-dedup`:

```bash
npx --yes kenkeep@latest curate-dedup \
  --input "$PROPOSALS" --output "$SURVIVORS" --run-id "$RUN_ID"
```

This single call atomically:

- Dedups your actions (cross-batch overlaps collapse; higher confidence wins).
- Mints `${RUN_ID}-N` conflict ids for each surviving `contradict` action and writes `.ai/kenkeep/conflicts/<id>.md` files.
- Stamps `curator_processed_at` / `curator_run_id` into every pending session log it consumed.
- Writes the non-conflict survivors (the actions you still need to persist as nodes) to `$SURVIVORS`.

It prints one line of JSON on stdout:

```
{"kept":N,"conflicts":M,"stamped":K,"runId":"..."}
```

Capture and report these numbers to the user.

## 5. Persist surviving actions via `node write`

Read `$SURVIVORS` (a JSON array of actions; each element is either `add`, `modify`, or `drop`). For each action that is **not** `drop`, persist it via `node write`. The `drop` actions are bookkeeping — no file is written, just log the count.

For each `add` or `modify`:

1. Derive the slug. For `add`: lowercase, hyphenated form of the title (e.g. `Use the bravo analytics dispatcher` → `use-the-bravo-analytics-dispatcher`). For `modify`: use the `target_node_id` verbatim as the slug.
2. Write the body to a tmpfile (so the heredoc handles multi-line content cleanly), or pipe it via `<<'EOF' … EOF` directly. Then:

   ```bash
   npx --yes kenkeep@latest node write <kind> <slug> \
     --title "<title>" --summary "<summary>" \
     --tags "<tag1,tag2,...>" --relates-to "<id1,id2,...>" \
     --confidence <high|medium|low> <<'EOF'
   <body markdown>
   EOF
   ```

   Do **not** pass `--source-doc` / `--source-hash` here — those flags exist for bootstrap's per-file hash map and do not apply to curated content.

3. Capture the printed id. For `modify`, the printed id should match `target_node_id`; if it does not (because the target was missing on disk and `ensureUniqueId` minted a fresh id), surface this as a warning — the modify was effectively an `add`, and the user should know.

On any non-zero exit from `node write`, surface the stderr to the user and continue with the next action. Do not retry blindly.

## 6. Rebuild the indices

After all writes:

```bash
npx --yes kenkeep@latest index rebuild --harness "$HARNESS"
```

## 7. Report the summary, then handle conflicts

Tell the user the headline numbers (`kept`, `conflicts`, `stamped`, `runId`), the count of nodes written, and the count of drops. **If `conflicts == 0`**, print exactly one line and stop:

```
Curated <nodes_written> nodes; <drops> dropped; no conflicts. Review the written files under .ai/kenkeep/nodes/.
```

Otherwise, proceed to step 7a.

### 7a. Sort and group pending conflicts

List every markdown file under `.ai/kenkeep/conflicts/`. For each, `Read` its frontmatter and keep only files whose `status` is `pending`.

Sort the pending conflict files by:

1. `target_node_id` (alphabetic; files whose `target_node_id` is `null` group last).
2. `proposed_kind`.
3. `detected_at`.

Iterate in that order. Two consecutive conflicts that share the same non-null `target_node_id` form a group: show the existing node ONCE at the top of the group, then walk each proposed contradiction within the group asking `y`/`n`/`s`/`k` per conflict. Conflicts with `target_node_id: null` are walked individually (no shared existing node to show).

### 7b. Present each conflict

For every pending conflict:

1. Read the conflict file. Frontmatter exposes `id`, `status`, `target_node_id`, `proposed_kind`, `proposed_title`, `proposed_confidence`, `candidate_origin`, `run_id`, `detected_at`. The body has two sections: `## Rationale` and `## Proposed node`.
2. If `target_node_id` is set and this is the first conflict in its group, read `nodes/<proposed_kind>/<target_node_id>.md` and show its title, summary, and the relevant body excerpt ONCE.
3. Show the proposed contradiction concisely: `proposed_title`, `proposed_confidence`, the rationale, and the proposed body.

### 7c. Compute the default

For each conflict, compute the default reply before asking the user:

1. `lines_changed` = number of lines that differ between the proposed body and the existing node body (diff at line granularity).
2. `total_lines` = `max(proposed body line count, existing body line count)`.
3. `ratio` = `lines_changed / total_lines`.

Apply these rules in order; stop at the first match:

- If `lines_changed < 5` AND `proposed_confidence == "high"` → default `y`.
- If `ratio > 0.5` → default `n`.
- Otherwise → default `s`.

If the conflict has no `target_node_id` (no existing node to diff against), default to `s`.

These defaults are recommendations, not determinations. Always show the user both sides before asking.

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

- `y` (Accept proposal): rewrite `nodes/<proposed_kind>/<target_node_id>.md` with the proposed body and frontmatter (use `node write` against the existing `target_node_id` as the slug, or `Write` directly if you have the full frontmatter assembled), then `rm .ai/kenkeep/conflicts/<id>.md`.
- `n` (Reject proposal): `rm .ai/kenkeep/conflicts/<id>.md`. The existing node is unchanged.
- `s` (Skip): leave the conflict file alone. It re-surfaces on the next curate pass with `status: pending` intact. Do not edit or delete the file.
- `k` (Keep as record): leave the conflict file on disk as a historical record for later review. The existing node is unchanged. Use this rarely.

After every conflict in a group is decided, move to the next group.

## 8. Hand off

Tell the user to review the changed nodes and conflict files under `.ai/kenkeep/`. `INDEX.md` and `GRAPH.md` were refreshed in step 6.

## Constraints

- The reply contract for conflict resolution is strictly `y`/`n`/`s`/`k` (or their long forms / empty for default). Do not accept paraphrased prose as an answer — re-prompt instead.
- If no session logs are pending, short-circuit at step 1 with the one-line message. Do not invoke any primitive.
- If `.ai/kenkeep/conflicts/` is empty or every file has `status` other than `pending`, there's nothing to resolve; the fast-path message in step 7 already covers it.
- The dedup primitive is non-locking and idempotent on a fresh `runId` — but do not re-run it with the same `$PROPOSALS` and a different `runId`; that double-stamps consumed sessions and double-writes conflict files. One `curate-dedup` call per session.
