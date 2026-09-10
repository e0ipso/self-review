# `index rebuild` refuses to run without `.state/installed-version`, and sends the caller to `init`

Ready to file at <https://github.com/e0ipso/kenkeep/issues>. Not yet submitted; needs a human
with an account on that tracker (see SR-0062 resolution).

## Environment

- kenkeep 1.17.0 (`npx kenkeep --version`). Every run below went through `npx --offline` against
  the cached 1.17.0, so nothing resolved a different version mid-reproduction.
- git 2.39.5, Node 24.19.0, Linux x86_64 dev container
- Consumer repo: `self-review`, 200 nodes under `.ai/kenkeep/nodes/`
- Reproduced in throwaway `git init` repos holding a copy of that tree, so no local-only state
  carried over

## Reproduction

1. Put an installed `.ai/kenkeep/` into a fresh repo with `.state/` absent. Cloning a repo whose
   marker is untracked lands in the same place;
   `kenkeep-state-file-gitignored-blocks-fresh-checkout.md` in this folder covers how a repo ends
   up there without meaning to.

2. Run `npx kenkeep index rebuild`:

   ```
   ✗ kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.
   ```

   Exit code 1.

3. Write `.ai/kenkeep/.state/installed-version` back, change nothing else, run the same command:

   ```
   ✓ Regenerated 38 index.md file(s) and GRAPH.md from 200 node(s).
   ```

   Exit code 0.

4. Go back to step 1's state, commit the tree so the damage is visible, and do what the message
   says: `npx kenkeep init --harnesses claude`. Exit code 0, and it reports `✓ Initialized.`

## Expected

Step 2 does what step 3 does. `index rebuild` reads `nodes/` and writes `ENTRY.md`, the
per-directory `index.md` files and `GRAPH.md`. The marker is not one of its inputs, and the two
runs above differ by that one file. Failing that, the refusal names a repair sized to what is
missing, which is a single small JSON file, rather than one that recopies the whole template tree.

## Actual

The gate is the first thing `runIndexRebuild` does, in `src/commands/index-rebuild.ts` as bundled
into `dist/cli.js`:

```js
if (!existsSync35(paths.installedVersionFile)) {
  log.error(
    "kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`."
  );
  return 1;
}
```

The same three lines guard `node write`, `curate persist`, `conflict prepare`, `drafts collect` and
others. For commands that write into the installed tree that is reasonable. The rebuild only
regenerates files it derives from `nodes/`.

The remedy the message names is out of proportion. With the marker absent, `runInit` skips its
"Already initialized" early return and performs a first-time install: `copyTree(templates/kenkeep,
.ai/kenkeep)`, then every named harness adapter's `install`, then `copyTree(templates/prompts,
.ai/kenkeep/.config/prompts)`, then `ensureKbGitignore` and `ensureAgentsKkBlock` on `AGENTS.md`.
`copyTree` is `cpSync(src, dest, { recursive: true, force: true })`, so each template file lands on
top of whatever the repo had at that path.

Step 4, measured on the 200-node tree:

```
$ git status --porcelain
 M .ai/kenkeep/.config/prompts/knowledge-admission.md
 M .ai/kenkeep/.config/prompts/proposal-extract.md
 M .ai/kenkeep/ENTRY.md
 M .ai/kenkeep/GRAPH.md
 M .ai/kenkeep/README.md
 M .ai/kenkeep/nodes/index.md
?? .ai/kenkeep/.state/
?? .claude/
?? .kkignore
?? AGENTS.md
```

`GRAPH.md` went from 84,619 bytes covering 200 nodes to a 159-byte stub whose front matter reads
`node_count: 0`. `ENTRY.md` went from 2,269 bytes to 760, listing no branches. The nodes themselves
survived, since `cpSync` overwrites matching paths and deletes nothing. All of that to create a
200-byte file the caller could have written directly.

`index rebuild` does pass the gate afterwards, and regenerating from `nodes/` brings `ENTRY.md` and
`GRAPH.md` back to their previous size. Two things do not come back: the local overrides under
`.config/prompts/` (the reproduction's marker line in `knowledge-admission.md` was gone, and a
locally adjusted `proposal-extract.md` lost 103 lines to the template) and any local edit to
`.ai/kenkeep/README.md`. Only `runUpgrade` preserves prompts, through
`copyPromptsPreservingLocal`, and `runUpgrade` throws "Not initialized. Run `npx kenkeep init
--harnesses <id[,id,...]>` for a first-time install." when the marker is absent. The one path that
would have been careful is closed exactly when the caller needs it.

## Suggested fix

Either of these closes it, and the first is smaller.

1. Drop the gate from `index rebuild`. Read `nodes/`, write the indices, and fail only when
   `nodes/` is missing or unreadable. Its inputs and outputs all sit under `.ai/kenkeep/`, and it
   regenerates them from scratch anyway.

2. Keep the gate and change the message. Point it at a repair proportional to what is missing: a
   `kenkeep repair-state` or an `init --write-state` that writes `.state/installed-version` and
   nothing else, or, short of a new command, name the file and its contents. Whichever it names,
   the message should also say that a plain `init` recopies templates over the installed tree,
   because today it reads like a safe no-op.
