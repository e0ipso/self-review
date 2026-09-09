# `.ai/kenkeep/.gitignore` excludes `.state/installed-version`, so kenkeep refuses to run in a fresh clone or worktree

Ready to file at <https://github.com/e0ipso/kenkeep/issues>. Not yet submitted; needs a human
with an account on that tracker (see SR-0062 resolution).

## Environment

- kenkeep 1.17.0 (`npx kenkeep --version`), run via `npx kenkeep index rebuild` (the same gate
  applies to `npx kenkeep node write` / `/kk-add`)
- Consumer repo: this repo, `self-review`, with kenkeep vendored under `.ai/kenkeep/`
- Reproduced in a disposable `git worktree add` checkout of the repo's own tracked state (no
  local-only files carried over)

## Reproduction

1. Install/initialize kenkeep normally in a repo (`npx kenkeep init ...`), which writes
   `.ai/kenkeep/.state/installed-version`.
2. Commit and push the repo. `.ai/kenkeep/.gitignore` ships with:
   ```gitignore
   /_sessions/
   /_logs/
   /hooks/
   .state/*
   !.state/installed-version
   .state/
   ```
3. Clone the repo fresh, or add a new `git worktree` from it, and run
   `npx kenkeep index rebuild` (or `npx kenkeep node write`) without first re-running
   `kenkeep init`.

## Expected

Either the installed-version marker survives a fresh checkout (it is small, non-sensitive state
that just names the installed package/version/harnesses), or kenkeep gives a clear one-line
recovery path when it's absent, without requiring a manual `.state/installed-version` file copy.

## Actual

The gitignore's own last line, `.state/`, re-excludes the whole directory after the line above it
negates one file inside it. A directory-level pattern always wins over a file-level `!`
re-inclusion for a path underneath it, so the negation is dead code. `git check-ignore -v` on the
target file confirms which rule wins:

```
$ git check-ignore -v .ai/kenkeep/.state/installed-version
.ai/kenkeep/.gitignore:6:.state/	.ai/kenkeep/.state/installed-version
```

(Line 6 is the trailing `.state/`, not line 5's `!.state/installed-version`.) The file therefore
never gets committed, and a fresh clone or worktree has no `.ai/kenkeep/.state/` directory at
all. Running `npx kenkeep index rebuild` there fails immediately:

```
✗ kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.
```

Exit code 1. Running `npx kenkeep init` isn't the fix; the package is already installed and
configured, only the state marker is missing. The only workaround found was copying
`.state/installed-version` in from an already-initialized checkout by hand before running any
kenkeep write command, then deleting it afterward.

## Suggested fix

Drop the trailing `.state/` line from the shipped `.ai/kenkeep/.gitignore` (keep `.state/*` +
`!.state/installed-version`, which already scopes the ignore to everything else under `.state/`),
so `installed-version` is trackable and survives a fresh clone or worktree like the rest of the
repo's committed state.
