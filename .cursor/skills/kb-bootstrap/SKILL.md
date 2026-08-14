---
name: kb-bootstrap
description: First-time bootstrap of the project knowledge base from existing markdown documentation. Surveys docs, follows cross-references, and writes new node files directly under `.ai/knowledge-base/nodes/`. Supervised by the user, who reviews each node with `git diff` before committing. Use when the user wants to seed an empty knowledge base from the project's existing docs.
---

# kb-bootstrap

You are doing a one-time bootstrap of this project's knowledge base from its existing documentation. The user invoked this skill in their normal session, so they are watching and can correct you in-flight if you go off track.

## Your task

Survey the project's existing markdown documentation, extract candidate knowledge nodes, and write them as new node files directly under `nodes/`. The user reviews everything with `git diff` and accepts or rejects each node with `git commit` or `git restore <path>`. You will work judgmentally, exploring, sampling, following cross-references, not exhaustively. This is a one-pass operation, supervised.

## Inputs

- An optional path argument from the user. If provided, treat that as the root of the docs scope. If absent, default to scanning: `docs/`, top-level `README.md`, top-level `CONTRIBUTING.md`, top-level `ARCHITECTURE.md`, and any `*.md` files at the repo root.

## Configuration

Before you start, read `.ai/knowledge-base/config.yaml` (falling back to `~/.config/ai-knowledge-base/config.yaml`) and look for a `bootstrapModel:` block. If `bootstrapModel.name` is set (one of `haiku`, `sonnet`, `opus`) and you decide to delegate any portion of this work to a sub-agent, pass that value as the sub-agent's model parameter. If the config or the key is absent, omit the model so the sub-agent inherits its default.

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

Pass `--harness "$HARNESS"` to every subsequent CLI call in this skill.

## Steps

### 1. Survey the structure

Run `npx @e0ipso/ai-knowledge-base bootstrap-incremental --harness "$HARNESS" --dry-run --from <scope>` once, where `<scope>` is the user's path argument (or `docs` as the default). Parse the `  + <relpath>` lines from the output: each prefixed line names one candidate markdown file the CLI would process. The CLI has already applied `.gitignore`, the project's include/exclude rules, and a static skip list (filenames like `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `INDEX.md`, `GRAPH.md`, `releases/**/*.md`); you will not see those in the list.

Count the lines and report briefly to the user before reading anything in depth, e.g. "The CLI lists 30 markdown files across docs/, three module READMEs, two top-level overviews. I'll prioritize the overviews first, then sample modules." Use judgement to spot entry points, suspected-stale docs, and a sampling order from the deterministic list, but do not rebuild it.

### 2. Read entry points first

Read the top-level entry points completely. They usually frame project vocabulary, name the major components, and establish the conventions vocabulary you'll need to recognize.

### 3. Sample and follow cross-references

Don't read every file end-to-end. Sample representative content and follow links between docs. If a top-level README mentions "see docs/architecture/auth.md for the authentication design," that's a high-signal pointer to follow.

For large reference docs (e.g. method-by-method API listings), skim section headers and only read prose sections, skipping auto-generated tables.

### 4. Identify candidates as you read

For each piece of content that looks like project knowledge, decide which kind:

**Practice candidates**, imperative project guidance:
- Conventions ("always use X for Y").
- Prohibitions ("don't do X").
- Gotchas (warnings, "be careful with…").
- Rationale ("we chose X because Y").
- Tooling/workflow ("tests run with X").

**Map candidates**, what exists:
- Named features, modules, services and what they do.
- Vocabulary specific to this project.
- File-tree locations of major systems.

When a piece of content has both aspects (e.g. "Use bravo_analytics.dispatcher, our service for tracking events"), split it: practice owns "use the dispatcher"; map owns "what the dispatcher is."

Skip (content judgement only; filename-pattern skips are already handled by the CLI before you see the list):
- Auto-generated API reference.
- Boilerplate paragraphs inside otherwise-useful docs (standard license preamble, generic CI badges).
- General programming knowledge that's not project-specific (Drupal/React/Django basics).
- Aspirational TODOs and "we should eventually" content.

### 5. Write nodes

For each candidate, write a node file at `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`. **Before writing, check whether the file already exists.** Bootstrap is conservative and never overwrites an existing node. If you hit a collision, refine the title or skip the candidate and call it out in your final report.

Use the standard node frontmatter:

```yaml
---
schema_version: 1
id: <kind>-<slug>
title: "..."
kind: practice | map
tags: [tag1, tag2, ...]
derived_from:
  - <source-doc-path-relative-to-repo>
relates_to: []
confidence: medium
summary: "≤140 char summary"
---

# <Title>

<Body in markdown, 1 to 4 short paragraphs.>
```

Default `confidence: medium` for bootstrap content. Existing docs may be stale or aspirational; the reviewer needs to assess each one with `git diff`. Use `confidence: high` only when the doc explicitly states the rule with rationale and the doc looks actively maintained.

If a candidate is sourced from multiple docs (you found the same convention discussed in two places), list all of them in `derived_from` and produce a single node, not duplicates.

### 6. Refresh INDEX.md and GRAPH.md

After writing nodes, run `npx @e0ipso/ai-knowledge-base index rebuild --harness "$HARNESS"` so the indices reflect the new nodes before the user reviews `git diff nodes/`.

### 7. Report back

When you're done, summarize for the user:

- How many docs you read; which ones you skipped and why.
- How many practice nodes you wrote.
- How many map nodes you wrote.
- Any collisions you skipped (file already existed); the user may want to merge content manually.
- Any cross-references you noticed but didn't follow (the user might want to direct you to those).
- Any docs that looked stale or contradictory that the user should double-check.
- Confirmation that `INDEX.md` and `GRAPH.md` were refreshed.

Then tell the user to review with `git diff nodes/`, accept individual files with `git add nodes/<kind>/<file>.md && git commit`, and reject the rest with `git restore nodes/<kind>/<file>.md`.

## Constraints

- **Never overwrite an existing node in `nodes/`.** Bootstrap only writes files that don't already exist. If you'd collide, skip and report.
- **Never auto-resolve perceived contradictions during bootstrap.** If you notice two docs that disagree, write only one as a node and surface the conflict in your final report so the user can decide. Do not write a second contradictory node.
- **Don't hallucinate rationale.** Only include "because…" content that's actually present in the source. If the doc just says "use X," your node says "use X", not "use X because of [made-up reason]."
- **Don't try to read code files.** Stick to markdown documentation. The point of bootstrap is to extract what's already been written down.
- **Stay within reading and writing markdown nodes.** The CLI owns file discovery, hashing, and state; defer to it for those concerns rather than reimplementing them.

## When to stop

Stop and ask the user if:
- The docs directory contains more than ~100 markdown files (likely needs scoping).
- You encounter a doc that's clearly contentious or version-specific and you can't tell which version is current.
- You realize you've been over-extracting (nodes piling up faster than the user can plausibly review).
- The user has not corrected you in a while but your confidence is dropping.

Bootstrap is supervised. Defer to the human when uncertain.
