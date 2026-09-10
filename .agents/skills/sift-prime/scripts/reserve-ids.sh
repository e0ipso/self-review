#!/usr/bin/env bash
# Persistently reserve a contiguous batch before any ticket is written.
# Independent skills carry identical copies; tests/scripts/prime-backlog.test.sh
# compares both with the README recipe and drives mixed callers against one tree.
# Exit: 0 reserved | 1 usage | 2 setup/state | 3 allocation lock busy/unavailable.
set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
if [ "$#" -ne 1 ] || [ -z "${1:-}" ]; then
  echo "error: reserve-ids.sh needs a count" >&2
  echo "hint: usage: reserve-ids.sh <count>" >&2
  exit 1
fi
COUNT=$1
# BEGIN reservation recipe
(
  set -eu
  SIFT=${SIFT:-.ai/sift}
  COUNT=${COUNT:-1}
  [ -d "$SIFT/open" ] && [ -d "$SIFT/archive" ] || {
    echo "missing .ai/sift buckets — run sift-init first" >&2; exit 2;
  }
  printf '%s\n' "${PREFIX:-}" | LC_ALL=C grep -Eq '^[A-Z][A-Z0-9]*$' || {
    echo "invalid ticket prefix" >&2; exit 2;
  }
  case "$COUNT" in
    ''|*[!0-9]*) echo "count must be a positive whole number, got: $COUNT" >&2; exit 1 ;;
  esac
  COUNT=$(printf '%s\n' "$COUNT" | sed 's/^0*//')
  [ -n "$COUNT" ] || { echo "count must be at least 1, got: 0" >&2; exit 1; }
  [ "${#COUNT}" -le 9 ] || { echo "count is too large" >&2; exit 1; }
  mkdir -p "$SIFT/.id-sequence"
  LOCK="$SIFT/.id-sequence/.lock"
  if ! mkdir "$LOCK" 2>/dev/null; then
    echo "ID allocator busy or lock unavailable: $LOCK; retry after the owner finishes" >&2
    exit 3
  fi
  trap 'rm -f "$LOCK/files" "$LOCK/names" "$LOCK/ids" "$LOCK/numbers" "$LOCK/sorted" "$LOCK/top" "$LOCK/high"; rmdir "$LOCK"' EXIT
  trap 'exit 1' HUP INT TERM
  # Find the buckets explicitly so a symlinked .ai/sift shares the same state.
  find "$SIFT/open" "$SIFT/archive" -type f -name "$PREFIX-*.md" > "$LOCK/files"
  sed 's#.*/##' "$LOCK/files" > "$LOCK/names"
  LC_ALL=C grep -oE "^$PREFIX-[0-9]{4,}--" "$LOCK/names" > "$LOCK/ids" || [ "$?" -eq 1 ]
  sed "s/^$PREFIX-//; s/--$//" "$LOCK/ids" > "$LOCK/numbers"
  STATE="$SIFT/.id-sequence/$PREFIX"
  if [ -e "$STATE" ]; then
    SAVED=$(cat "$STATE")
    case "$SAVED" in
      ''|*[!0-9]*) echo "invalid ID reservation state: $STATE; restore it before allocating" >&2; exit 2 ;;
    esac
    printf '%s\n' "$SAVED" >> "$LOCK/numbers"
  fi
  # Refuse unsupported numbers rather than wrapping and issuing an old ID.
  awk 'length($0) > 15 { bad = 1 } END { exit bad }' "$LOCK/numbers" || {
    echo "ID exceeds supported numeric range" >&2; exit 2;
  }
  sort -n "$LOCK/numbers" > "$LOCK/sorted"
  tail -n 1 "$LOCK/sorted" > "$LOCK/top"
  HIGH=$(sed 's/^0*//' "$LOCK/top")
  HIGH=${HIGH:-0}
  LAST=$((HIGH + COUNT))
  [ "${#LAST}" -le 15 ] || { echo "ID exceeds supported numeric range" >&2; exit 2; }
  printf '%s\n' "$LAST" > "$LOCK/high"
  mv "$LOCK/high" "$STATE"
  # Publish the mark before printing. An interrupted caller loses IDs, never reuses them.
  N=$HIGH
  while [ "$N" -lt "$LAST" ]; do
    N=$((N + 1))
    printf '%s-%04d\n' "$PREFIX" "$N"
  done
)
# END reservation recipe
