---
name: kb-curate
description: Curate pending session logs into knowledge-base nodes by running the `npx @e0ipso/ai-knowledge-base curate` CLI, then resolve any contradictions surfaced by the curator with the user in-session. Use when the user wants to process accumulated session captures, or when the SessionStart nudge reports pending session logs.
---

# kb-curate

Run the curator over pending session logs and apply its decisions directly to `nodes/`, then resolve any contradictions interactively with the user.

## Resolve the active harness

Substitute your own best-guess id for `<hint>` based on the runtime you are running inside (one of `claude`, `codex`, `cursor`, `opencode`). Run the materialization block exactly as-is (it lazy-writes `/tmp/kb-detect-harness.mjs` on first invocation):

```bash
if [ ! -f /tmp/kb-detect-harness.mjs ]; then
cat << 'EOF' > /tmp/kb-detect-harness.mjs
#!/usr/bin/env node
// kb-detect-harness: resolves the active KB harness id.
// Mirrors src/harnesses/detect.ts resolveWithHint priority.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const REGISTERED = ['claude', 'codex', 'cursor', 'opencode'];
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
    if (existsSync(join(dir, '.ai', 'knowledge-base'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function readDefault(root) {
  if (!root) return undefined;
  const config = join(root, '.ai', 'knowledge-base', 'config.yaml');
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
process.stderr.write('kb-detect-harness: could not resolve. Pass --hint <id> or set cliDefaultHarness in .ai/knowledge-base/config.yaml.\n');
process.exit(2);
EOF
fi
HARNESS=$(node /tmp/kb-detect-harness.mjs --hint <hint>)
```

## 1. Run the curator

Run `npx --yes @e0ipso/ai-knowledge-base@latest curate --harness "$HARNESS"` in the project root. The command:

- Acquires the curator lock (`.ai/knowledge-base/.state/state.json`, name=`curator`, PID + 30-min TTL).
- Batches every session log whose `proposal_status: done` and which has not yet been curated.
- Spawns the curator subprocess per batch with the curator prompt (no recursion: `KB_BUILDER_INTERNAL=1`).
- Writes node files directly to `.ai/knowledge-base/nodes/<kind>/` for `add` and `modify` actions.
- Writes one markdown file per `contradict` action to `.ai/knowledge-base/conflicts/<id>.md` **without writing the conflicting node to disk**.
- Regenerates `INDEX.md` and `GRAPH.md` from the resulting `nodes/` tree.

Capture the curator's stdout: it logs the headline numbers (`Curator finished: N node(s) written, M drop(s) over K batch(es).`, the `Run id: <runId>`, any `conflict(s) need resolution` warning, and a `failure(s)` list when `add_collision` or `modify_missing_target` fired). You will read those numbers in step 2.

## 2. Report the summary

After the curator returns, IF `conflicts == 0` AND `failures.length == 0`, print exactly one line and stop. Skip every step below:

```
Curated <nodes_written> nodes; <drops> dropped; no conflicts. Review with: git diff .ai/knowledge-base/
```

Otherwise, tell the user the curator's headline numbers (nodes written, drops, batches, run id). If the curator reported any failures (`add_collision` or `modify_missing_target`), surface each one verbatim with its `reason` and `detail` so the user knows what needs manual cleanup. Then proceed to step 3.

## 3. Resolve pending conflicts

List every markdown file under `.ai/knowledge-base/conflicts/`. For each file, read its frontmatter; keep only files whose `status` is `pending`. If no pending files remain after filtering, skip this section.

### 3a. Sort and group

Sort the pending conflict files by:

1. `target_node_id` (alphabetic; files whose `target_node_id` is `null` group last).
2. `proposed_kind`.
3. `detected_at`.

Iterate in that order. Two consecutive conflicts that share the same non-null `target_node_id` form a group: show the existing node ONCE at the top of the group, then walk each proposed contradiction within the group asking `y`/`n`/`s`/`k` per conflict. Conflicts with `target_node_id: null` are walked individually (no shared existing node to show).

### 3b. Present each conflict

For every pending conflict:

1. Read the conflict file. The frontmatter exposes `id`, `status`, `target_node_id`, `proposed_kind`, `proposed_title`, `proposed_confidence`, `candidate_origin`, `run_id`, and `detected_at`. The body has two sections: `## Rationale` and `## Proposed node`.
2. If `target_node_id` is set and this is the first conflict in its group, read `nodes/<proposed_kind>/<target_node_id>.md` and show its title, summary, and the relevant body excerpt ONCE.
3. Show the proposed contradiction concisely: `proposed_title`, `proposed_confidence`, the rationale, and the proposed body.

### 3c. Compute the default

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

### 3d. Ask the user and parse the reply

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

### 3e. Apply the outcome

Map the chosen reply to actions:

- `y` (Accept proposal): rewrite `nodes/<proposed_kind>/<target_node_id>.md` with the proposed body and frontmatter, then tell the user to `git restore .ai/knowledge-base/conflicts/<id>.md`. The user reviews the node change with `git diff` and commits.
- `n` (Reject proposal): tell the user to `git restore .ai/knowledge-base/conflicts/<id>.md`. The existing node is unchanged.
- `s` (Skip): leave the conflict file alone. It re-surfaces on the next curate pass with `status: pending` intact. Do not edit or delete the file.
- `k` (Keep as record): tell the user to `git commit` the conflict file. The existing node is unchanged. Use this rarely — it preserves the disagreement as a historical record for later review.

After every conflict in a group is decided, move to the next group.

## 4. Hand off

Tell the user to review the changed nodes and conflict files with `git diff .ai/knowledge-base/` and commit when they're satisfied. The curator already regenerated `INDEX.md`/`GRAPH.md` at end-of-run; if the user has a pre-commit hook wired up (see the installation docs), `npx @e0ipso/ai-knowledge-base index rebuild --harness "$HARNESS" --stage` keeps them aligned on subsequent hand edits.

## Constraints

- The curator wrapper writes directly to `nodes/`. Conflict resolution edits `nodes/` only when the user accepts a proposal (`y`); the conflict files themselves are reviewed via `git diff` and accepted with `git commit` (`k`) or discarded with `git restore` (`y` or `n`).
- The reply contract is strictly `y`/`n`/`s`/`k` (or their long forms / empty for default). Do not accept paraphrased prose as an answer — re-prompt instead.
- If the curate command reports `locked`, do not retry; explain that another curate run is in progress.
- If no session logs are pending, the command still regenerates INDEX/GRAPH; that's expected, not an error.
- If `.ai/knowledge-base/conflicts/` is empty or every file has `status` other than `pending`, there's nothing to resolve; the fast-path guard in step 2 already short-circuited the run.
