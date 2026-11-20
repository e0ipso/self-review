---
name: self-review-stack
description: Split a large git diff into a stack of local review branches, generate a walkthrough guide for each step, and open each step in self-review-serve or the desktop app
metadata:
  argument-hint: "[git-diff-args... | pr-or-mr-url]"
---

# Review a Diff as a Stack

Take a git diff and present it as a stack of small, ordered steps, each a local branch one commit
on top of the last. Every step gets its own walkthrough guide from the `self-review-guide` skill
and its own review, either one `self-review-serve` server per step or the desktop app one step at
a time, so a human reviews a large change one layer at a time. The run ends with a table of the
steps, their descriptions, diff stats and review state.

The stack is review scaffolding, never a rewrite. The working tree, the index and every existing
branch stay exactly as they were, and the stack's whole diff is exactly the diff the arguments
name.

`scripts/stack.cjs` (relative to this skill's directory, `<skill-dir>` below) does the mechanical
work: resolving the arguments, building the branches, an optional import check, and printing the
table. Run it with `node` from inside the repository. `node <skill-dir>/scripts/stack.cjs --help`
prints its full usage.

## Hard Rules

These are invariants, not style preferences:

1. **Never change the working tree, the index or an existing branch.** No checkout, switch,
   reset, rebase, stash, commit or merge. The stack is built with plumbing on a throwaway copy of
   the index, and every read of a step's content goes through `git show <step-branch>:<path>`.
   The one checkout is step 7's detached worktree in a temporary directory, removed afterwards.
2. **Reproduce the diff exactly.** Every changed path lands in exactly one step, in its final
   form, and the stack's whole diff equals the one the arguments name. `stack.cjs build` refuses
   a spec that breaks either.
3. **A step builds only on itself and earlier steps.** Nothing a step imports may first arrive in
   a later step.
4. **Describe, never judge.** Step descriptions follow the same rules as `self-review-guide`'s
   rationales: no review verdicts, and no wording that suggests a step or file need not be read.
5. **Local only.** Do not push the stack branches or open merge requests from them unless the
   user asks.

## 1. Parse Arguments

Read `$ARGUMENTS` for git diff args. If empty, default to unstaged changes (plain `git diff`).
The arguments support the same format as self-review CLI: `--staged`, `HEAD~3`,
`main..feature-branch`, `-- path/to/file`, etc.

If the argument is a GitHub PR URL or a GitLab MR URL, this is a **URL source**: follow the "URL
source" recipe in step 3 of the `self-review-guide` skill (`../self-review-guide/SKILL.md`) to
materialize it, then use the range that recipe diffs, `<base-ref>...refs/self-review/head`, as
the diff args, and run every later step inside that checkout. One difference from the guide
skill: the reviews read from the checkout until each one is finished, and their files live in it
(step 5), so leave a temporary clone in place at the end of the run and give the user its path to
remove once the reviews are done.

A stack needs a little more from the arguments than a single diff does:

- **Revisions, `--staged`/`--cached`, `--merge-base` and `-- <paths>`** decide what the stack
  holds, with their `git diff` meanings. When a side is the working tree or the index,
  `stack.cjs` snapshots it from a copy of the index, and unstaged changes are stacked on a commit
  of the index, since every step must be a commit.
- **Every other option** (`-w`, `-U10`, `-M`) changes how a diff is shown, not what changed. It
  stays out of the stack and is passed through to each step's guide and review.
- **Untracked files** are not part of a git diff, as with the guide skill. The user can
  `git add -N` them first to include them; this skill never does it for them.
- **`--no-index` and `-R`** are refused: files outside the repository have no history to stack
  on, and a reversed diff has no commit to end at.

Two choices come from the user's request, not from the arguments:

- **Front end.** Serve mode (one `self-review-serve` per step, all open at once) unless the user
  asks for the desktop app, which opens one step at a time.
- **Pre-seeded comments.** When the user asks for a critique as well as a guide, step 8 runs
  `self-review-critique` instead of `self-review-guide`.

## 2. Get the Diff

Use the Bash tool to run:
```bash
node <skill-dir>/scripts/stack.cjs resolve $ARGUMENTS
```

If it prints "No changes to stack." (exit status 3), report that and stop. If it refuses (exit
status 1), report the reason it printed on stderr and stop.

Otherwise it prints the stack's shape, then one line per changed path, its `git diff
--name-status` letter and the path separated by a tab:

```
base     <commit the stack starts from>
target   <tree the stack ends at>  (<what is compared>)
paths    <pathspecs>                   (only when pathspecs were given)
options  <pass-through options>        (or "(none)")
diff     <N> files changed +<insertions> -<deletions>
M	src/retry.ts
```

## 3. Understand the Change

You need enough understanding to cut the change into layers, not to judge it:

- The changed paths from step 2, and `git diff --stat <base> <target>` for their sizes.
- When the diff ends at a commit, `git log --oneline <base>..<end>` gives the commit subjects.
  They are a first draft of the layers, but later fix-up commits revise earlier ones, so steps
  are cut from the final file contents, never replayed from commits.
- Read any plan or task documents in the change. Their task order is a good starting outline.
- Map dependencies between the changed files: which changed files each one imports, read with
  `git show <target>:<path>`.

## 4. Design the Stack

- **Aim for 3–7 steps**, each a single idea a reviewer can hold in one sitting: a layer of the
  change (shared rules, then the server write path, then endpoints, then UI), not a file type.
  Roughly 1,000 changed lines per step is a soft ceiling, not a target. If the change has only
  one layer, say so and suggest plain `self-review-guide` instead of forcing a stack.
- **Order by dependency, foundations first.** Plans and design documents go first, as context
  for everything after them.
- **Tests travel with the code they cover.** Infrastructure travels with the first step whose
  code needs it, unless it is large enough to be its own step.
- **Whole files only.** A file lands in one step, in its final form. Place it no earlier than the
  latest step it imports from and no later than the first step that imports it. If no step
  satisfies both, those steps belong together: merge them.
- **Renames are a delete plus an add.** The spec lists both paths; keep them in the same step.
- **When the plan's order and the dependency order disagree, follow dependencies** and say so in
  the summary.

Give each step a two-digit slug (`01-design`), a commit subject in the repository's convention
(check `git log --oneline -20`), and a one-sentence description for the table. The description
says what the step adds and, where it helps, why it sits where it does.

Name the stack `<prefix>`, from the branch the diff ends on (the current branch when it ends at
the working tree or the index):

- **A short form of the branch name plus `-stack`**: a few words, with `/` and other separators
  turned into `-` (`feature/retry` → `feature-retry-stack`).
- **A ticket key**, matching `[A-Z][A-Z0-9]+-\d+`, plus `-stack`, only when the branch name has
  one (`ABC-123--add-retry` → `ABC-123-stack`).
- **`pr-<N>-stack` or `mr-<N>-stack`** for a URL source.
- When the diff ends at a commit no branch names, the commit's short SHA plus `-stack`.

Steps become branches `<prefix>/<slug>`. Check for existing ones:
```bash
git for-each-ref --format='%(refname:short)' refs/heads/<prefix>
```
It lists a branch named `<prefix>` and every branch under `<prefix>/`. If it lists anything, ask
the user whether to delete those branches or use another prefix; never overwrite one.

## 5. Choose the Output Directory

First, if `~/.config/self-review/config.yaml` or the repository root's `.self-review.yaml` sets
`guide-file`, every step would load that one guide instead of its own. Tell the user and stop,
before anything is built.

The output directory is always `$(git rev-parse --git-common-dir)/self-review/<prefix>/`, made
absolute. It is never tracked, and every worktree of the repository shares it. Use the Bash tool
to run:
```bash
echo "$(git rev-parse --path-format=absolute --git-common-dir)/self-review/<prefix>"
git rev-parse --show-toplevel
```

The first line is `<outdir>`, the second is the repository root, `<root>`. Write both out in
full in every later command; a shell variable may not survive from one command to the next. If
`<outdir>` already exists and is not empty, ask the user whether to remove it or use another
prefix. Otherwise create it with `mkdir -p "<outdir>"`.

The directory holds the spec, the guides, the server logs and, once the user completes them, the
reviews. Every review launch runs from `<root>` with `-o "<outdir>/<slug>.review.xml"`, never from
`<outdir>` itself: inside `.git/`, git refuses the work-tree commands self-review runs ("this
operation must be run in a work tree"), and launching from the root also applies the
repository's own `.self-review.yaml`. self-review discovers a guide next to its output path at
startup, so a step reviewed with `-o "<outdir>/<slug>.review.xml"` loads
`<outdir>/<slug>.review.guide.xml`, the path step 8 writes (the guide skill's own rule: strip the
last extension, append `.guide.xml`).

## 6. Write the Spec and Build the Stack

Write `<outdir>/stack.json` with the Write tool:

```json
{
  "diff_args": ["origin/main...feature/retry"],
  "prefix": "feature-retry-stack",
  "trailers": [],
  "steps": [
    {
      "slug": "01-design",
      "subject": "docs: add design notes",
      "description": "The design notes the retry policy follows.",
      "files": ["docs/retry.md"]
    },
    {
      "slug": "02-retry",
      "subject": "feat: add retry policy",
      "description": "The retry policy and the client that adopts it, with their tests.",
      "files": ["src/retry.ts", "src/retry.test.ts", "src/client.ts"]
    }
  ]
}
```

- `diff_args` holds the arguments from step 1, one array item per argument, with a URL replaced
  by its range.
- `files` are paths from the repository root, as `resolve` printed them.
- `trailers` is optional and empty by default, since these commits are scaffolding. Add lines
  only when the project's or the user's instructions require them on every commit.

Use the Bash tool to run:
```bash
node <skill-dir>/scripts/stack.cjs build "<outdir>/stack.json"
```

It resolves the arguments again, builds every commit on a throwaway index, and creates the
branches only after confirming the stack reproduces the diff. It refuses, creating nothing, when
a changed path is in no step or in two, a listed path is not part of the diff, or a branch
already exists under the prefix. Fix the spec and run it again.

On success it prints:

```
Built 2 steps on 81fa0c4 for `git diff origin/main...feature/retry`:
  feature-retry-stack/01-design  11d7001  docs: add design notes
  feature-retry-stack/02-retry   b840b0d  feat: add retry policy
The stack reproduces the diff: feature/retry against the merge base of origin/main and feature/retry.
Diff args for each step's guide and server:
  81fa0c4..feature-retry-stack/01-design
  feature-retry-stack/01-design..feature-retry-stack/02-retry
```

Each step's diff args are the pass-through options, then `<previous>..<step-branch>`, where step
1's `<previous>` is the base commit's short SHA. They are already shell-quoted. Steps 8 and 9
pass them exactly as printed, to the guide and to the review alike.

## 7. Check Each Step Stands on Its Own

The primary check is the project's own type checker or build, run against each step branch in a
temporary worktree, so the user's working tree is never involved. For each step, use the Bash
tool to run:
```bash
git worktree add --detach <tmp>/<slug> <prefix>/<slug>
```
where `<tmp>` is a fresh directory from `mktemp -d`. Inside `<tmp>/<slug>`, set the project up
the way its README or CI does (installing dependencies is often required), then run its type
checker or build (`npm run typecheck`, `cargo check`, `go build ./...`, and so on). Afterwards
remove it:
```bash
git worktree remove --force <tmp>/<slug>
```

A failure is one of two things:

- **An ordering problem:** a step needs something a later step adds. Move the file or merge the
  steps, delete the stack branches (the cleanup command in step 10), and rebuild.
- **A failure the original diff has too:** check the last step. If it fails the same way, the
  stack is not the cause; say so in the summary.

For JavaScript and TypeScript, `stack.cjs check-imports` is an optional fast extra, a regular
expression heuristic that needs no install. Use the Bash tool to run:
```bash
node <skill-dir>/scripts/stack.cjs check-imports "<outdir>/stack.json" --alias @/=src/
```

Take the aliases from the `paths` in the project's `tsconfig.json` (`"@/*": ["src/*"]` becomes
`--alias @/=src/`) and from any bundler alias configuration; `--ignore` takes a regular
expression for import specifiers that resolve to generated modules. Example (SvelteKit): add
`--alias '$lib/=src/lib/' --ignore '\$types$'` for its `$lib` alias and generated `./$types`.
It prints one line per problem and `<N> problem(s)`, and exits 1 when it found any. Each problem
is either a false positive (a generated module, or an export its patterns missed; confirm with
`git show <step-branch>:<path>`) or an ordering problem, handled as above.

Say in the summary which check ran. If the project has no checker, or it cannot run here, say
that instead. Never claim the steps compile if nothing compiled them.

## 8. Generate a Guide for Each Step

For each step, run the `self-review-guide` skill (`../self-review-guide/SKILL.md`) with these
arguments:

```
--guide-output "<outdir>/<slug>.review.guide.xml" --content-ref <prefix>/<slug> <step-diff-args>
```

- `--guide-output` is the path self-review discovers next to `-o "<outdir>/<slug>.review.xml"`.
- `--content-ref` makes the guide read each file from the step branch, since the working tree is
  not the step.
- `<step-diff-args>` are the step's diff args from `build`, as printed.

Give it the stack outline (slugs and descriptions) as context, so its overview can say what came
before the step and what comes next.

To pre-seed review comments as well, run the `self-review-critique` skill
(`../self-review-critique/SKILL.md`) for each step instead, with:

```
--review-output "<outdir>/<slug>.review.xml" --content-ref <prefix>/<slug> <step-diff-args>
```

It runs the guide skill first, passing it `--guide-output "<outdir>/<slug>.review.guide.xml"`, so
the pair is discovered together. Step 9 then opens that step with
`--resume-from "<outdir>/<slug>.review.xml"`.

Run the steps in sequence. When subagents are available, running one per step in parallel is an
optional speed-up; brief each subagent with:

- the skill to run and its exact arguments, from above;
- the whole stack outline;
- the read-only rule: no checkout, no edits outside its output file;
- a request to report the file count, the groups and the `xmllint` result.

## 9. Open Each Step for Review

If `git ls-files --others --exclude-standard` (run in `<root>`) prints anything, tell the
reviewer that self-review lists those untracked files as new files in every step, and that the
"Hide New Files" toolbar toggle hides them.

Open a step only once its guide validates. Without pre-seeded comments, leave `--resume-from`
out of the commands below.

### Serve mode

Use `self-review-serve` when it is on `PATH` (`command -v self-review-serve`); otherwise use
`npx --yes @self-review/serve` in its place, and tell the user it runs the published package.
Start one server per step in the background, from the repository root. Use the Bash tool to run:
```bash
cd "<root>" && nohup self-review-serve -o "<outdir>/<slug>.review.xml" \
  --resume-from "<outdir>/<slug>.review.xml" <step-diff-args> \
  > "<outdir>/<slug>.serve.log" 2>&1 &
```

When the harness has its own background mode, run the same command in it without `nohup` and the
trailing `&`, keeping the redirect to `<outdir>/<slug>.serve.log`: `stack.cjs table` reads the
review URL from that file. Start each server as soon as its guide validates, while later guides
are still being written.

Once a server is up, its log holds:

- `[serve] Review ready at <url>`, the review URL;
- `[serve] Walkthrough guide loaded: <G> groups`. Without it, the guide is missing or invalid,
  and the log says which.

If the log ends in an error instead, the server has exited. Report the error for that step.

### Desktop mode

Open one step at a time, in order, and wait for each to finish before opening the next. Use the
Bash tool to run, in the foreground:
```bash
cd "<root>" && self-review -o "<outdir>/<slug>.review.xml" \
  --resume-from "<outdir>/<slug>.review.xml" <step-diff-args>
```

The command returns when the reviewer finishes the review, which writes
`<outdir>/<slug>.review.xml`, or quits. If that file does not exist afterwards, ask the user
whether to reopen the step or continue to the next one. If `self-review` is not on `PATH`, tell
the user and offer serve mode instead.

## 10. Output Summary

Use the Bash tool to run:
```bash
cd "<root>" && node <skill-dir>/scripts/stack.cjs table "<outdir>/stack.json"
```

It prints one row per step and a total. The last column is the review state, read from the files
beside the spec. A step's `<slug>.serve.log` decides when it exists: its review URL while the
server is open, `completed` and the file name once the server logged `Review complete`, and
`not ready, see log` before either. Without a log, the step is `completed` when
`<slug>.review.xml` exists, else `not started`. A review file a critique pre-seeded therefore
does not hide the URL:

```
| # | Step | Description | Diff | Review URL |
|---|---|---|---|---|
| 1 | `feature-retry-stack/01-design` | The design notes the retry policy follows. | 1 file changed +40 -0 | http://127.0.0.1:41873/#cap=… |
| 2 | `feature-retry-stack/02-retry` | The retry policy and the client that adopts it, with their tests. | 3 files changed +212 -9 | http://127.0.0.1:41875/#cap=… |
| | **Total** | | **4 files changed +252 -9** | |
```

Print the table, then briefly:

- the diff the stack reproduces and the base commit it starts from, as `build` printed them;
- where the stack's order departs from the order of any plan documents in the change, and why;
- any mismatches between plan documents and code that the guides surfaced;
- which step check ran (step 7);
- that the branches are local and not pushed;
- when untracked files exist, that every step lists them as new and "Hide New Files" hides them;
- that finishing a review writes `<outdir>/<slug>.review.xml` (in serve mode it also stops that
  server), and that `self-review-apply` acts on that file. Apply fixes where the original diff
  ends (its branch, or the working tree), not on the stack branches, which are scaffolding;
- in serve mode, that the servers listen on 127.0.0.1 only, so reaching one from another machine
  needs an `ssh -L` forward of its port, and that each URL carries its session key after `#cap=`;
- for a URL source in a temporary clone, the clone's path, to remove once the reviews are done
  and applied, since the review files live inside it;
- how to clean up: stop any server still running (`pgrep -af -- "<outdir>/"` lists them with
  their PIDs; `kill <pid>` each one), delete the branches with
  `git branch -D $(git branch --list '<prefix>/*' --format='%(refname:short)')`, then remove the
  output directory with `rm -rf "<outdir>"`.
