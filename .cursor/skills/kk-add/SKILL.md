---
name: kk-add
description: Capture a kenkeep node manually from the current session. Writes a new node directly under `.ai/kenkeep/nodes/`. The reviewer accepts by leaving the file in place and rejects by deleting it. Use when the user wants to record a project convention, gotcha, rationale, or named-thing into the project knowledge base.
---

<!-- Version: 7 -->

# kk-add

Capture one piece of knowledge into the project knowledge base. You draft the node body in this session and persist it via the `node write` primitive; the reviewer reviews the file on disk.

Ask the user for seven values (do not invent any): **kind** (`practice` or `map`), **title** (≤ 80 chars), **summary** (≤ 140 chars), **tags** (comma-separated), **body** (full markdown; for practice include the rationale), **relates_to** (comma-separated node ids, may be empty), **confidence** (`high`/`medium`/`low`, default `high`).

Before invoking, skim `.ai/kenkeep/ENTRY.md` (already in context) and grep `nodes/` for an overlapping node. If one exists, offer to edit it, refine the candidate's title, or drop the capture instead. Push back if the candidate is: code that speaks for itself, history, a debugging recipe, in-flight plan/task content, or general programming knowledge.

## Resolve the project root

Resolve the repo root (the directory containing `.ai/kenkeep`) with the shipped detector, then treat the printed path as the working directory for every command below:

```bash
KK_REPO_ROOT=$(node .ai/kenkeep/scripts/kk-detect-root.mjs) || exit $?
cd "$KK_REPO_ROOT" || exit $?
pwd
```

## Capture the node

### Probe + optional sub-agent delegation (context isolation)

Decide whether to delegate the body drafting to a sub-agent (for context isolation) or draft inline, per the shared appendix `.ai/kenkeep/.config/prompts/sub-agent-delegation.md` (probe, fallback rule). This is a **single-unit** delegation — there is no parallelism and no concurrency cap; the point is only to keep the host transcript free of the agent's deliberation.

If the probe says a dispatch primitive exists:

1. Mint a `runId` and prepare the log/draft directory:

   ```bash
   RUN_ID=$(uuidgen 2>/dev/null || date -u +"add-%Y%m%dT%H%M%SZ")
   mkdir -p .ai/kenkeep/_logs/kk-add
   DRAFT_PATH="$(pwd)/.ai/kenkeep/_logs/kk-add/${RUN_ID}__1.draft.json"
   LOG_PATH="$(pwd)/.ai/kenkeep/_logs/kk-add/${RUN_ID}.jsonl"
   printf '%s\n' "{\"event\":\"delegating\",\"runId\":\"${RUN_ID}\",\"draftPath\":\"${DRAFT_PATH}\"}" >> "$LOG_PATH"
   ```

2. Tell the user, in one line: "Drafting this node in a sub-agent for context isolation; the agent's full reasoning is in `.ai/kenkeep/_logs/kk-add/<runId>.jsonl` if you want it." Substitute the actual `runId`.

3. Delegate the drafting of the node body to ONE sub-agent with instructions equivalent to:

   > You are refining ONE kenkeep node body for the user. Inputs are: `kind=<kind>`, `title=<title>`, `summary=<summary>`, `tags=<tags>`, `relates_to=<relates_to>`, `confidence=<confidence>`, `body-draft=<body>`. Refine the body to 1–4 short paragraphs in present tense, project-specific. Do not invent rationale; if the user did not provide it, omit it. Keep title within 80 chars and summary within 140 chars; refine only for clarity. Derive `slug` from the title (lowercase, hyphen-separated, ASCII). Write the refined node as JSON to the absolute path `<DRAFT_PATH>` with these exact keys: `kind`, `slug`, `title`, `summary`, `tags`, `confidence`, `relates_to`, `body`. Return the path on success.

4. After the sub-agent returns, the host (never the sub-agent) reads `$DRAFT_PATH`, validates the JSON (must parse, contain the eight keys above, respect the length caps), then itself invokes `node write` from this same session. Append one JSONL line: `{"event":"drafted",...}` on success or `{"event":"draft-invalid","reason":"..."}` on failure. On validation failure, do **not** abort — fall back to the inline drafting path below on this same invocation; the user-visible summary is unchanged either way.

If no dispatch primitive is available, skip directly to the inline drafting path below.

### Inline drafting + `node write` (default and fallback)

Derive a slug from the title (lowercase, hyphen-separated, ASCII; e.g. `Use the rm analytics dispatcher` → `use-the-rm-analytics-dispatcher`). Then invoke `node write` with the body on stdin (when the delegation path produced a valid draft, use its `slug` and refined `body`; otherwise draft inline from the seven user-provided values):

```bash
npx --yes kenkeep@latest node write <kind> <slug> \
  --title "<title>" --summary "<summary>" \
  --tags "<tags>" --relates-to "<relates-to>" \
  --confidence <high|medium|low> <<'EOF'
<body markdown>
EOF
```

`node write` reads the body from stdin (heredoc form keeps multi-line markdown unescaped). On success it prints exactly the resolved node id and exits 0. On schema-validation failure it exits non-zero with the error on stderr.

**Slug-collision behavior.** If a node with the proposed slug already exists on disk, `ensureUniqueId` auto-suffixes with `-2`, `-3`, etc., so the printed id may differ from your input slug. This is non-fatal — surface the printed id to the user verbatim so they review the right file. Only hard schema failures (missing `--title`, malformed `--confidence`, etc.) make the command exit non-zero.

After it returns, give the user the printed id and its file path (`nodes/<id>.md` at the root, since this skill does not pass `--folder`), and remind them to review and accept (leave) or reject (`rm`) the file.
