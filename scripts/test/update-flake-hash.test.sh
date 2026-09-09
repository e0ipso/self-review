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
    src = fetchzip {
      url = "$ARTIFACT_URL";
      hash = "$STALE_HASH";
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
    # succeeds when flake.nix carries the hash the artifact reproduces.
    installed=\$(sed -n 's/.*hash = "\(sha256-[^"]*\)";.*/\1/p' '$dir/flake.nix')
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
  sed -n 's/.*hash = "\(sha256-[^"]*\)";.*/\1/p' "$1/flake.nix"
}

run_subject() {
  local dir=$1
  shift
  PATH="$dir/bin:$PATH" "$subject" x86_64-linux "$dir" >"$dir/stdout" 2>"$dir/stderr"
}

# 1. The installed hash is the unpacked one, and the source still validates.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
run_subject "$dir"
check "installs the unpacked hash: exit code" 0 "$?"
check "installs the unpacked hash: flake.nix value" "$UNPACKED_HASH" "$(installed_hash "$dir")"
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
check "refuses a raw archive hash: flake.nix untouched" "$STALE_HASH" "$(installed_hash "$dir")"
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

# 6. Extension guard for SR-0027: an ambiguous set of hashes is refused rather
#    than silently rewriting the wrong architecture's entry.
dir=$(make_sandbox "$UNPACKED_HASH" "$ARCHIVE_HASH" "$UNPACKED_HASH")
sed -i "s|hash = \"$STALE_HASH\";|hash = \"$STALE_HASH\";\n      hash = \"$STALE_HASH\";|" "$dir/flake.nix"
run_subject "$dir"
check "refuses an ambiguous hash site: exit code" 1 "$?"
rm -rf "$dir"

echo "passed: $passes, failed: $failures"
[ "$failures" -eq 0 ]
