#!/usr/bin/env bash
#
# Regression checks for scripts/release/verify-provenance.sh.
#
# Feeds the gate synthetic workflow_run event payloads and a stub in place of
# the GitHub compare API, so the trust decision the release workflow makes is
# checked offline: no GitHub, no live fork, no release. Only the trusted case
# (a successful CI run for a same-repository push to main whose commit is still
# on main) may be accepted; every other shape must be refused, and the ones the
# payload alone already rules out must be refused before the API is consulted.
#
# Usage: scripts/test/release-provenance.test.sh

set -uo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
subject="$repo_root/scripts/release/verify-provenance.sh"

REPO='e0ipso/self-review'
REPO_ID='1156189089'
FORK='mallory/self-review'
FORK_ID='424242'
SHA='0123456789abcdef0123456789abcdef01234567'

failures=0
passes=0

fail() {
  echo "not ok - $1" >&2
  failures=$((failures + 1))
}

pass() {
  echo "ok - $1"
  passes=$((passes + 1))
}

check() {
  local name=$1 expected=$2 actual=$3
  if [ "$expected" = "$actual" ]; then
    pass "$name"
  else
    fail "$name (expected '$expected', got '$actual')"
  fi
}

# check_grep <name> <pattern> <file>: the file mentions the pattern.
check_grep() {
  local name=$1 pattern=$2 file=$3
  if grep -q -- "$pattern" "$file" 2>/dev/null; then
    pass "$name"
  else
    fail "$name (no '$pattern' in $(tr '\n' ' ' <"$file"))"
  fi
}

# Writes a workflow_run event payload with the shape GitHub delivers, varying
# only the fields the gate decides on.
#   event <path> <event> <conclusion> <head_branch> <head_repo> <head_repo_id> <head_sha> [workflow_name]
event() {
  local path=$1 event=$2 conclusion=$3 branch=$4 head_repo=$5 head_repo_id=$6 sha=$7
  local name=${8:-CI}
  jq -n \
    --arg name "$name" --arg event "$event" --arg conclusion "$conclusion" \
    --arg branch "$branch" --arg head_repo "$head_repo" --arg head_repo_id "$head_repo_id" \
    --arg sha "$sha" --arg repo "$REPO" --arg repo_id "$REPO_ID" '
    {
      action: "completed",
      workflow_run: {
        name: $name,
        path: ".github/workflows/ci.yml",
        event: $event,
        status: "completed",
        conclusion: (if $conclusion == "null" then null else $conclusion end),
        head_branch: $branch,
        head_sha: $sha,
        head_repository: { id: ($head_repo_id | tonumber), full_name: $head_repo },
        repository: { id: ($repo_id | tonumber), full_name: $repo }
      },
      repository: { id: ($repo_id | tonumber), full_name: $repo, default_branch: "main" }
    }' >"$path"
}

# A stand-in for the compare API call. Records the arguments it was called
# with, prints the configured status and exits with the configured code.
#   stub <dir> <status> [exit-code]
stub() {
  local dir=$1 status=$2 code=${3:-0}
  cat >"$dir/compare" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$@" >"$dir/compare.args"
printf '%s\n' "$status"
exit $code
EOF
  chmod +x "$dir/compare"
}

# Runs the gate against <dir>/event.json with <dir>/compare as the API, the
# way the workflow does: every input through the environment. Captures stdout
# in $out, the exit code in $code, stderr in <dir>/stderr and anything the
# gate hands to later jobs in <dir>/output.
run_subject() {
  local dir=$1
  shift
  : >"$dir/output"
  out=$(
    env -i PATH="$PATH" HOME="$HOME" \
      EVENT_PATH="$dir/event.json" \
      EXPECTED_REPOSITORY="$REPO" \
      EXPECTED_REPOSITORY_ID="$REPO_ID" \
      EXPECTED_BRANCH=main \
      EXPECTED_WORKFLOW=CI \
      PROVENANCE_COMPARE_COMMAND="$dir/compare" \
      GITHUB_OUTPUT="$dir/output" \
      "$@" bash "$subject" 2>"$dir/stderr"
  )
  code=$?
}

# Every rejection has the same shape: non-zero exit, nothing on stdout, nothing
# handed to later jobs, and a stderr line naming the field that failed.
#   expect_rejected <name> <dir> <reason-pattern>
expect_rejected() {
  local name=$1 dir=$2 reason=$3
  check "$name: exit code" 1 "$code"
  check "$name: no sha on stdout" "" "$out"
  check "$name: nothing handed to later jobs" "" "$(cat "$dir/output")"
  check_grep "$name: names the reason" "$reason" "$dir/stderr"
}

expect_api_not_consulted() {
  local name=$1 dir=$2
  if [ -e "$dir/compare.args" ]; then
    fail "$name: refused before consulting the API"
  else
    pass "$name: refused before consulting the API"
  fi
}

# 1. The trusted shape: successful CI for a push to this repository's main,
#    and main still points at that commit.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
check "trusted push: exit code" 0 "$code"
check "trusted push: prints the verified sha" "$SHA" "$out"
check "trusted push: hands the sha to later jobs" "head_sha=$SHA" "$(cat "$dir/output")"
check "trusted push: asks the API about this repo, sha and branch" \
  "$(printf '%s\n%s\n%s' "$REPO" "$SHA" main)" "$(cat "$dir/compare.args")"
rm -rf "$dir"

# 2. main moved on after CI finished (another push landed). The commit is
#    still an ancestor of main, which is what the compare API calls "ahead".
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" ahead
run_subject "$dir"
check "main advanced: exit code" 0 "$code"
check "main advanced: prints the verified sha" "$SHA" "$out"
rm -rf "$dir"

# 3. The attack the branch filter lets through: a fork pull request from a
#    branch named main. Its CI run is a pull_request event whose head lives in
#    the fork.
dir=$(mktemp -d)
event "$dir/event.json" pull_request success main "$FORK" "$FORK_ID" "$SHA"
stub "$dir" ahead
run_subject "$dir"
expect_rejected "fork PR from a branch named main" "$dir" "event"
expect_api_not_consulted "fork PR from a branch named main" "$dir"
rm -rf "$dir"

# 4. A failed CI run, even for the trusted source. The workflow's own `if:`
#    also covers this, but the gate must not rely on it.
dir=$(mktemp -d)
event "$dir/event.json" push failure main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
expect_rejected "failed CI" "$dir" "conclusion"
expect_api_not_consulted "failed CI" "$dir"
rm -rf "$dir"

# 5. A conclusion that is missing altogether, which is what an in-progress run
#    carries. Null is not success.
dir=$(mktemp -d)
event "$dir/event.json" push null main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
expect_rejected "missing conclusion" "$dir" "conclusion"
rm -rf "$dir"

# 6. A pull_request event from this very repository. Only a push is accepted,
#    so a same-repository PR branch (which can also be called main in a PR
#    from a fork that was later transferred) never reaches the release.
dir=$(mktemp -d)
event "$dir/event.json" pull_request success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
expect_rejected "same-repo pull_request event" "$dir" "event"
expect_api_not_consulted "same-repo pull_request event" "$dir"
rm -rf "$dir"

# 7. A workflow_dispatch run on main. CI accepts manual dispatch so the
#    Electron tier can be exercised on a branch; a dispatch is not a release.
dir=$(mktemp -d)
event "$dir/event.json" workflow_dispatch success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
expect_rejected "workflow_dispatch event" "$dir" "event"
rm -rf "$dir"

# 8. A push to some other branch of this repository.
dir=$(mktemp -d)
event "$dir/event.json" push success release-candidate "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
expect_rejected "wrong branch" "$dir" "head_branch"
expect_api_not_consulted "wrong branch" "$dir"
rm -rf "$dir"

# 9. A push whose head lives in another repository.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$FORK" "$FORK_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
expect_rejected "wrong repository" "$dir" "head_repository"
expect_api_not_consulted "wrong repository" "$dir"
rm -rf "$dir"

# 10. The right name on the wrong repository: names can be reused after a
#     transfer or rename, ids cannot.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$FORK_ID" "$SHA"
stub "$dir" identical
run_subject "$dir"
expect_rejected "repository id mismatch" "$dir" "head_repository"
expect_api_not_consulted "repository id mismatch" "$dir"
rm -rf "$dir"

# 11. The commit is no longer on main: the branch was force-pushed or reset
#     after CI ran, so main and the commit have diverged.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" diverged
run_subject "$dir"
expect_rejected "head sha diverged from main" "$dir" "reachable"
rm -rf "$dir"

# 12. main is behind the commit: the commit is a descendant of main, not on it.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" behind
run_subject "$dir"
expect_rejected "head sha ahead of main" "$dir" "reachable"
rm -rf "$dir"

# 13. The API call fails. Fail closed: an outage is not provenance.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" "" 1
run_subject "$dir"
expect_rejected "API error" "$dir" "compare"
rm -rf "$dir"

# 14. The API answers something the gate does not understand.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" '<html>rate limited</html>'
run_subject "$dir"
expect_rejected "unexpected API answer" "$dir" "compare"
rm -rf "$dir"

# 15. A head_sha that is not a full commit id cannot be checked out exactly
#     and is never passed to the API or to later jobs.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" main
stub "$dir" identical
run_subject "$dir"
expect_rejected "malformed head sha" "$dir" "head_sha"
expect_api_not_consulted "malformed head sha" "$dir"
rm -rf "$dir"

# 16. The run belongs to a different workflow than CI.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA" 'Release (macOS)'
stub "$dir" identical
run_subject "$dir"
expect_rejected "wrong workflow" "$dir" "workflow"
expect_api_not_consulted "wrong workflow" "$dir"
rm -rf "$dir"

# 17. No event payload at all.
dir=$(mktemp -d)
stub "$dir" identical
run_subject "$dir"
expect_rejected "missing event file" "$dir" "event"
expect_api_not_consulted "missing event file" "$dir"
rm -rf "$dir"

# 18. A payload that is not JSON.
dir=$(mktemp -d)
echo 'not json' >"$dir/event.json"
stub "$dir" identical
run_subject "$dir"
expect_rejected "malformed event file" "$dir" "event"
expect_api_not_consulted "malformed event file" "$dir"
rm -rf "$dir"

# 19. The workflow forgot to say which repository it expects. Without the
#     expectation there is nothing to compare against, so refuse.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir" EXPECTED_REPOSITORY=
expect_rejected "missing expected repository" "$dir" "EXPECTED_REPOSITORY"
expect_api_not_consulted "missing expected repository" "$dir"
rm -rf "$dir"

# 20. Likewise for the repository id.
dir=$(mktemp -d)
event "$dir/event.json" push success main "$REPO" "$REPO_ID" "$SHA"
stub "$dir" identical
run_subject "$dir" EXPECTED_REPOSITORY_ID=
expect_rejected "missing expected repository id" "$dir" "EXPECTED_REPOSITORY_ID"
expect_api_not_consulted "missing expected repository id" "$dir"
rm -rf "$dir"

echo "passed: $passes, failed: $failures"
[ "$failures" -eq 0 ]
