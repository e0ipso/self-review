#!/usr/bin/env bash
# Shared helpers for the sift-prime scripts. Sourced, never executed directly.
#
# A deliberately slimmer sibling of sift-drain's lib.sh: priming only ever needs
# to locate the tree, know the prefix, and read one front-matter value at a time.
# Ticket row parsing, label listing and lookup by ID stay in sift-drain.
#
# Provides:
#   ROOT / SIFT / PREFIX            — resolved absolute paths and the ticket prefix
#   fm_value <file> <key>           — one front-matter value
#
# Overrides:
#   SIFT_ROOT    project root (default: nearest ancestor of $PWD with .ai/sift/)
#   SIFT_PREFIX  ticket prefix (default: .ai/sift/config/config.yaml, then inferred)

# --- Project root -----------------------------------------------------------
# Walk upward from $PWD for a directory holding `.ai/sift/`. Nested `.git`
# folders are deliberately ignored, so running from a subproject of a monorepo
# still resolves to the nearest parent sift tree. The `.ai/sift/` DIRECTORY is
# the marker, and it is the only one: every other tracker fact lives in a ticket
# file, so there is no second file whose absence means "not initialized".
_sift_find_root() {
  local dir parent
  dir="$PWD"
  while true; do
    [ -d "$dir/.ai/sift" ] && { printf '%s\n' "$dir"; return 0; }
    parent="$(dirname "$dir")"
    [ "$parent" = "$dir" ] && return 1   # reached the filesystem root
    dir="$parent"
  done
}

if [ -n "${SIFT_ROOT:-}" ]; then
  ROOT="$(cd "$SIFT_ROOT" 2>/dev/null && pwd)" || {
    echo "error: SIFT_ROOT is not a readable directory: $SIFT_ROOT" >&2
    exit 2
  }
  if [ ! -d "$ROOT/.ai/sift" ]; then
    echo "error: no .ai/sift/ directory under SIFT_ROOT=$ROOT" >&2
    echo "hint: run sift-init before priming, or point SIFT_ROOT at an initialized tree" >&2
    exit 2
  fi
else
  ROOT="$(_sift_find_root)" || {
    echo "error: no .ai/sift/ directory found at or above $PWD" >&2
    echo "hint: run from inside the project, or set SIFT_ROOT=/path/to/project" >&2
    exit 2
  }
fi

SIFT="$ROOT/.ai/sift"

# --- Ticket prefix ----------------------------------------------------------
PREFIX="${SIFT_PREFIX:-}"
if [ -z "$PREFIX" ] && [ -f "$SIFT/config/config.yaml" ]; then
  PREFIX="$(sed -n 's/^prefix:[[:space:]]*["'\'']\{0,1\}\([A-Za-z0-9_]\{1,\}\).*/\1/p' \
    "$SIFT/config/config.yaml" | head -n 1)"
fi
if [ -z "$PREFIX" ]; then
  # Fall back to the most common prefix among existing ticket filenames.
  PREFIX="$(find "$SIFT/open" "$SIFT/archive" -name '*--*.md' 2>/dev/null |
    sed 's#.*/##' |
    sed -n 's/^\([A-Z][A-Z0-9]*\)-[0-9][0-9][0-9][0-9].*/\1/p' |
    sort | uniq -c | sort -rn | head -n 1 | awk '{ print $2 }')"
fi
if [ -z "$PREFIX" ]; then
  echo "error: cannot determine the ticket prefix" >&2
  echo "hint: set 'prefix:' in $SIFT/config/config.yaml, or export SIFT_PREFIX" >&2
  exit 2
fi

# --- Front-matter -----------------------------------------------------------
# One front-matter value, unquoted, or empty when the key is absent.
fm_value() {
  awk -v key="$2" '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && $0 ~ "^" key ":" {
      sub("^" key ":[[:space:]]*", "")
      gsub(/^["'"'"']|["'"'"']$/, "")
      print
      exit
    }
  ' "$1"
}
