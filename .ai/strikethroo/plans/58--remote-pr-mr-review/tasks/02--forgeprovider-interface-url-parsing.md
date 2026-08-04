---
id: 2
group: "forge-core"
dependencies: []
status: "pending"
created: 2026-08-04
skills:
  - typescript
complexity_score: 3
---
# ForgeProvider interface, URL parsing, and normalized thread types

## Objective
Define the conversation-plane `ForgeProvider` abstraction in `@self-review/core`: URL
parsing with forge detection by path shape, the provider interface (base-branch lookup,
thread fetch), and the normalized discussion-thread types both providers must produce.

## Skills Required
TypeScript library design in `@self-review/core` (pure code, no I/O in this task).

## Acceptance Criteria
- [ ] A new module `packages/core/src/forge-provider.ts` exports a `parseForgeUrl(url)`
      function returning `{ forge: 'github' | 'gitlab', host, owner, repo, number }` or
      `null` for non-forge URLs. Detection is by URL path shape only: `/pull/N` → GitHub,
      `/-/merge_requests/N` → GitLab (any host, covering self-hosted GitLab such as
      git.drupalcode.org, with zero configuration).
- [ ] GitLab subgroup paths (e.g. `https://gitlab.com/group/subgroup/project/-/merge_requests/5`)
      parse correctly (`owner` holds the full namespace path).
- [ ] The `ForgeProvider` interface covers exactly the conversation plane:
      base-branch lookup and `fetchThreads` returning normalized threads. No diff fetching,
      no blob fetching, no posting.
- [ ] Normalized thread types are defined: a thread has an ordered root + replies, each
      turn carrying body, forge author username, and forge-assigned ID; the root also
      carries the anchor data needed by the mapper (file path, old/new line, line range,
      side/position info, outdated flag) in a forge-neutral shape.
- [ ] Unit tests cover: GitHub PR URL, gitlab.com MR URL, self-hosted GitLab MR URL
      (git.drupalcode.org), subgroup MR URL, trailing-slash and query-string variants,
      and rejection of non-forge URLs (plain repo URL, issue URL, arbitrary string).
- [ ] Verification: `npx vitest run packages/core/src/forge-provider.test.ts` passes;
      `npm run test:unit` stays green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Pure code only — this task defines contracts; implementations (tasks 3, 4) do the
  child-process work. Design the interface so implementations receive an injectable
  command-runner (mirroring how `packages/core/src/git.ts` stays testable).
- Export everything through `packages/core/src/index.ts` following the existing pattern.
- The normalized thread shape is the single contract the mapper (task 6) consumes; design
  it forge-neutrally so the mapper contains no `if (github)` branches for anchoring basics
  (the outdated-anchor degradation flag is part of the neutral shape).

## Input Dependencies
None — current codebase only.

## Output Artifacts
- `packages/core/src/forge-provider.ts` (+ test) with `parseForgeUrl`, the `ForgeProvider`
  interface, and normalized thread types. Consumed by tasks 3, 4, 5, 6, 7, 8.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `packages/core/src/git.ts` for the injectable-runner pattern and
   `packages/core/src/index.ts` for the export style.
2. Parse with the WHATWG `URL` class; match the pathname against
   `/^\/(?<owner>.+)\/(?<repo>[^/]+)\/pull\/(?<number>\d+)/` for GitHub and
   `/^\/(?<owner>.+)\/(?<repo>[^/]+)\/-\/merge_requests\/(?<number>\d+)/` for GitLab.
   For GitLab, `owner` may contain slashes (subgroups); for GitHub it is a single segment.
3. Suggested types: `ForgeUrl`, `ForgeThread`, `ForgeThreadTurn`, `ForgeThreadAnchor`.
   The anchor needs: `filePath`, `side: 'old' | 'new'`, `startLine`, `endLine`
   (equal for single-line), and `outdated: boolean` (true when the forge reports the
   anchor no longer applies to the current head — GitHub outdated comments; the mapper
   degrades these to file-level).
4. Interface sketch:
   `interface ForgeProvider { readonly forge: 'github' | 'gitlab'; fetchBaseBranch(url: ForgeUrl): Promise<string>; fetchThreads(url: ForgeUrl, opts?: { includeResolved?: boolean }): Promise<ForgeThread[]> }`
   plus a typed "unavailable" error (e.g. `ForgeCliUnavailableError`) implementations throw
   when their CLI is absent/unauthenticated, so callers can degrade cleanly.
5. Keep this module free of Node-specific imports beyond what `git.ts` already uses; the
   parse function itself must be pure.
</details>
