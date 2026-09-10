#!/usr/bin/env bash
# sync-assets.sh — copy the normative root README and schemas into sift-init
# assets, then verify the copies are byte-for-byte current (including schema
# additions and removals).
#
# Paths resolve from this script's location, so the command works from any cwd
# as long as the skill still lives under src/skills/sift-init/.
#
# Usage (from anywhere):
#   src/skills/sift-init/scripts/sync-assets.sh
#   /absolute/path/to/src/skills/sift-init/scripts/sync-assets.sh
#
# Exit codes: 0 synced and verified | 1 drift or incomplete sync | 2 usage/env

set -eu

here=$(cd "$(dirname "$0")" && pwd -P)
skill=$(cd "$here/.." && pwd -P)
assets="$skill/assets"
# skill is src/skills/sift-init → repository root is three levels up
root=$(cd "$skill/../../.." && pwd -P)

die() { echo "sync-assets: $*" >&2; exit 2; }
fail() { echo "sync-assets: $*" >&2; errors=$((errors + 1)); }

[ -f "$root/README.md" ] || die "normative README not found at $root/README.md"
[ -d "$root/schemas" ] || die "normative schemas/ not found at $root/schemas"
[ -d "$assets" ] || die "skill assets directory not found at $assets"
[ -d "$skill" ] || die "skill directory not found at $skill"

# Confirm we landed on the right root (guards against a relocated skill path).
[ -d "$root/src/skills/sift-init" ] || die "resolved root $root lacks src/skills/sift-init"

[ -f "$root/src/operations/sift.sh" ] || die "normative operations script not found"
mkdir -p "$assets/schemas" "$assets/scripts"
cp "$root/src/operations/sift.sh" "$assets/scripts/sift.sh"

# --- Copy README ------------------------------------------------------------
cp "$root/README.md" "$assets/README.md"

# --- Copy every normative schema --------------------------------------------
# A bare glob that matches nothing stays literal; the -f guard skips that case.
for src in "$root/schemas"/*.xsd "$root/schemas"/*.xml; do
  [ -f "$src" ] || continue
  cp "$src" "$assets/schemas/$(basename "$src")"
done

# --- Drop asset schemas that no longer exist at the root --------------------
for dst in "$assets/schemas"/*.xsd "$assets/schemas"/*.xml; do
  [ -f "$dst" ] || continue
  base=$(basename "$dst")
  if [ ! -f "$root/schemas/$base" ]; then
    rm -f "$dst"
  fi
done

# --- Verify byte-for-byte match (content + membership) ----------------------
errors=0
if ! cmp -s "$root/src/operations/sift.sh" "$assets/scripts/sift.sh"; then
  fail "scripts/sift.sh missing or differs after copy"
fi

if [ ! -f "$assets/README.md" ]; then
  fail "missing asset README.md after copy"
elif ! cmp -s "$root/README.md" "$assets/README.md"; then
  fail "README.md still drifts after copy"
fi

for src in "$root/schemas"/*.xsd "$root/schemas"/*.xml; do
  [ -f "$src" ] || continue
  base=$(basename "$src")
  dst="$assets/schemas/$base"
  if [ ! -f "$dst" ]; then
    fail "missing asset schema after copy: $base"
  elif ! cmp -s "$src" "$dst"; then
    fail "schemas/$base still drifts after copy"
  fi
done

for dst in "$assets/schemas"/*.xsd "$assets/schemas"/*.xml; do
  [ -f "$dst" ] || continue
  base=$(basename "$dst")
  if [ ! -f "$root/schemas/$base" ]; then
    fail "stale asset schema survived sync: $base"
  fi
done

if [ "$errors" -ne 0 ]; then
  echo "sync-assets: FAIL — $errors mismatch(es); assets are incomplete" >&2
  exit 1
fi

readme_bytes=$(wc -c < "$assets/README.md" | tr -d ' ')
schema_count=0
for f in "$assets/schemas"/*.xsd "$assets/schemas"/*.xml; do
  [ -f "$f" ] || continue
  schema_count=$((schema_count + 1))
done

echo "sync-assets: OK — README.md ($readme_bytes bytes), scripts/sift.sh and $schema_count XSD/XML file(s) match $root"
exit 0
