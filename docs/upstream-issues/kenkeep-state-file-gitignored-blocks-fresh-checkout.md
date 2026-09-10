# `init --upgrade` keeps a legacy `.state/` line, so `installed-version` stays untracked

Ready to file at <https://github.com/e0ipso/kenkeep/issues>. Not yet submitted; needs a human
with an account on that tracker (see SR-0062 resolution).

A first-time `init` on 1.17.0 writes a correct `.ai/kenkeep/.gitignore`, so this is not about the
lines kenkeep ships today. It is about repos that installed kenkeep earlier and upgraded into
1.17.0. They carry a bare `.state/` line that the upgrade does not recognize as legacy, and it
cancels the `!.state/installed-version` negation the upgrade writes above it.

## Environment

- kenkeep 1.17.0 (`npx kenkeep --version`). Every run below went through `npx --offline` against
  the cached 1.17.0, so nothing resolved a different version mid-reproduction.
- git 2.39.5, Node 24.19.0, Linux x86_64 dev container
- Consumer repo: `self-review`, which vendors kenkeep under `.ai/kenkeep/`
- Reproduced in a throwaway `git init` repo holding a copy of that repo's `.ai/kenkeep/`, so no
  local-only state carried over

## Reproduction

1. Start from a `.ai/kenkeep/.gitignore` written by an older kenkeep. self-review's was created in
   June 2026 by the `kenkeep init` of the day, commit `2914135`:

   ```gitignore
   _sessions/
   _logs/
   .state/
   !.state/installed-version
   ```

2. Run `npx kenkeep init --upgrade --harnesses claude`. It exits 0.

3. Read the file back:

   ```gitignore
   /_sessions/
   /_logs/
   /hooks/
   .state/*
   !.state/installed-version
   .state/
   ```

   Six lines, byte-identical to what self-review carried from commit `7b7697f` ("chore: update
   Strikethroo and Kenkeep") until it patched the file by hand.

4. `git add .ai/kenkeep/.state/installed-version` in that repo.

## Expected

The upgrade retires the legacy `.state/` line the way it retires `_sessions/`, `_logs/` and
`hooks/`, leaving the canonical five lines. `installed-version` is then trackable and survives a
fresh clone or worktree like the rest of the repo's committed state.

## Actual

The upgrade re-emits the legacy line below the negation, where it wins. `ensureKbGitignore` keeps
every existing line that is in neither of two sets, calls it a user line, and appends it after the
canonical block. From 1.17.0's bundled `dist/cli.js`:

```js
var KENKEEP_GITIGNORE_LINES = [
  "/_sessions/",
  "/_logs/",
  "/hooks/",
  ".state/*",
  "!.state/installed-version"
];
var LEGACY_UNANCHORED_GITIGNORE_LINES = new Set(["_sessions/", "_logs/", "hooks/"]);
```

`.state/` is in neither set, so it is treated as something the user wrote and is preserved last.
`_sessions/` and `_logs/` from the same old file are recognized and dropped, which is why the
result looks canonical until you read the sixth line.

That line excludes the directory, and `gitignore(5)` is explicit that a directory exclusion cannot
be undone from inside: "It is not possible to re-include a file if a parent directory of that file
is excluded. Git doesn't list excluded directories for performance reasons, so any patterns on
contained files have no effect, no matter where they are defined." `git check-ignore -v` names the
winner:

```
$ git check-ignore -v .ai/kenkeep/.state/installed-version
.ai/kenkeep/.gitignore:6:.state/	.ai/kenkeep/.state/installed-version
```

Line 6 is the trailing `.state/`, not line 5's negation. `git add` then refuses the file, and
reports the directory rather than the file, which is the same rule showing through:

```
$ git add .ai/kenkeep/.state/installed-version
The following paths are ignored by one of your .gitignore files:
.ai/kenkeep/.state
hint: Use -f if you really want to add them.
```

Delete the sixth line and the same `git add` stages the file, with `git check-ignore -v` reporting
`.ai/kenkeep/.gitignore:5:!.state/installed-version`.

So `installed-version` never gets committed, and a fresh clone or worktree has no
`.ai/kenkeep/.state/` at all. Every command gated on the marker fails there:

```
✗ kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.
```

Exit code 1. `npx kenkeep index rebuild`, `npx kenkeep node write` and the curate commands all
take that path. `init --upgrade` is no escape either: `runUpgrade` throws "Not initialized. Run
`npx kenkeep init --harnesses <id[,id,...]>` for a first-time install." when the marker is absent,
so the checkout cannot upgrade its way out of the gitignore that caused the problem. Until the
sixth line is deleted upstream of the clone, the only way through is to copy
`.state/installed-version` in from an already-initialized checkout before running any kenkeep
command, then delete it again afterward, on every fresh clone and every new worktree.

## Suggested fix

Add `.state/` to `LEGACY_UNANCHORED_GITIGNORE_LINES`, or to a second legacy set if that one is
meant to hold only unanchored spellings of current lines, so `ensureKbGitignore` drops it on the
next upgrade instead of preserving it. Filtering by effect would be sturdier than filtering by
exact text: any user line that re-excludes `.state/` or `.state/installed-version` defeats the
negation kenkeep just wrote, whatever it is spelled like.

Consumers can patch the file by hand in the meantime. self-review deleted the line and committed
the marker in commit `74033fb` (its tracker's SR-0087), and a later `init --upgrade` leaves the
patched file alone: it now equals the canonical block exactly, so `ensureKbGitignore` hits its
`next === existing` early return and writes nothing. Verified by running `init --upgrade` again
against the patched file, exit 0, md5 unchanged.
