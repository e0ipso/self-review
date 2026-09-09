#!/usr/bin/env bash
#
# Install the Nix source hash for one supported system into flake.nix.
#
# fetchzip pins the hash of the unpacked archive directory, not the hash of the
# downloaded zip bytes. Those are different values: two zips built from the same
# tree hash differently, so an archive hash can never satisfy fetchzip's
# integrity check. This script prefetches with the same unpacking semantics the
# consumer uses, refuses a value that is merely the archive hash, and proves the
# result by building the real fetchzip source.
#
# Usage: scripts/update-flake-hash.sh <nix-system> [flake-dir]
#   nix-system  e.g. x86_64-linux
#   flake-dir   directory holding flake.nix (default: the repository root)

set -euo pipefail

die() {
  echo "update-flake-hash: $*" >&2
  exit 1
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <nix-system> [flake-dir]" >&2
  exit 2
fi

system=$1
flake_dir=${2:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}
flake_file="$flake_dir/flake.nix"
installable="$flake_dir#packages.$system.default.src"

[ -f "$flake_file" ] || die "no flake.nix in $flake_dir"

# The consumer owns the artifact URL and the unpacking options. Read the URL
# back off the derivation instead of rebuilding it here, so the updater cannot
# hash a different artifact than the one the flake fetches.
url=$(nix derivation show "$installable" | jq -r 'first(.[]).env.urls' | awk '{print $1}')
[ -n "$url" ] && [ "$url" != "null" ] || die "could not read the source URL from $installable"

prefetch_sri() {
  nix store prefetch-file --hash-type sha256 --json "$@" | jq -er '.hash'
}

unpacked_hash=$(prefetch_sri --unpack "$url") || die "prefetch of the unpacked $url failed"
archive_hash=$(prefetch_sri "$url") || die "prefetch of $url failed"

if [ "$unpacked_hash" = "$archive_hash" ]; then
  die "prefetch returned the raw archive hash for $url; fetchzip needs the unpacked directory hash"
fi

matches=$(grep -c '^\([[:space:]]*\)hash = "sha256-[^"]*";$' "$flake_file" || true)
[ "$matches" = "1" ] || die "expected exactly one source hash in $flake_file, found $matches"

# shellcheck disable=SC2016 # the replacement is applied by sed, not the shell
sed -i "s|^\([[:space:]]*\)hash = \"sha256-[^\"]*\";\$|\1hash = \"$unpacked_hash\";|" "$flake_file"

echo "update-flake-hash: $system -> $unpacked_hash (archive hash was $archive_hash)" >&2

# The fixed-output derivation fails when the installed hash does not reproduce
# the unpacked directory, so this build is the equivalence check itself.
nix build --no-link "$installable" || die "the installed hash does not validate $installable"

echo "update-flake-hash: verified $installable against the installed hash" >&2
