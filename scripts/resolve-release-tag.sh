#!/usr/bin/env bash
#
# Print the release tag that belongs to a reviewed commit, or nothing when that
# commit has no release.
#
# The release job must be able to resume packaging and upload after a run that
# already minted the tag, so the publication decision cannot be "did this run
# create a tag". It is instead "does a release exist for this commit", which
# holds on the first attempt and on every retry, and cannot drift onto an
# unrelated tag.
#
# semantic-release either tags the reviewed commit itself, or, with the
# @semantic-release/git plugin, tags the release commit it creates directly on
# top of it. Both are matched here; anything further away belongs to another
# release. Tags are read from the local repository, so fetch before calling.
#
# Usage: scripts/resolve-release-tag.sh <head-sha> [repo-dir]

set -uo pipefail

die() {
  echo "resolve-release-tag: $*" >&2
  exit 1
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <head-sha> [repo-dir]" >&2
  exit 2
fi

head_ref=$1
repo_dir=${2:-.}

cd "$repo_dir" || die "no such directory: $repo_dir"

head_sha=$(git rev-parse --verify --quiet "$head_ref^{commit}") ||
  die "unknown commit: $head_ref"

matches=()
while IFS= read -r tag; do
  [ -n "$tag" ] || continue
  commit=$(git rev-parse --verify --quiet "$tag^{commit}") || continue
  if [ "$commit" != "$head_sha" ]; then
    parent=$(git rev-parse --verify --quiet "$commit^1") || continue
    [ "$parent" = "$head_sha" ] || continue
  fi
  matches+=("$tag")
done < <(git tag --list 'v*')

case ${#matches[@]} in
  0) exit 0 ;;
  1) echo "${matches[0]}" ;;
  *) die "commit $head_sha has ${#matches[@]} release tags (${matches[*]}); refusing to guess" ;;
esac
