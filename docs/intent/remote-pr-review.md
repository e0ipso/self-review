# Intent: Remote PR/MR Review

Confirmed statement of intent, extracted via interview on 2026-08-03. This document records
*what* is wanted and *why*; implementation planning is downstream of it.

## Outcome

Review GitHub PRs and GitLab MRs inside self-review's guided mode — the LLM-authored
walkthrough guide wrapped around the remote diff, existing discussion threads visible in-app,
and findings postable back to the PR/MR.

## User

Solo developers (the maintainer first) reviewing large agent-authored PRs where the forges'
flat file lists kill reviews. The guide is the differentiator; GitHub/GitLab are just where
the diffs live.

## Architecture

- A `ForgeProvider` abstraction in `@self-review/core` with GitHub and GitLab implementations:
  `parseUrl`, `fetchDiff`, `fetchThreads` (normalized to the review model), `fetchBlob`,
  `postReview`.
- Primary transport: `gh` / `glab` CLIs (private repos, comment sync, posting).
- Anonymous fallback when the CLI is absent or unauthenticated: `<URL>.diff` plus the forge's
  raw-blob endpoint. Public repos only, no comment sync, subject to forge-side diff size caps.
- The app's "no network access" rule gains a documented exception, triggered only by a
  user-supplied PR/MR URL. No telemetry, no other network paths.
- Entry points: CLI argument (a PR/MR URL) and a URL input field on the splash/welcome screen.
  The flow stays CWD-independent; no local clone is required.
- Rendered image/SVG previews fetch blobs remotely through the provider. Expand-context is
  hidden in remote mode (v1).

## Deterministic core

- Remote discussion threads ↔ `review.xml` mapping is pure code in `@self-review/core` — no
  LLM anywhere in that pipeline.
- Exposed as symmetric subcommands: `self-review fetch-comments <URL>` and
  `self-review post <URL>`.
- Posting pushes only comments/replies lacking a `remote-id`, batched as a single review
  (COMMENT-level; no approve/request-changes verdict), anchored to the recorded head SHA.
- Suggestions translate per-forge (GitHub ```` ```suggestion ```` blocks, GitLab
  ```` ```suggestion:-0+0 ```` syntax).
- GitLab `fetch-comments` defaults to unresolved threads only, with a flag to include all.
- GitHub comments on outdated diffs (no valid line anchor) map to file-level comments.

## Schema (v3, amended additively in place)

- Optional `remote-id` attribute on `<comment>` and `<reply>` for round-trip identity.
- Optional root attributes `remote-url`, `remote-base-sha`, `remote-head-sha`, `remote-forge`
  (`github` | `gitlab`) forming a third mutually exclusive source shape alongside
  `git-diff-args`/`repository` (git mode) and `source-path` (directory mode). `remote-forge`
  exists because self-hosted GitLab is not detectable from the hostname.
- No namespace bump: local reviews stay byte-identical v3; every existing v3 document remains
  valid against the amended XSD. The freeze convention is reworded to "v1/v2 frozen; the
  current version may gain optional attributes additively."
- `author` remains a pure display name. Absent `author` still means human, and the
  last-human-turn tie-breaker semantics are untouched. Remote identity never goes in `author`.

## Drift safety

Reviews pin to the recorded `remote-head-sha`. Resume and post compare against the live head
and warn when the PR/MR has moved since the review; posting anchors comments to the reviewed
commit so the forge marks them outdated gracefully.

## Guide integration

`/self-review-guide <PR-URL>` resolves the PR to a diff through the same provider machinery
and writes the guide sidecar; the app discovers it at launch exactly as it does today.
`self-review-apply` and the guide skill each grow a third source branch (remote URL) for
reconstructing diff context.

## Success

Hand `/self-review-guide` a PR URL, open self-review with the same URL, review with the guide,
and the comments land on the PR as threads — without ever cloning the repo.

## Out of scope (v1)

- Expand-context in remote mode (feature hidden, not broken). *(Narrowed by the 2026-08-04
  amendment: hidden only in the `.diff` last-resort tier; it works in clone-backed tiers.)*
- Review verdicts (approve / request-changes).
- Live comment sync or refresh while the app is open.
- Resolved-state representation in the schema.
- Gitea, Bitbucket, or other forges.
- Editing or deleting comments that live on the forge (one-way push of new material only).

## Amendment — 2026-08-04: clone-aware materialization

Raised during a self-review of plan 58 (three questions on the "no clone" strategy). The
diff is now materialized through local git whenever possible, in tiers:

1. **Existing clone reused** when CWD is a git repository whose remote matches the URL:
   base/head refs are fetched (no working-tree changes) and the local pipeline runs as-is.
2. **Temporary shallow clone** otherwise (OS temp directory, removed on exit) — anonymous
   HTTPS for public repos, `gh`/`glab` credentials for private ones. Remote review becomes
   peri-local: after this step everything downstream is existing local machinery.
3. **Anonymous `<URL>.diff`** demoted to last resort, only when cloning is impossible or
   fails; this tier alone is degraded (no expand-context, no image/SVG previews, no
   surrounding code for the guide/critique skills).

Consequences: expand-context and image/SVG previews work at full fidelity in tiers 1–2 (the
original "expand-context hidden in remote mode" applies only to tier 3); the `ForgeProvider`
sheds diff/blob fetching in clone-backed tiers and focuses on URL/ref resolution, thread
sync, posting, and the `.diff` fallback; the guide/critique skills read surrounding code
from the materialized clone instead of reasoning from a bare diff. The "Success" scenario
reads "without ever *manually* cloning the repo" — a disposable clone is an implementation
detail, not a user step.

## Amendment — 2026-08-04 (refinement): no fallbacks, git owns transport

Confirmed during refinement of plan 58:

- **The `.diff` last-resort tier is deleted.** Every scenario that would need it (private
  repo without auth, unreachable forge, oversized diff) also breaks `.diff` itself. Remote
  mode is always clone-backed and always full fidelity; no degraded mode exists anywhere.
- **Git owns all git-shaped transport and auth.** Clone, ref fetch, diff, and blobs run
  through git and its own credential machinery; head refs come from the forges' well-known
  refs (`refs/pull/N/head`, `refs/merge-requests/N/head`). Our code performs no
  anonymous-vs-authenticated transport selection.
- **`gh`/`glab` serve only the conversation plane** (base-branch lookup, thread fetch,
  posting). Nothing is ever pushed to the git repository. Without the CLIs, a PR/MR that
  git can reach still reviews fully; comment sync and posting report as unavailable.
- **Temporary clones are blobless** (`--filter=blob:none`), not depth-limited, so
  merge-base and three-dot diffs stay correct and blobs load lazily through git.
- **Posting semantics**: new threads go as one batched COMMENT-level review; replies to
  existing threads are individual per-thread calls; `post` writes forge-assigned
  `remote-id`s back into the document after each successful call, making re-runs no-ops and
  partial failures resumable.
- **Self-hosted GitLab is in scope** — git.drupalcode.org (Drupal MR review) is a prime use
  case. Forge detection uses the URL path shape (`/pull/N` → GitHub, `/-/merge_requests/N`
  → GitLab), so self-hosted hosts need zero configuration; `remote-forge` stays in the
  schema for consumers.
- The out-of-scope entry "expand-context in remote mode" is deleted outright — it works
  everywhere now.

## Amendment — 2026-08-04 (descope): no posting in this feature

Posting `review.xml` back to the forge is **removed from this feature's scope** (it was an
original outcome; this is a deliberate descope decision, not a correction). The feature is
read-only toward the forge: materialize the diff, sync existing threads in, review, write
`review.xml`. Consequences:

- The `self-review post` subcommand, the posting direction of the thread mapper,
  suggestion-syntax translation, and all posting-related risks and success criteria are
  removed. Nothing is ever sent to the forge.
- `gh`/`glab` shrink to base-branch lookup and thread fetch, both optional; without them a
  git-reachable PR/MR still reviews fully and thread sync reports as unavailable.
- **`remote-id` stays, as deliberate forward machinery**: posting is wanted as a future
  feature, so `fetch-comments` records forge thread/comment IDs now and the parser and
  serializer preserve them through resume/save round-trips. Nothing consumes the attribute
  in this feature; it exists so documents produced today remain usable when posting lands.
- The Success scenario becomes: hand `/self-review-guide` a PR/MR URL, open self-review
  with the same URL, review with the guide and the existing threads in context, and save
  `review.xml` — without manually cloning anything.
- "Editing or deleting comments that live on the forge" remains out of scope and is now
  joined by posting itself.
