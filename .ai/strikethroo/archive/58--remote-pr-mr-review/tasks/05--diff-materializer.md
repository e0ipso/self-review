---
id: 5
group: "materialization"
dependencies: [2]
status: "completed"
created: 2026-08-04
skills:
  - typescript
  - git
complexity_score: 6
complexity_notes: "Two materialization paths plus lifecycle management, but they share ref-fetch/SHA-resolution machinery and splitting them would leave neither independently verifiable; emitted at 6 with that explicit reason"
---
# Clone-aware diff materializer

## Objective
Implement the materializer in `@self-review/core`: turn a parsed forge URL into a local
git context — reusing an existing matching clone at CWD (fetch base/head refs, no
working-tree changes) or creating a disposable blobless clone in the OS temp directory —
and report the resolved base/head SHAs so everything downstream is the existing local
git-mode pipeline at full fidelity.

## Skills Required
TypeScript; git plumbing (clone filters, well-known PR/MR refs, remote matching,
merge-base-safe fetching).

## Acceptance Criteria
- [x] `packages/core/src/materializer.ts` exports a `materialize` function taking a
      `ForgeUrl`, a base branch name, and a working directory, returning
      `{ repoPath, baseSha, headSha, mode: 'existing-clone' | 'temp-clone', cleanup }`.
- [x] Existing-clone path: when the given directory is inside a git repository with a
      remote whose host and owner/repo match the `ForgeUrl` (SSH and HTTPS remote formats
      both recognized, `.git` suffix tolerated), base and head refs are fetched into it
      with no checkout and no working-tree change, and that repo path is returned.
- [x] Temp-clone path: otherwise, a blobless clone (`--filter=blob:none`, never
      `--depth`) of the URL's repository is created in a uniquely named directory under
      the OS temp root, the PR/MR head ref is fetched, and `cleanup()` removes exactly
      that directory.
- [x] Head refs come from the forges' well-known git refs — `refs/pull/N/head` (GitHub),
      `refs/merge-requests/N/head` (GitLab) — via plain git; no forge API use anywhere in
      this module.
- [x] The chosen path is reported on stderr (`console.error`), including the temp
      directory when one is created.
- [x] Git failures (unreachable/private repo) propagate git's own stderr verbatim in the
      thrown error, augmented with a hint that `gh auth setup-git` /
      `glab auth git-credential` wires CLI credentials into git; no alternative ingestion
      path exists.
- [x] Unit tests with an injected command-runner cover: remote-match detection (SSH form,
      HTTPS form, `.git` suffix, non-matching remote, not a repo), correct git invocations
      for both paths (blobless flag present, depth flag absent, correct refspecs), SHA
      resolution, cleanup removing only the created directory, and error propagation with
      the auth hint.
- [x] Verification: `npx vitest run packages/core/src/materializer.test.ts` passes;
      `npm run test:unit` stays green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Follow the injectable command-runner pattern of `packages/core/src/git.ts` so unit tests
  never spawn real git; integration behavior is validated later in Self Validation.
- The base ref for the diff: fetch the base branch from the remote and resolve its SHA;
  head SHA resolves from the fetched PR/MR head ref. The caller diffs `baseSha...headSha`
  through the existing pipeline — the materializer itself runs no diff.
- Fetches into an existing clone must be read-only for the working tree: fetch into
  namespaced local refs (e.g. `refs/self-review/base`, `refs/self-review/head`) or use
  `FETCH_HEAD` SHAs; never create branches, never checkout.
- Cleanup ownership: the materializer alone creates and removes temp directories; it only
  ever deletes a directory it created this run. Callers (tasks 7, 8) invoke `cleanup` on
  exit through their existing exit-handler paths.
- The materializer fetches the live head by construction, which is where drift comparison
  against a recorded `remote-head-sha` happens — return the live `headSha` so callers can
  compare; no dedicated network check anywhere.

## Input Dependencies
Task 2: `ForgeUrl` type (host/owner/repo/number/forge).

## Output Artifacts
- `packages/core/src/materializer.ts` (+ test), exported from the core index. Consumed by
  tasks 7 and 8 (and referenced by skill docs in task 10).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Remote matching: run `git remote -v` (via the runner) in the candidate directory;
   normalize each remote URL (strip protocol, credentials, `.git`) and compare
   host + owner/repo case-insensitively against the `ForgeUrl`.
2. Clone URL construction for the temp path: `https://<host>/<owner>/<repo>.git` — git's
   credential machinery (helpers, `gh auth setup-git`) handles auth; our code performs no
   transport selection.
3. Suggested git sequence, temp path:
   `git clone --filter=blob:none <url> <tmpdir>` →
   `git -C <tmpdir> fetch origin <headRef>:refs/self-review/head` →
   resolve SHAs with `git -C <tmpdir> rev-parse refs/self-review/head` and
   `git -C <tmpdir> rev-parse origin/<baseBranch>`.
   Existing-clone path: `git fetch <matched-remote> <baseBranch>:refs/self-review/base <headRef>:refs/self-review/head`
   (forced refspec updates are fine — these refs are ours), then `rev-parse` both.
4. Temp dir naming: `fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-'))`. `cleanup`
   uses `fs.rmSync(dir, { recursive: true, force: true })` guarded by a "created by me
   this run" check. Crash leftovers live under the OS temp area by design.
5. Base branch name arrives as a parameter (provider lookup, tasks 3/4). When the caller
   has no provider available, it may pass a fallback the caller derives (e.g. the remote
   HEAD via `git ls-remote --symref <url> HEAD`) — expose a small helper for that here so
   CLI-less operation (success criterion 5) still materializes. Keep the helper git-only.
6. Do not import Electron or app modules; this is core library code like `git.ts`.
</details>
