# Release security

How the release pipeline decides what it may publish, what each job is allowed to do, and the
repository settings it relies on. The pipeline is
`.github/workflows/release.yml` (Linux, npm, GitHub Release), which dispatches
`.github/workflows/release-darwin.yml` (macOS archive) and `.github/workflows/update-flake-hash.yml`
(Nix hash pull request). It also notifies `e0ipso/homebrew-self-review` through a
`self-review-release` repository dispatch after dispatching the macOS build. The tap waits up to
30 minutes for the macOS arm64 and Linux x64 ZIP assets to have sha256 digests.

## Provenance gate

`release.yml` runs on `workflow_run` when the `CI` workflow completes on `main`. No job checks out
or executes the triggering commit until the `provenance` job has accepted it.

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
API, so the trust decision is exercised offline against the accepted shape and each way an event
can fail one of the conditions above. Only the trusted shape is accepted, and every rejection the payload alone decides happens
before the API is consulted.

```bash
bash scripts/test/release-provenance.test.sh
bash scripts/test/resolve-release-tag.test.sh
node --test scripts/test/sync-workspace-versions.test.mjs
bash scripts/test/update-flake-hash.test.sh
```

## Jobs and permissions

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
commit and tag and create the GitHub Release; it installs, and lets `npm version` reinstall, with
lifecycle scripts disabled so no dependency's install script runs under those permissions, and it
holds no npm or OIDC permission. Before `@semantic-release/npm` bumps anything,
`scripts/release/sync-workspace-versions.mjs` gives every workspace the release version and moves
each sibling range that names a version (`^2.0.0`, not `*`) to it. Otherwise a major release leaves
a range the workspace no longer satisfies, and npm installs the sibling from the registry instead
of linking it; 2.0.0 failed that way. The `build` job refuses a lockfile that installs a sibling
from the registry.
The npm OIDC permission exists only in `publish`, which never checks out the repository.

Other properties of the files:

- every `actions/checkout` sets `persist-credentials: false`; the only step that needs the token
  is `Run semantic-release`, which receives it through `env` for that step alone;
- every action in these three workflows is pinned to a full commit SHA with its version in a
  comment;
- no `run:` script interpolates an event field or input with `${{ }}`; values reach shell through
  `env:`; the release tag is checked against a strict version shape before any job uses it;
- `release.yml` and `release-darwin.yml` publish only artifacts carried between jobs with
  `actions/upload-artifact` and `actions/download-artifact`, under the names the makers produced,
  so the artifact naming contract the Nix flake and the Homebrew tap rely on is unchanged.

## Repository settings

The workflow files cannot enforce these; the repository owner configures them:

- Actions: require approval before workflows run for outside contributors.
- `main`: require a pull request and the CI status checks before merging.
- Default `GITHUB_TOKEN` permissions: read-only.
- `HOMEBREW_TAP_DISPATCH_TOKEN` repository secret: a fine-grained PAT with resource owner `e0ipso`,
  repository access limited to `e0ipso/homebrew-self-review`, and repository permission
  **Contents: Read and write**, as required by GitHub's
  [Create a repository dispatch event](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)
  REST endpoint. `GITHUB_TOKEN` cannot dispatch to another repository. The `publish` job passes the
  PAT only to the Homebrew tap notification step through `env`. This secret must exist before the
  next release; if it is missing, that step fails and npm publishing does not run.
- npm trusted publishers for `@self-review/types`, `core`, `react` and `serve`: accept OIDC
  publication from `.github/workflows/release.yml`. If the trusted publisher names an environment,
  `publish` must declare the same `environment:`.
- No long-lived npm token in repository secrets; npm publishing uses OIDC. The pipeline uses
  `GITHUB_TOKEN` for this repository and the scoped PAT above to notify the Homebrew tap.
