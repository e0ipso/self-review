#!/usr/bin/env bash
#
# Regression checks for scripts/update-flake-hash.sh.
#
# Runs without the nix binary: a stub `nix` on PATH stands in for the real one
# and reports a different hash for the unpacked directory than for the archive
# bytes, which is what makes the archive-hash regression observable.
#
# Usage: scripts/test/update-flake-hash.test.sh

set -uo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
subject="$repo_root/scripts/update-flake-hash.sh"

UNPACKED_HASH='sha256-UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU='
ARCHIVE_HASH='sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
STALE_HASH='sha256-SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS='
# A second stale value, so a run for one architecture visibly leaves the other
# architecture's entry alone instead of matching by luck.
STALE_ARM_HASH='sha256-RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR='
ARTIFACT_URL='https://example.invalid/releases/download/v9.9.9/Self.Review-linux-x64-9.9.9.zip'

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

# Builds a sandbox holding a fixture flake.nix and a stub `nix` on PATH.
# $1 unpacked hash, $2 archive hash, $3 hash the stubbed build accepts.
make_sandbox() {
  local unpacked=$1 archive=$2 buildable=$3
  local dir
  dir=$(mktemp -d)

  cat > "$dir/flake.nix" <<FLAKE
{
  outputs = _: {
    srcHashes = {
      "x86_64-linux" = "$STALE_HASH";
      "aarch64-linux" = "$STALE_ARM_HASH";
    };
    src = fetchzip {
      url = "$ARTIFACT_URL";
      hash = srcHashes.\${system};
      stripRoot = true;
    };
  };
}
FLAKE

  mkdir -p "$dir/bin"
  cat > "$dir/bin/nix" <<STUB
#!/usr/bin/env bash
set -uo pipefail
case "\$1 \${2:-}" in
  'derivation show')
    printf '{"/nix/store/stub.drv":{"env":{"urls":"%s"}}}\n' '$ARTIFACT_URL'
    ;;
  'store prefetch-file')
    for arg in "\$@"; do
      case "\$arg" in
        http*) echo "\$arg" >> '$dir/prefetched-urls' ;;
      esac
    done
    if printf '%s\n' "\$@" | grep -qx -- --unpack; then
      echo "unpacked" >> '$dir/prefetch-modes'
      printf '{"hash":"%s"}\n' '$unpacked'
    else
      echo "archive" >> '$dir/prefetch-modes'
      printf '{"hash":"%s"}\n' '$archive'
    fi
    ;;
  'build '*)
    # Stands in for the fixed-output integrity check: the build only
    # succeeds when flake.nix carries the hash the artifact reproduces for
    # the architecture the installable names.
    target=\$(printf '%s' "\$3" | sed 's/.*#packages\.\([^.]*\)\..*/\1/')
    installed=\$(sed -n "s/.*\"\$target\" = \"\(sha256-[^\"]*\)\";.*/\1/p" '$dir/flake.nix')
    if [ "\$installed" = '$buildable' ]; then
      exit 0
    fi
    echo "hash mismatch in fixed-output derivation" >&2
    exit 1
    ;;
  *)
    echo "stub nix: unexpected invocation: \$*" >&2
    exit 127
    ;;
esac
STUB
  chmod +x "$dir/bin/nix"
  echo "$dir"
}

installed_hash() {
  local dir=$1 system=$2
  sed -n "s/.*\"$system\" = \"\(sha256-[^\"]*\)\";.*/\1/p" "$dir/flake.nix"
}

run_subject() {
  local dir=$1 system=${2:-x86_64-linux}
  PATH="$dir/bin:$PATH" "$subject" "$system" "$dir" >"$dir/stdout" 2>"$dir/stderr"
}

# 1. The installed hash is the unpacked one, and the source still validates.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
run_subject "$dir"
check "installs the unpacked hash: exit code" 0 "$?"
check "installs the unpacked hash: flake.nix value" "$UNPACKED_HASH" \
  "$(installed_hash "$dir" x86_64-linux)"
check "installs the unpacked hash: leaves the other architecture alone" "$STALE_ARM_HASH" \
  "$(installed_hash "$dir" aarch64-linux)"
if grep -q 'verified' "$dir/stderr"; then
  pass "installs the unpacked hash: reports fetchzip verification"
else
  fail "installs the unpacked hash: reports fetchzip verification"
fi
rm -rf "$dir"

# 2. Both hash inputs are exercised, so archive bytes and unpacked output
#    are told apart rather than assumed equal.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
run_subject "$dir"
check "distinguishes the two hash inputs" "archive
unpacked" "$(sort "$dir/prefetch-modes")"
rm -rf "$dir"

# 3. The pre-fix behaviour: hashing the archive bytes and installing that value.
#    A prefetch whose unpack changes nothing is refused instead of installed.
dir=$(make_sandbox "$ARCHIVE_HASH" "$ARCHIVE_HASH" "$ARCHIVE_HASH")
run_subject "$dir"
check "refuses a raw archive hash: exit code" 1 "$?"
check "refuses a raw archive hash: flake.nix untouched" "$STALE_HASH" \
  "$(installed_hash "$dir" x86_64-linux)"
if grep -q 'raw archive hash' "$dir/stderr"; then
  pass "refuses a raw archive hash: explains why"
else
  fail "refuses a raw archive hash: explains why"
fi
rm -rf "$dir"

# 4. A hash that does not reproduce the unpacked directory fails the build.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$STALE_HASH")
run_subject "$dir"
check "fails when fetchzip rejects the hash: exit code" 1 "$?"
if grep -q 'does not validate' "$dir/stderr"; then
  pass "fails when fetchzip rejects the hash: explains why"
else
  fail "fails when fetchzip rejects the hash: explains why"
fi
rm -rf "$dir"

# 5. The artifact hashed is the one the flake declares, not one rebuilt here.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
run_subject "$dir"
check "hashes the URL the flake declares" "$ARTIFACT_URL
$ARTIFACT_URL" "$(cat "$dir/prefetched-urls")"
rm -rf "$dir"

# 6. An architecture whose entry appears twice is refused rather than rewritten
#    at one of two ambiguous sites.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
sed -i "s|\"x86_64-linux\" = \"$STALE_HASH\";|&\n      \"x86_64-linux\" = \"$STALE_HASH\";|" \
  "$dir/flake.nix"
run_subject "$dir"
check "refuses an ambiguous hash site: exit code" 1 "$?"
rm -rf "$dir"

# 7. The arm64 run writes the arm64 entry and only that one, which is what makes
#    the per-architecture hashes independent.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
run_subject "$dir" aarch64-linux
check "updates the named architecture: exit code" 0 "$?"
check "updates the named architecture: arm64 value" "$UNPACKED_HASH" \
  "$(installed_hash "$dir" aarch64-linux)"
check "updates the named architecture: x64 value untouched" "$STALE_HASH" \
  "$(installed_hash "$dir" x86_64-linux)"
rm -rf "$dir"

# 8. A system the flake does not declare is refused, so a typo cannot pass for a
#    successful update.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
run_subject "$dir" riscv64-linux
check "refuses a system with no entry: exit code" 1 "$?"
check "refuses a system with no entry: x64 value untouched" "$STALE_HASH" \
  "$(installed_hash "$dir" x86_64-linux)"
rm -rf "$dir"

echo "passed: $passes, failed: $failures"
[ "$failures" -eq 0 ]
