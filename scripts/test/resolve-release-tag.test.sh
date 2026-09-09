#!/usr/bin/env bash
#
# Regression checks for scripts/resolve-release-tag.sh.
#
# Builds throwaway git repositories that mirror the release job's history
# shapes, so the publication decision is checked offline with no network, no
# GitHub and no semantic-release run.
#
# Usage: scripts/test/resolve-release-tag.test.sh

set -uo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
subject="$repo_root/scripts/resolve-release-tag.sh"

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid

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

commit() {
  git -C "$1" commit -q --allow-empty -m "$2"
}

# A repository whose main branch carries a previous release, then the commit CI
# ran against. Echoes that commit's sha.
new_repo() {
  local dir=$1
  git init -q -b main "$dir"
  commit "$dir" "feat: earlier work"
  git -C "$dir" tag v1.2.2
  commit "$dir" "feat: the change under release"
  git -C "$dir" rev-parse HEAD
}

# What semantic-release leaves behind with the @semantic-release/git plugin:
# a release commit on top of the reviewed commit, carrying the tag.
add_release_commit() {
  local dir=$1 tag=$2
  commit "$dir" "chore(release): ${tag#v} [skip ci]"
  git -C "$dir" tag "$tag"
}

run_subject() {
  "$subject" "$1" "$2" 2>"$2/stderr"
}

# 1. A run with no release publishes nothing.
dir=$(mktemp -d)
head=$(new_repo "$dir/repo")
out=$(run_subject "$head" "$dir/repo")
check "no release: exit code" 0 "$?"
check "no release: no tag" "" "$out"
rm -rf "$dir"

# 2. The first successful run resolves the tag semantic-release just created.
dir=$(mktemp -d)
head=$(new_repo "$dir/repo")
add_release_commit "$dir/repo" v1.2.3
out=$(run_subject "$head" "$dir/repo")
check "first run: exit code" 0 "$?"
check "first run: resolves the new tag" "v1.2.3" "$out"
rm -rf "$dir"

# 3. The regression: a retry after the tag exists still resumes. The reviewed
#    commit is no longer the branch tip and `git describe` from it reports the
#    previous tag, which is what made the old check skip the packaging steps.
dir=$(mktemp -d)
head=$(new_repo "$dir/repo")
add_release_commit "$dir/repo" v1.2.3
commit "$dir/repo" "docs: work that landed after the release"
git -C "$dir/repo" checkout -q -B main "$head"
described=$(git -C "$dir/repo" describe --tags --abbrev=0 2>/dev/null)
check "retry: describe still reports the previous tag" "v1.2.2" "$described"
out=$(run_subject "$head" "$dir/repo")
check "retry: exit code" 0 "$?"
check "retry: resumes the same release" "v1.2.3" "$out"
rm -rf "$dir"

# 4. Without the git plugin the tag sits on the reviewed commit itself.
dir=$(mktemp -d)
head=$(new_repo "$dir/repo")
git -C "$dir/repo" tag v1.2.3 "$head"
out=$(run_subject "$head" "$dir/repo")
check "tag on the reviewed commit: resolves it" "v1.2.3" "$out"
rm -rf "$dir"

# 5. A later release belongs to a different commit and is never borrowed.
dir=$(mktemp -d)
head=$(new_repo "$dir/repo")
commit "$dir/repo" "feat: an unrelated later change"
add_release_commit "$dir/repo" v1.3.0
out=$(run_subject "$head" "$dir/repo")
check "another commit's release: exit code" 0 "$?"
check "another commit's release: not selected" "" "$out"
rm -rf "$dir"

# 6. Two candidate tags are refused rather than guessed at.
dir=$(mktemp -d)
head=$(new_repo "$dir/repo")
add_release_commit "$dir/repo" v1.2.3
git -C "$dir/repo" tag v1.2.4
out=$(run_subject "$head" "$dir/repo")
check "ambiguous tags: exit code" 1 "$?"
check "ambiguous tags: no tag" "" "$out"
if grep -q 'refusing to guess' "$dir/repo/stderr"; then
  pass "ambiguous tags: explains why"
else
  fail "ambiguous tags: explains why"
fi
rm -rf "$dir"

# 7. A commit the repository does not have is an error, not a silent skip.
dir=$(mktemp -d)
new_repo "$dir/repo" >/dev/null
out=$(run_subject "0000000000000000000000000000000000000000" "$dir/repo")
check "unknown commit: exit code" 1 "$?"
check "unknown commit: no tag" "" "$out"
rm -rf "$dir"

echo "passed: $passes, failed: $failures"
[ "$failures" -eq 0 ]
