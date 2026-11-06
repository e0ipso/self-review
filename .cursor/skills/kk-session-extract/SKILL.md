---
name: kk-session-extract
description: Extract durable knowledge from the current live session, stage it as a validated done session log, and run it through the same curation machinery as /kk-curate. Use when the user wants to proactively process the current session before waiting for capture hooks and a later curate pass — not for dictating one node (/kk-add) or batch-processing accumulated logs (/kk-curate).
---

<!-- Version: 7 -->

# kk-session-extract

Extract durable project knowledge from the **visible current session**, stage it as a normal `proposal_status: done` session log, and immediately run the shared curation tail. You operate in-host on the live context window — no headless harness spawn, no daemon.

**Routing:** use `/kk-add` when the user already knows the node; use `/kk-session-extract` when the current session just produced durable teaching moments; use `/kk-curate` when processing accumulated captured logs later.

**Partial context warning:** if compaction has occurred, the visible context may be incomplete. Describe your extraction as visible-context extraction, not full-session extraction, unless the runtime exposes the full transcript.

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

3. **Capture the one-line JSON summary** printed on stdout (`path`, `session_id`, `idempotency`). Keep `path` and `session_id`; Step 3 lists them in the draft. Report degraded idempotency explicitly when `idempotency` is `degraded`.

The staged log lives under `.ai/kenkeep/_sessions/` with `proposal_status: done` and `captured_by: manual`.

## 3. Draft curator actions

You are the curator for this single staged session. Read the staged log's proposals and draft one `CuratorAction` per candidate using the same rules as `/kk-curate` Step 2 (action taxonomy, `candidate_origin` as `<session_id>:<practice|map>:<index>`, relate-and-place, whole-tree dedup awareness). Do not invent a second action-rule authority — follow `/kk-curate`'s curator semantics.

Mint a run id once. The staged log is this run's single batch, and its draft is the only thing `curate-dedup` stamps from, so the staged log is consumed and nothing else pending in `_sessions/` is:

```bash
RUN_ID=$(uuidgen 2>/dev/null || date -u +"curate-%Y%m%dT%H%M%SZ")
SURVIVORS=$(mktemp -t kk-session-extract-survivors.XXXXXX.json)
mkdir -p .ai/kenkeep/_logs/curator
DRAFT_PATH="$(pwd)/.ai/kenkeep/_logs/curator/${RUN_ID}__1.draft.json"
```

`Write` the draft to `$DRAFT_PATH` as one JSON object: `{"sessions":[{"session_id":"<staged session_id>","file":"<bare filename of the staged path>","transcript_hash":"<transcript_hash from the staged log's frontmatter>"}],"actions":[...]}` (`actions` is `[]` only if every candidate turned out undraftable). Validate it before collection: `npx --yes kenkeep@latest validate curator-draft "$DRAFT_PATH"`. On a non-zero exit, read the path-referenced errors, fix the offending entries, and re-validate until it passes. (`kk schema curator-draft` prints the JSON Schema if you need the exact shape.) Every `candidate_origin` must start with the staged `session_id`; the collector invalidates the draft otherwise.

## 4. Collect, dedup and stamp via the primitives

Collect the single batch, then invoke `curate-dedup` **once** on the collected document:

```bash
COLLECTED=$(mktemp -t kk-session-extract-collected.XXXXXX.json)
npx --yes kenkeep@latest drafts collect --run-id "$RUN_ID" > "$COLLECTED"
npx --yes kenkeep@latest curate-dedup \
  --input "$COLLECTED" --output "$SURVIVORS" --run-id "$RUN_ID"
```

`drafts collect` prints `{ runId, batches, consumed, actions }`; with one valid draft, `consumed` is exactly the staged log. If it exits non-zero the draft was invalid: nothing is consumed, so fix the draft and re-run the collector. `curate-dedup` validates the document before any write (every origin must belong to the staged session, which must still be done and unprocessed) and then stamps only that log. Unrelated `proposal_status: done` logs in `_sessions/` remain available for a later `/kk-curate`.

Capture the stdout JSON summary (`kept`, `conflicts`, `stamped`, `runId`; `stamped` is 1) and report it to the user.

## 5. Persist surviving actions via `curate-persist`

Follow `/kk-curate` Step 5 exactly: persist `$SURVIVORS` via `curate-persist`, surface any per-action failures from the summary, keep successful writes, and continue to Step 6.

## 6. Report and resolve conflicts

Follow `/kk-curate` Step 6 exactly: report headline numbers and placement per written leaf, then run `conflict prepare` and walk every open conflict it lists (this run's and any left open by earlier runs), applying each decision only through `conflict resolve`.

## 7. Rebuild the indices

After the content writes and any accepted conflict:

```bash
npx --yes kenkeep@latest index rebuild
```

## 7b. Rebalance (final phase)

Follow `/kk-curate` Step 7b exactly: run `rebalance trigger`, skip when `actions` is empty, otherwise propose operations only for named branches and apply via `rebalance move`. Print the structural summary as in `/kk-curate` Step 8.

## 8. Hand off

Tell the user to review changed nodes under `.ai/kenkeep/nodes/` and accept with `git commit`. The staged session log is now stamped as processed for the staged excerpt's `transcript_hash`. A later capture hook for the same `session_id` keeps that stamp but, because the captured transcript is a different version than the excerpt, re-opens the log as pending: the whole transcript is extracted again and the next `/kk-curate` reconciles its candidates against the nodes just written (expect mostly `drop`/`modify`). That is what lets turns after this extraction still reach the knowledge base.

## Constraints

- One draft (batch 1, listing only the staged log), one `drafts collect` and one `curate-dedup` call per run; the draft's `sessions` list is what scopes the stamp to the staged log.
- No writes when extraction returns empty proposals.
- No weakening of UUID-v4 validation; degraded idempotency must be reported when using `--generate-session-id`.
- Do not spawn a headless harness or background worker from this skill.
