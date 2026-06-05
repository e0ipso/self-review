---
name: kk-add
description: Capture a kenkeep node manually from the current session. Writes a new node directly under `.ai/kenkeep/nodes/<kind>/`. The reviewer accepts by leaving the file in place and rejects by deleting it. Use when the user wants to record a project convention, gotcha, rationale, or named-thing into the project knowledge base.
---

<!-- Version: 3 -->

# kk-add

Capture one piece of knowledge into the project knowledge base. You draft the node body in this session and persist it via the `node write` primitive; the reviewer reviews the file on disk.

Ask the user for seven values (do not invent any): **kind** (`practice` or `map`), **title** (≤ 80 chars), **summary** (≤ 140 chars), **tags** (comma-separated), **body** (full markdown; for practice include the rationale), **relates_to** (comma-separated node ids, may be empty), **confidence** (`high`/`medium`/`low`, default `high`).

Before invoking, skim `.ai/kenkeep/INDEX.md` (already in context) for an overlapping node. If one exists, offer to edit it, refine the candidate's title, or drop the capture instead. Push back if the candidate is: code that speaks for itself, history, a debugging recipe, in-flight plan/task content, or general programming knowledge.

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

`$HARNESS` is not consumed by `node write`, but other kenkeep commands invoked downstream still require it.

## Capture the node

### Probe + optional sub-agent delegation (context isolation)

Before drafting inline, check whether your runtime exposes a primitive for delegating focused work to a sub-agent in an isolated context (a "dispatch primitive"). This is a single-unit delegation: there is no parallelism — the point is to keep the host transcript free of the agent's intermediate deliberation so the user sees only the final summary and accept/reject prompt.

If a dispatch primitive is available:

1. Mint a `runId` and prepare the log/draft directory:

   ```bash
   RUN_ID=$(uuidgen 2>/dev/null || date -u +"add-%Y%m%dT%H%M%SZ")
   mkdir -p .ai/kenkeep/_logs/kk-add
   DRAFT_PATH="$(pwd)/.ai/kenkeep/_logs/kk-add/${RUN_ID}__1.draft.json"
   LOG_PATH="$(pwd)/.ai/kenkeep/_logs/kk-add/${RUN_ID}.jsonl"
   printf '%s\n' "{\"event\":\"delegating\",\"runId\":\"${RUN_ID}\",\"draftPath\":\"${DRAFT_PATH}\"}" >> "$LOG_PATH"
   ```

2. Tell the user, in one line, before delegating: "Drafting this node in a sub-agent for context isolation; the agent's full reasoning is in `.ai/kenkeep/_logs/kk-add/<runId>.jsonl` if you want it." Substitute the actual `runId`.

3. Delegate the drafting of the node body to ONE sub-agent with instructions equivalent to:

   > You are refining ONE kenkeep node body for the user. Inputs are: `kind=<kind>`, `title=<title>`, `summary=<summary>`, `tags=<tags>`, `relates_to=<relates_to>`, `confidence=<confidence>`, `body-draft=<body>`. Refine the body to 1–4 short paragraphs in present tense, project-specific. Do not invent rationale; if the user did not provide it, omit it. Keep title within 80 chars and summary within 140 chars; refine only for clarity. Derive `slug` from the title (lowercase, hyphen-separated, ASCII). Write the refined node as JSON to the absolute path `<DRAFT_PATH>` with these exact keys: `kind`, `slug`, `title`, `summary`, `tags`, `confidence`, `relates_to`, `body`. Return the path on success.

4. After the sub-agent returns, the host (never the sub-agent) reads `$DRAFT_PATH`, validates the JSON (must parse, contain the eight keys above, respect the length caps), then itself invokes `node write` from this same session. Append one JSONL line: `{"event":"drafted",...}` on success or `{"event":"draft-invalid","reason":"..."}` on failure.

5. On validation failure, do **not** abort. Fall back to the inline drafting path below on this same invocation; the user-visible summary is unchanged either way.

If no dispatch primitive is available, skip directly to the inline drafting path below — this is today's shipped behaviour and is preserved byte-equivalent.

### Inline drafting + `node write` (default and fallback)

Derive a slug from the title (lowercase, hyphen-separated, ASCII; e.g. `Use the bravo analytics dispatcher` → `use-the-bravo-analytics-dispatcher`). Then invoke `node write` with the body on stdin (when the delegation path produced a valid draft, use its `slug` and refined `body`; otherwise draft inline from the seven user-provided values):

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

After it returns, give the user the printed id and its file path (`nodes/<kind>/<id>.md`), and remind them to review and accept (leave) or reject (`rm`) the file.
