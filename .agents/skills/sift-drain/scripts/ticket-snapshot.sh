#!/usr/bin/env bash
# Read-only content/path snapshot for shell-side comparison between dispatches.
# Usage: ticket-snapshot.sh [--] [changes BEFORE AFTER]
# Redirect stdout to a session-local temporary file. Exit 2 on usage/setup errors;
# any other nonzero status is a failed scan, never a usable partial snapshot.
set -uo pipefail
if [ "${1:-}" = -- ]; then shift; fi
if [ "$#" -eq 3 ] && [ "$1" = changes ]; then
  before_file="$2"; after_file="$3"
  case "$before_file" in /*) ;; *) before_file="./$before_file" ;; esac
  case "$after_file" in /*) ;; *) after_file="./$after_file" ;; esac
  if [ ! -r "$before_file" ] || [ -d "$before_file" ] ||
    [ ! -r "$after_file" ] || [ -d "$after_file" ]; then
    echo 'snapshot input is not readable' >&2
    exit 2
  fi
  # Compare by immutable ID, keeping path changes separate from content changes.
  # The snapshots are disposable cksum output, never authoritative ticket state.
  LC_ALL=C awk '
    {
      if (!match($0, /^[0-9]+[[:space:]]+[0-9]+[[:space:]]+/)) { bad = 1; next }
      fingerprint = substr($0, 1, RLENGTH)
      path = substr($0, RLENGTH + 1)
      if (substr(path, 1, 1) != "/") { bad = 1; next }
      id = path; sub(/^.*\//, "", id); sub(/--.*$/, "", id)
      if (phase == "before") {
        if (id in oldpath) bad = 1
        oldpath[id] = path; oldsum[id] = fingerprint
      } else {
        if (id in newpath) bad = 1
        newpath[id] = path; newsum[id] = fingerprint
      }
    }
    END {
      if (bad) exit 2
      for (id in oldpath)
        if (!(id in newpath)) printf "deleted\t%s\t%s\t-\n", id, oldpath[id]
      for (id in newpath) {
        kind = ""
        if (!(id in oldpath)) kind = "added"
        else if (oldpath[id] != newpath[id]) {
          kind = (oldsum[id] == newsum[id]) ? "moved" : "moved+changed"
        } else if (oldsum[id] != newsum[id]) kind = "changed"
        if (kind != "") printf "%s\t%s\t%s\t%s\n", kind, id,
          (id in oldpath) ? oldpath[id] : "-", newpath[id]
      }
    }
  ' phase=before "$before_file" phase=after "$after_file" | LC_ALL=C sort -k2,2
  result=$?
  [ "$result" -eq 0 ] || echo 'snapshot comparison failed; discard output and rescan (check duplicate IDs or malformed records)' >&2
  exit "$result"
fi
if [ "$#" -ne 0 ]; then
  echo 'usage: ticket-snapshot.sh [--] [changes BEFORE AFTER]' >&2
  exit 2
fi

# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

# Both buckets matter: archiving, reopening and changes to a dependency's
# resolution must invalidate the corresponding cached graph facts too.
# Batched cksum calls let find propagate read failures without a pipeline loop.
find "$SIFT/open" "$SIFT/archive" -name "$PREFIX-*.md" \
  -exec cksum {} + | LC_ALL=C sort
