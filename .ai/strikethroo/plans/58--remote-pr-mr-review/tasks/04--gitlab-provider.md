---
id: 4
group: "forge-core"
dependencies: [2]
status: "completed"
created: 2026-08-04
skills:
  - typescript
  - gitlab-api
complexity_score: 5
---
# GitLab provider backed by the glab CLI

## Objective
Implement the `ForgeProvider` interface for GitLab (gitlab.com and self-hosted, e.g.
git.drupalcode.org): base-branch lookup and discussion fetching through the `glab` CLI,
normalizing GitLab discussions into the forge-neutral thread shape with
unresolved-threads-only as the default, and degrading cleanly when `glab` is absent or
unauthenticated.

## Skills Required
TypeScript; GitLab discussions API semantics and the `glab` CLI.

## Acceptance Criteria
- [x] `packages/core/src/gitlab-provider.ts` implements `ForgeProvider` using an injected
      command-runner that invokes `glab`, passing the URL's host so self-hosted instances
      work with zero configuration beyond `glab` auth.
- [x] `fetchBaseBranch` returns the MR target branch name.
- [x] `fetchThreads` returns normalized threads from MR discussions: the first note roots
      the thread, subsequent notes are ordered replies, GitLab usernames as authors,
      discussion/note IDs as `remote-id` values; system notes and non-diff discussions
      without positions map to file-level/review-level appropriately per the neutral shape.
- [x] Default fetch excludes resolved discussions; `includeResolved: true` includes them —
      both proven by unit tests.
- [x] Position objects (`position.old_line`/`new_line`, `old_path`/`new_path`) normalize
      to the neutral old/new anchor shape; multi-line positions (`line_range`) map to
      start/end.
- [x] When `glab` is missing or unauthenticated, the provider throws the typed unavailable
      error from task 2.
- [x] Fixture-based unit tests cover: unresolved single-note discussion, reply chain,
      resolved discussion (excluded by default, included with the option), old-side
      position, multi-line `line_range`, and a positionless (non-diff) discussion.
- [x] Verification: `npx vitest run packages/core/src/gitlab-provider.test.ts` passes;
      `npm run test:unit` deferred to the phase gate per orchestrator instruction
      (siblings mutating the tree); `npx tsc --noEmit -p packages/core/tsconfig.json`
      passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Same injectable-runner pattern as task 3; no real `glab` calls in tests.
- Read-only `glab` usage only (`mr view`, `api` GET). Nothing is ever posted.
- Owner may contain subgroup slashes — URL-encode the project path where the API requires
  it (`glab api projects/<encoded-path>/merge_requests/<iid>/discussions`).

## Input Dependencies
Task 2: `ForgeProvider` interface, `ForgeUrl`, normalized thread types, typed
unavailable error.

## Output Artifacts
- `packages/core/src/gitlab-provider.ts` (+ test), exported from the core index.
  Consumed by tasks 7 and 8.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Discussions endpoint: `glab api "projects/<path-encoded>/merge_requests/<iid>/discussions" --paginate`
   with `GITLAB_HOST=<host>` (or `--hostname` where supported) derived from `ForgeUrl.host`.
   Each discussion has `id` and `notes[]`; each note has `id`, `author.username`, `body`,
   `system`, `resolvable`, `resolved`, `position`.
2. Filter: drop `system: true` notes entirely. A discussion is resolved when all its
   resolvable notes are resolved — exclude such discussions unless `includeResolved`.
3. Anchors: `position.new_line` set → side `'new'`; only `position.old_line` set → side
   `'old'`. `line_range.start`/`end` give ranges (each end carries its own
   old_line/new_line — use the side consistent with the overall position). Use `new_path`
   for new-side anchors and `old_path` for old-side anchors. No position → thread with no
   anchor (mapper turns it into a file-level/review-level comment; if the neutral shape
   requires a file path and none exists, flag it so the mapper can decide — align with the
   shape defined in task 2).
4. Base branch: `glab api "projects/<path>/merge_requests/<iid>"` → `target_branch`
   (or `glab mr view <iid> --repo` with JSON output).
5. GitLab has no per-comment outdated flag equivalent to GitHub's; positions on old heads
   remain valid positions — set `outdated: false` and let drift warnings (task 8/9) inform
   the reviewer.
6. Error taxonomy identical to task 3: ENOENT and auth failures both surface as the typed
   unavailable error carrying stderr.
</details>
