#!/usr/bin/env bash
# Prepare one isolated worker branch without checking out the integration branch.
# Tracker paths stay in the original tree; pass SIFT_ROOT explicitly to workers.
set -euo pipefail
if [ "$#" -ne 3 ]; then
  echo 'usage: prepare-worktree.sh <base-branch> <new-branch> <absolute-new-path>' >&2
  exit 1
fi
BASE=$1
BRANCH=$2
WORKTREE=$3
case "$WORKTREE" in
  /*) ;;
  *) echo 'worktree path must be absolute' >&2; exit 1 ;;
esac
[ ! -e "$WORKTREE" ] && [ ! -L "$WORKTREE" ] || {
  echo "worktree path already exists: $WORKTREE" >&2; exit 1;
}
git check-ref-format --branch "$BASE" >/dev/null
git check-ref-format --branch "$BRANCH" >/dev/null
COMMIT=$(git rev-parse --verify "$BASE^{commit}")
git worktree add -b "$BRANCH" "$WORKTREE" "$COMMIT"
printf 'worktree=%s\nbranch=%s\nbase=%s\n' "$WORKTREE" "$BRANCH" "$COMMIT"
