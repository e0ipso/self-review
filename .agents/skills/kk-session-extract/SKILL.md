---
name: kk-session-extract
description: Extract durable knowledge from the current live session, stage it as a validated done session log, and run it through the same curation machinery as /kk-curate. Use when the user wants to proactively process the current session before waiting for capture hooks and a later curate pass — not for dictating one node (/kk-add) or batch-processing accumulated logs (/kk-curate).
---

<!-- Version: 6 -->

# kk-session-extract

Extract durable project knowledge from the **visible current session**, stage it as a normal `proposal_status: done` session log, and immediately run the shared curation tail. You operate in-host on the live context window — no headless harness spawn, no daemon.

**Routing:** use `/kk-add` when the user already knows the node; use `/kk-session-extract` when the current session just produced durable teaching moments; use `/kk-curate` when processing accumulated captured logs later.

**Partial context warning:** if compaction has occurred, the visible context may be incomplete. Describe your extraction as visible-context extraction, not full-session extraction, unless the runtime exposes the full transcript.

## Resolve the project root

Resolve the repo root (the directory containing `.ai/kenkeep`) with the shipped detector, then treat the printed path as the working directory for every command below:

```bash
KK_REPO_ROOT=$(node .ai/kenkeep/scripts/kk-detect-root.mjs) || exit $?
cd "$KK_REPO_ROOT" || exit $?
pwd
```

## 1. Extract proposals from the live context

1. **Load the extraction prompt.** Read `.ai/kenkeep/.config/prompts/proposal-extract.md` first (per-repo override). If that file does not exist, read the bundled package template at `templates/prompts/proposal-extract.md` (relative to the installed npm package). Follow the prompt's extraction rules — do not embed a copy here.

2. **Build a live transcript surrogate.** Construct a role-tagged transcript from the visible conversation in this session (user and agent turns you can still see). Strip any `<kk-private>…</kk-private>` spans before using the text.

3. **Substitute the placeholder.** Replace `[TRANSCRIPT PLACEHOLDER, substituted at runtime]` in the loaded prompt with your live transcript surrogate. If the placeholder is missing from the prompt, report an extraction failure and stop with no writes.

4. **Apply the prompt unchanged.** Produce a JSON object matching the strict `ProposalOutputSchema`: `{ "practice": [...], "map": [...] }` where each entry has only `{ type, tags, title, description, body, kk_confidence }`. Do not emit legacy `supports_existing_node` / `contradicts_existing_node` fields.

5. **Disposition gate.** If the session is meta-only, exploratory, abandoned, unrelated, or has no durable teaching moments, report that no durable knowledge was found and **stop** — no staging, no curation, no node writes. This is success, not failure.

## 2. Stage the live proposals

When extraction yields at least one candidate:

1. **Resolve session id.** Prefer the harness's live UUID-v4 session id when available. If you cannot obtain a valid UUID-v4, use `--generate-session-id` and report degraded idempotency to the user (a later capture may not match this log).

2. **Pipe validated JSON into the staging primitive:**

   ```bash
   echo '<json>' | npx kenkeep@latest session-log stage-live --session-id <uuid-v4>
   # or, when no live id is available:
   echo '<json>' | npx kenkeep@latest session-log stage-live --generate-session-id
   ```

3. **Capture the one-line JSON summary** printed on stdout (`path`, `session_id`, `idempotency`). Report degraded idempotency explicitly when `idempotency` is `degraded`.

The staged log lives under `.ai/kenkeep/_sessions/` with `proposal_status: done` and `captured_by: manual`.

## 3. Draft curator actions

You are the curator for this single staged session. Read the staged log's proposals and draft one `CuratorAction` per candidate using the same rules as `/kk-curate` Step 2 (action taxonomy, `candidate_origin` as `<session_id>:<practice|map>:<index>`, relate-and-place, whole-tree dedup awareness). Do not invent a second action-rule authority — follow `/kk-curate`'s curator semantics.

Mint a run id once:

```bash
RUN_ID=$(uuidgen 2>/dev/null || date -u +"curate-%Y%m%dT%H%M%SZ")
PROPOSALS=$(mktemp -t kk-session-extract-proposals.XXXXXX.json)
SURVIVORS=$(mktemp -t kk-session-extract-survivors.XXXXXX.json)
```

Write your accumulated actions array (JSON array, top-level) to `$PROPOSALS`, then validate it before dedup: `npx --yes kenkeep@latest validate curator-output "$PROPOSALS"`. On a non-zero exit, read the path-referenced errors, fix the offending action(s), and re-validate until it passes. (`kk schema curator-output` prints the JSON Schema if you need the exact shape.)

## 4. Dedup and stamp via the scoped primitive

Invoke `curate-dedup` **once**, scoped to the staged session only:

```bash
STAGED_SESSION_ID=<session_id from stage-live output>
npx --yes kenkeep@latest curate-dedup \
  --input "$PROPOSALS" --output "$SURVIVORS" --run-id "$RUN_ID" \
  --session-id "$STAGED_SESSION_ID"
```

This stamps only the staged live log. Unrelated `proposal_status: done` logs in `_sessions/` remain available for a later `/kk-curate`.

Capture the stdout JSON summary (`kept`, `conflicts`, `stamped`, `runId`) and report it to the user.

## 5. Persist surviving actions via `curate-persist`

Follow `/kk-curate` Step 5 exactly: persist `$SURVIVORS` via `curate-persist`, surface any per-action failures from the summary, keep successful writes, and continue to the rebuild.

## 6. Rebuild the indices

```bash
npx --yes kenkeep@latest index rebuild
```

## 6b. Rebalance (final phase)

Follow `/kk-curate` Step 6b exactly: run `rebalance trigger`, skip when `actions` is empty, otherwise propose operations only for named branches and apply via `rebalance move`.

## 7. Report and resolve conflicts

Follow `/kk-curate` Step 7: report headline numbers, placement per written leaf, structural rebalance summary, then walk pending conflicts under `.ai/kenkeep/conflicts/` if any were minted.

## 8. Hand off

Tell the user to review changed nodes under `.ai/kenkeep/nodes/` and accept with `git commit`. The staged session log is now stamped as processed; a later capture hook for the same `session_id` preserves `curator_processed_at` / `curator_run_id`.

## Constraints

- One `curate-dedup` call per run, always with `--session-id` for the staged log.
- No writes when extraction returns empty proposals.
- No weakening of UUID-v4 validation; degraded idempotency must be reported when using `--generate-session-id`.
- Do not spawn a headless harness or background worker from this skill.
