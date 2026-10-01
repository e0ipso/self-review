#!/usr/bin/env bash
#
# Decide whether a workflow_run event is trusted enough to release from.
#
# The release workflow listens for completed CI runs on main, but a
# workflow_run job runs with this repository's secrets and permissions no
# matter what triggered the CI run, and the branch filter also matches a fork
# pull request whose branch happens to be called main. So before any job checks
# out or executes the triggering commit, this script proves from the event
# payload that the run was a successful CI run of a push to this repository's
# main branch, and from the GitHub API that the commit is still on main. It
# reads nothing from the commit it is judging; the workflow takes it from the
# default branch.
#
# Inputs, all through the environment so that no event field is ever spliced
# into a shell command:
#
#   EVENT_PATH                  workflow_run event payload
#                               (default: $GITHUB_EVENT_PATH)
#   EXPECTED_REPOSITORY         owner/name the run must belong to
#                               (default: $GITHUB_REPOSITORY)
#   EXPECTED_REPOSITORY_ID      its numeric id (default: $GITHUB_REPOSITORY_ID)
#   EXPECTED_BRANCH             branch the push must target (default: main)
#   EXPECTED_WORKFLOW           name of the workflow the run must be (default: CI)
#   PROVENANCE_COMPARE_COMMAND  command run as
#                                 <command> <owner/name> <head-sha> <branch>
#                               that prints the compare API status of
#                               <head-sha>...<branch>. Defaults to `gh api`;
#                               the regression suite substitutes a stub.
#   GITHUB_OUTPUT               when set, receives `head_sha=<sha>` on success
#
# On success the verified head sha is printed to stdout and the exit code is 0.
# Any other outcome, including an API failure, exits non-zero and prints
# nothing on stdout: an outage is not provenance.
#
# Usage: scripts/release/verify-provenance.sh

set -uo pipefail

reject() {
  echo "verify-provenance: rejected: $*" >&2
  exit 1
}

event_path=${EVENT_PATH:-${GITHUB_EVENT_PATH:-}}
expected_repository=${EXPECTED_REPOSITORY:-${GITHUB_REPOSITORY:-}}
expected_repository_id=${EXPECTED_REPOSITORY_ID:-${GITHUB_REPOSITORY_ID:-}}
expected_branch=${EXPECTED_BRANCH:-main}
expected_workflow=${EXPECTED_WORKFLOW:-CI}

[ -n "$expected_repository" ] || reject "EXPECTED_REPOSITORY is not set"
[ -n "$expected_repository_id" ] || reject "EXPECTED_REPOSITORY_ID is not set"
[ -n "$event_path" ] || reject "no event payload: EVENT_PATH is not set"
[ -f "$event_path" ] || reject "no event payload at $event_path"

# One jq pass pulls every field the decision needs, as strings, with absent
# fields rendered as "null" so they can never equal an expected value.
fields=$(jq -r '
  [
    .workflow_run.name,
    .workflow_run.event,
    .workflow_run.conclusion,
    .workflow_run.head_branch,
    .workflow_run.head_sha,
    .workflow_run.head_repository.full_name,
    .workflow_run.head_repository.id,
    .workflow_run.repository.full_name,
    .workflow_run.repository.id,
    .repository.full_name,
    .repository.id
  ] | map(tostring) | .[]' "$event_path" 2>/dev/null) ||
  reject "event payload at $event_path is not a workflow_run event"

{
  read -r workflow_name
  read -r event
  read -r conclusion
  read -r head_branch
  read -r head_sha
  read -r head_repository
  read -r head_repository_id
  read -r run_repository
  read -r run_repository_id
  read -r repository
  read -r repository_id
} <<<"$fields"

# The payload checks come first and cost nothing; the API is consulted only
# for a run that already looks trusted.
[ "$workflow_name" = "$expected_workflow" ] ||
  reject "workflow is '$workflow_name', expected '$expected_workflow'"
[ "$conclusion" = "success" ] ||
  reject "conclusion is '$conclusion', expected 'success'"
[ "$event" = "push" ] ||
  reject "event is '$event', expected 'push'"
[ "$head_branch" = "$expected_branch" ] ||
  reject "head_branch is '$head_branch', expected '$expected_branch'"
[ "$head_repository" = "$expected_repository" ] ||
  reject "head_repository is '$head_repository', expected '$expected_repository'"
[ "$head_repository_id" = "$expected_repository_id" ] ||
  reject "head_repository id is '$head_repository_id', expected '$expected_repository_id'"
[ "$run_repository" = "$expected_repository" ] ||
  reject "workflow_run repository is '$run_repository', expected '$expected_repository'"
[ "$run_repository_id" = "$expected_repository_id" ] ||
  reject "workflow_run repository id is '$run_repository_id', expected '$expected_repository_id'"
[ "$repository" = "$expected_repository" ] ||
  reject "event repository is '$repository', expected '$expected_repository'"
[ "$repository_id" = "$expected_repository_id" ] ||
  reject "event repository id is '$repository_id', expected '$expected_repository_id'"
[[ $head_sha =~ ^[0-9a-f]{40}$ ]] ||
  reject "head_sha '$head_sha' is not a full commit id"

# The payload says the push targeted main; the API says whether main still
# contains the commit. compare/<sha>...<branch> reports the branch's status
# relative to the commit: `identical` when the branch still points at it,
# `ahead` when later pushes landed on top of it. `behind` and `diverged` mean
# the commit is not on the branch any more (a force-push or reset), and nothing
# else is a known answer.
compare_default() {
  gh api "repos/$1/compare/$2...$3" --jq .status
}

compare=${PROVENANCE_COMPARE_COMMAND:-compare_default}
status=$("$compare" "$expected_repository" "$head_sha" "$expected_branch") ||
  reject "compare API call failed for $head_sha...$expected_branch; failing closed"

case $status in
  identical | ahead) ;;
  behind | diverged)
    reject "$head_sha is not reachable from $expected_branch (compare status '$status')"
    ;;
  *)
    reject "compare API returned '$status' for $head_sha...$expected_branch, which is not a known status"
    ;;
esac

echo "verify-provenance: accepted $head_sha: successful $expected_workflow run for a push to $expected_repository@$expected_branch, still on $expected_branch ($status)" >&2
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "head_sha=$head_sha" >>"$GITHUB_OUTPUT"
fi
echo "$head_sha"
