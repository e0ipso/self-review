# Release security

How the release pipeline decides what it may publish, what each job is allowed to do, and the
repository settings the workflow files cannot enforce on their own. The pipeline is
`.github/workflows/release.yml` (Linux, npm, GitHub Release), which dispatches
`.github/workflows/release-darwin.yml` (macOS archive) and `.github/workflows/update-flake-hash.yml`
(Nix hash pull request).

## Trust boundary

`release.yml` runs on `workflow_run` when the `CI` workflow completes on `main`. A `workflow_run`
job runs with this repository's secrets and the permissions the workflow declares regardless of
what triggered the CI run, and the `branches: [main]` filter also matches a pull request from a
fork whose branch is named `main`. So no job in the pipeline checks out or executes the triggering
commit until the `provenance` job has accepted it.

### The provenance gate

`scripts/release/verify-provenance.sh` reads the event payload and refuses the run unless all of
the following hold:

- the run belongs to the `CI` workflow and its `conclusion` is `success`;
- the triggering `event` is `push` (not `pull_request`, not `workflow_dispatch`);
- `head_branch` is `main`;
- `head_repository`, the run's `repository` and the event's `repository` all name this repository
  by `full_name` and by numeric id (names can be reused after a transfer; ids cannot);
- `head_sha` is a full 40-character commit id;
- the GitHub compare API reports `head_sha...main` as `identical` or `ahead`, that is, `main`
  still contains the commit. `behind`, `diverged`, any other answer, or an API failure is refused:
  an outage is not provenance.

The script takes every input through the environment, never by splicing an event field into a
command, and is checked out from the default branch, never from the commit under judgement. Its
own regression suite, `scripts/test/release-provenance.test.sh`, runs in the gate job before the
gate does. The suite feeds synthetic `workflow_run` payloads and a stub in place of the compare
API, so the trust decision is exercised offline: a fork pull request from a branch named `main`, a
failed or unfinished CI run, `pull_request` and `workflow_dispatch` events, a push to another
branch, another repository, a reused name with the wrong id, a commit no longer on `main`, an API
error, an unparseable answer, a malformed sha, a missing or malformed payload, and the one trusted
shape. Only the trusted shape is accepted, and every rejection the payload alone decides happens
before the API is consulted.

```bash
bash scripts/test/release-provenance.test.sh
bash scripts/test/resolve-release-tag.test.sh
bash scripts/test/update-flake-hash.test.sh
```

### Jobs and permissions

Every workflow declares `permissions: {}` at the top, so a job holds only what it lists.

| Workflow              | Job          | Permissions                                       | Checks out                 | Runs repository code                                     |
| --------------------- | ------------ | ------------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| release.yml           | `provenance` | `contents: read`                                  | `scripts/` of `main`       | the gate and its tests, from `main`                      |
| release.yml           | `release`    | `contents`, `issues`, `pull-requests: write`      | the verified `head_sha`    | semantic-release; `npm ci --ignore-scripts`              |
| release.yml           | `build`      | `contents: read`                                  | the release commit         | full `npm ci`, `npm run make`, package builds, `npm pack` |
| release.yml           | `publish`    | `contents`, `id-token`, `actions: write`          | nothing                    | nothing: publishes the artifacts `build` uploaded        |
| release-darwin.yml    | `build`      | `contents: read`                                  | the dispatched tag         | full `npm ci`, `npm run make`                            |
| release-darwin.yml    | `upload`     | `contents: write`                                 | nothing                    | nothing: uploads the artifact `build` produced           |
| update-flake-hash.yml | `update`     | `contents`, `pull-requests: write`                | `main`                     | the hash updater and its tests                           |

Each downstream job is a hard `needs:` dependency of the gate, so a rejected run executes no
checked-out install, build or publication step at all. The `release` job is the one that both
writes and executes repository-controlled code, because semantic-release has to push the release
commit and tag and create the GitHub Release; it installs with lifecycle scripts disabled so no
dependency's install script runs under those permissions, and it holds no npm or OIDC permission.
The npm OIDC permission exists only in `publish`, which never checks out the repository.

Other properties of the files:

- every `actions/checkout` sets `persist-credentials: false`; the only step that needs the token
  is `Run semantic-release`, which receives it through `env` for that step alone;
- every action in these three workflows is pinned to a full commit SHA with its version in a
  comment, including the Nix installer that previously tracked `main`;
- no `run:` script interpolates an event field or input with `${{ }}`; values reach shell through
  `env:`; the release tag is checked against a strict version shape before any job uses it;
- `release.yml` and `release-darwin.yml` publish only artifacts carried between jobs with
  `actions/upload-artifact` and `actions/download-artifact`, under the names the makers produced,
  so the artifact naming contract the Nix flake and the Homebrew tap rely on is unchanged.

## Release prerequisites

These are settings the workflow files cannot prove or enforce. What follows was read on
2026-10-01 against `e0ipso/self-review` (repository id `1156189089`) with unauthenticated,
read-only GitHub API calls; the `gh` CLI was not available in the inspecting environment, and
nothing was changed. Endpoints that answered `401 Requires authentication` are recorded as not
inspectable with the available permissions.

| Setting                                    | What the pipeline needs                                                                                                                                                                                    | Finding (2026-10-01)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fork pull request workflow approval        | "Require approval for all external contributors" (or stricter) under Actions settings, so fork CI runs do not execute without review. The gate rejects fork runs regardless, but CI itself still runs them. | Not inspectable: `GET /repos/{owner}/{repo}/actions/permissions` and `.../actions/permissions/workflow` returned 401. Owner-managed.                                                                                                                                                                                                                                                                                                       |
| Branch protection on `main`                | Direct pushes to `main` are indistinguishable from merges to the gate: both are same-repository pushes. Requiring a pull request and the CI status checks keeps "accepted by the gate" equal to "reviewed". | Partly inspectable. One active ruleset, `Protect main` (id `12765112`, target `~DEFAULT_BRANCH`, no bypass actors) with rules `deletion` and `non_fast_forward` only. `GET .../branches/main` reports `protected: true` but `protection.enabled: false` and `required_status_checks.enforcement_level: off`. So force-push and deletion are blocked; a required pull request, required reviews, required status checks and signed commits are not configured. `GET .../branches/main/protection` returned 401. |
| Default `GITHUB_TOKEN` permissions         | The release workflows declare `permissions: {}` and per-job grants, so they do not depend on the repository default. `ci.yml` declares none and inherits it.                                                 | Not inspectable: `GET .../actions/permissions/workflow` returned 401. Owner-managed; "Read repository contents and packages permissions" is the setting to confirm.                                                                                                                                                                                                                                                                       |
| npm trusted publisher                      | Each of `@self-review/types`, `core`, `react`, `serve` must accept OIDC publication from this repository's `.github/workflows/release.yml` (the file name is unchanged by this work). If the trusted publisher names an environment, the `publish` job must declare that same `environment:`. | Not inspectable: npm trusted-publisher configuration is visible only to the package owner. Observed indirectly: `npm view @self-review/core@1.45.0 dist.attestations` returns a SLSA v1 provenance attestation, and the workflow publishes with an empty `NODE_AUTH_TOKEN`, so 1.45.0 was published through OIDC from this workflow file. Whether direct publication with a token is also still permitted is not visible.                   |
| Protected `release` environment            | Optional additional gate: an environment with required reviewers on `publish` (and on the darwin `upload` job) means a human approves each publication. Branch restrictions on the environment alone do not help: `workflow_run` runs in the default-branch context. | Inspected: `GET .../environments` returned `total_count: 0`. No environment is configured. If one is added, add `environment: <name>` to `publish` and to the npm trusted-publisher configuration.                                                                                                                                                                                                                                         |
| Repository secrets and variables           | The pipeline uses only `GITHUB_TOKEN` and OIDC; no long-lived npm token should exist.                                                                                                                      | Not inspectable: `GET .../actions/secrets` and `.../actions/variables` returned 401.                                                                                                                                                                                                                                                                                                                                                       |

## What the gate does not cover

- Anyone who can push to `main` can release. The gate establishes provenance, not review; the
  branch protection row above is what turns one into the other.
- The `release` job executes semantic-release and its plugins from the lockfile, with the
  repository's `.releaserc.json`, under `contents`, `issues` and `pull-requests: write`. A
  malicious commit on `main` or a compromised dependency in that set runs with those permissions.
  Lifecycle scripts are off in that job; nothing is off in `build`, which has no write permission.
- `publish` trusts the artifacts `build` uploaded within the same workflow run. Artifact integrity
  across jobs is GitHub's; the job does not re-verify the tarballs.
- The macOS and Nix workflows are dispatched with a tag chosen by `publish`. Dispatching either by
  hand needs `actions: write`, which is already a privileged position; both still validate the tag
  shape and pass it only through `env`.
- Desktop artifacts are not signed, notarized or attested. The Nix flake pins unpacked-source
  hashes; the Homebrew tap's checks live outside this repository.
