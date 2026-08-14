---
name: kb-add
description: Capture a knowledge-base node manually from the current session. Writes a new node directly under `.ai/knowledge-base/nodes/<kind>/`. The reviewer accepts via `git commit` and rejects via `git restore`. Use when the user wants to record a project convention, gotcha, rationale, or named-thing into the project knowledge base.
---

# kb-add

Capture one piece of knowledge into the project KB. The CLI writes the file and regenerates the index; the user reviews with `git diff`.

Ask the user for seven values (do not invent any): **kind** (`practice` or `map`), **title** (≤ 80 chars), **summary** (≤ 140 chars), **tags** (comma-separated), **body** (full markdown; for practice include the rationale), **relates_to** (comma-separated node ids, may be empty), **confidence** (`high`/`medium`/`low`, default `high`).

Before invoking, skim `.ai/knowledge-base/INDEX.md` (already in context) for an overlapping node. If one exists, offer to edit it, refine the candidate's title, or drop the capture instead. Push back if the candidate is: code that speaks for itself, history, a debugging recipe, in-flight plan/task content, or general programming knowledge.

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

## Capture the node

```bash
npx @e0ipso/ai-knowledge-base node add --harness "$HARNESS" \
  --kind <practice|map> --title "<title>" --summary "<summary>" \
  --tags "<tags>" --relates-to "<relates-to>" \
  --confidence <high|medium|low> --body @- --yes <<'EOF'
<body markdown>
EOF
```

`--body @-` reads stdin so multi-line markdown does not need escaping. The CLI fails loud on a slug collision; pick a more specific title if it complains. After it returns, give the user the printed path and remind them to review with `git diff`.
