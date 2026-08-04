---
id: 3
group: "forge-core"
dependencies: [2]
status: "pending"
created: 2026-08-04
skills:
  - typescript
  - github-api
complexity_score: 5
---
# GitHub provider backed by the gh CLI

## Objective
Implement the `ForgeProvider` interface for GitHub: base-branch lookup and review-thread
fetching through the `gh` CLI, normalizing GitHub review comments (threaded via
`in_reply_to_id`) into the forge-neutral thread shape, and degrading cleanly when `gh` is
absent or unauthenticated.

## Skills Required
TypeScript; GitHub REST review-comment semantics and the `gh` CLI.

## Acceptance Criteria
- [ ] `packages/core/src/github-provider.ts` implements `ForgeProvider` using an injected
      command-runner that invokes `gh` (never the network directly), honoring the URL's
      host for GitHub Enterprise-style hosts via `gh`'s own host handling.
- [ ] `fetchBaseBranch` returns the PR base branch name (e.g. via
      `gh pr view <number> --repo <owner>/<repo> --json baseRefName`).
- [ ] `fetchThreads` returns normalized threads: review comments grouped into threads by
      `in_reply_to_id`, document order preserved, forge usernames as turn authors,
      GitHub comment IDs as turn `remote-id` values.
- [ ] Anchors normalize correctly: `side`/`line`/`start_line` map to the neutral
      old/new + range shape; comments whose anchor is outdated (GitHub reports
      `line: null` / outdated position) are flagged `outdated: true`.
- [ ] When `gh` is missing (spawn ENOENT) or exits non-zero due to auth, the provider
      throws the typed unavailable error from task 2 — never a crash, never a retry.
- [ ] Fixture-based unit tests use captured/realistic `gh` JSON payloads covering: a
      single-comment thread, a reply chain, a multi-line range comment, an old-side
      (deleted line) comment, and an outdated-anchor comment.
- [ ] Verification: `npx vitest run packages/core/src/github-provider.test.ts` passes;
      `npm run test:unit` stays green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- All child-process execution follows the existing `packages/core/src/git.ts` runner
  pattern so tests inject a mock runner; no real `gh` invocation in unit tests.
- Read-only: only `gh` read subcommands (`pr view`, `api` GET). Nothing is ever posted.
- Resolved-state filtering is a GitLab concern; GitHub fetch returns all review threads
  (the interface's `includeResolved` option may be ignored here, document that in code
  only if non-obvious).

## Input Dependencies
Task 2: `ForgeProvider` interface, `ForgeUrl`, normalized thread types, typed
unavailable error.

## Output Artifacts
- `packages/core/src/github-provider.ts` (+ test), exported from the core index.
  Consumed by tasks 7 and 8.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Fetch review comments with
   `gh api repos/<owner>/<repo>/pulls/<number>/comments --paginate` (REST list gives
   `id`, `in_reply_to_id`, `user.login`, `body`, `path`, `side`, `line`, `start_line`,
   `start_side`, `original_line`). Group: a comment without `in_reply_to_id` roots a
   thread; replies attach to the thread whose root (or any member) ID matches.
2. Outdated detection: REST review comments carry `line: null` when the comment no longer
   applies to the head diff (`original_line` retains the historic anchor). Map
   `line === null` → `outdated: true`.
3. Side mapping: `side: 'LEFT'` → neutral `'old'`, `'RIGHT'` → `'new'`. Range:
   `start_line`..`line` when `start_line` present, else single line.
4. Non-github.com hosts: pass `GH_HOST`-style handling by using
   `--hostname`/repo-qualified forms as `gh` supports; keep it simple — derive from
   `ForgeUrl.host`.
5. Distinguish ENOENT (CLI absent) from non-zero exit (unauthenticated or API error) but
   surface both as the typed unavailable error with the underlying stderr in the message;
   callers print it to stderr and continue without threads.
6. Store fixtures as TypeScript constants or JSON in the test file, mirroring how existing
   core tests keep fixture strings inline.
</details>
