# `kenkeep index rebuild` collapses the managed AGENTS.md block to one line, breaking `proseWrap: always` consumers

Ready to file at <https://github.com/e0ipso/kenkeep/issues>. Not yet submitted; needs a human
with an account on that tracker (see SR-0062 resolution).

## Environment

- kenkeep 1.17.0 (`npx kenkeep --version`), run via `npx kenkeep index rebuild`
- Consumer repo: this repo, `self-review`, whose `.prettierrc` sets:
  ```json
  { "overrides": [{ "files": "*.md", "options": { "printWidth": 100, "proseWrap": "always" } }] }
  ```
- CI runs `npm run format:check` (`prettier --check .`) on every push
  (`.github/workflows/ci.yml`).

## Reproduction

1. In a repo with kenkeep installed and a managed `kk-index` block in `AGENTS.md` (or
   `CLAUDE.md`), start from a block that is already prose-wrapped at 100 columns:

   ```
   <!-- >>> kenkeep:kk-index >>> -->

   You are required to load [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md), the small curated entry
   catalog for this repo. Enter there and descend using progressive disclosure principles.

   <!-- <<< kenkeep:kk-index <<< -->
   ```

2. Run `npx kenkeep index rebuild`.
3. Diff the file.

## Expected

The rebuild only touches the generated index content it owns (`ENTRY.md`, per-node `index.md`
files, `GRAPH.md`); the injected block in `AGENTS.md` keeps whatever line-wrapping it had, or at
minimum stays within the wrap width kenkeep itself used when it first wrote the block.

## Actual

The two-line paragraph inside the block is rewritten as a single unwrapped line:

```diff
 <!-- >>> kenkeep:kk-index >>> -->
+You are required to load [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md), the small curated entry catalog for this repo. Enter there and descend using progressive disclosure principles.
 
-You are required to load [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md), the small curated entry
-catalog for this repo. Enter there and descend using progressive disclosure principles.
 
 <!-- <<< kenkeep:kk-index <<< -->
```

That line is 179 characters, over this repo's 100-column `printWidth`. Running
`npm run format:check` immediately afterward fails:

```
> prettier --check .
Checking formatting...
[warn] AGENTS.md
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```

Exit code 1. Any repo that formats Markdown with `proseWrap: always` (or lints wrap width some
other way) gets a red CI build from a routine `kenkeep index rebuild`. Nothing in the content
changed, only the wrapping.

## Suggested fix

Preserve the existing line breaks inside the block when only the surrounding index is being
regenerated, or wrap the generated text to a configurable width (self-review currently works
around this by reverting `AGENTS.md` after each rebuild and re-wrapping by hand).
