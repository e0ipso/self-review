#!/usr/bin/env bash
# ticket-check.sh — cross-check the ticket files against each other.
#
# Ticket front matter is the only state source. There is no second store to
# reconcile against, so what this reports is a tree disagreeing with itself.
#
# Checks:
#   - every open ticket carries a positive integer `wave`
#   - every `depends_on` ID resolves to a ticket file, open or archived
#   - front-matter `status` agrees with the bucket the file lives in
#   - an archived ticket carries a non-empty `resolution`
#   - no ticket ID is carried by more than one file
#
# Archived tickets are not required to carry a wave: work resolved before the
# key existed has no wave left to be dispatched into, and requiring one would
# make every tree with a past permanently red.
#
# Output is diff-style: "-" a reference to something missing, "!" a state
# mismatch. Every finding names the ticket and its path, and the `fix:` line
# beneath it names the edit — the operator reading this mid-drain does not have
# the convention open.
#
# Usage:
#   scripts/ticket-check.sh
#   scripts/ticket-check.sh --   # -- ends options
#
# Exit codes: 0 consistent | 1 violations found | 2 setup/usage error.

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() {
  echo "usage: ticket-check.sh" >&2
  echo "note: -- ends the options; this script takes no argument behind it" >&2
  exit 2
}

# The verdict always covers the whole tree; refuse positional scope arguments.
while [ $# -gt 0 ]; do
  case "$1" in
    --)
      shift
      break
      ;;
    *) usage ;;
  esac
  shift
done

[ $# -eq 0 ] || usage

TAB="$(printf '\t')"
VIOLATIONS=0

# report <finding> <remedy> — one finding and the edit that settles it.
report() {
  echo "$1"
  echo "  fix: $2"
  VIOLATIONS=$((VIOLATIONS + 1))
}

# Sorted by ID rather than in dispatch order: every line below leads with the
# ID, and a repair pass reads down that column.
ROWS="$(ticket_rows | LC_ALL=C sort -t"$TAB" -k3,3)"
if [ -z "$ROWS" ]; then
  echo "OK: 0 ticket file(s) are consistent"
  exit 0
fi

IDS="$(printf '%s\n' "$ROWS" | cut -f3)"

# Every ID once more as one tab-delimited string, with a delimiter at both ends
# so a `case` pattern can ask for a whole entry. Membership is asked once per
# dependency edge, and asking it through a pipe would be both a process per edge
# and a correctness hazard: `grep -q` exits at the first match, and under
# `pipefail` the SIGPIPE it hands the writer of a long list becomes the
# pipeline's status — a match reported as a miss.
IDSET="$TAB$(printf '%s\n' "$IDS" | tr '\n' "$TAB")"

# --- Duplicate ticket IDs ----------------------------------------------------
# Reported first, because every lookup below answers with whichever file the
# sort reached first and would otherwise never say there was a choice.
while read -r count id; do
  [ -z "$id" ] && continue
  report "! DUPLICATE TICKET ID: $id is carried by $count files" \
    "archive one of them with a new ID; an ID is never reused"
done < <(printf '%s\n' "$IDS" | LC_ALL=C sort | uniq -c | awk '$1 > 1 { print $1, $2 }')

# --- Per ticket --------------------------------------------------------------
while IFS="$TAB" read -r wave _priority id is_done status _effort deps _title file; do
  [ -z "$id" ] && continue
  rel="${file#"$ROOT/"}"

  # The wave, for open work only. `ticket_rows` reports an absent key and an
  # unusable value alike as 0, so the raw line is re-read to tell the two
  # repairs apart: one adds a key, the other corrects a value.
  if [ "$is_done" = "0" ] && [ "$wave" = "0" ]; then
    raw="$(fm_value "$file" wave)"
    if [ -z "$raw" ]; then
      report "! NO WAVE: $id -> $rel" \
        "add 'wave: <n>' to its front matter, or archive the ticket"
    else
      report "! BAD WAVE: $id carries 'wave: $raw' -> $rel" \
        "set 'wave:' to a positive integer"
    fi
  fi

  # Dependency edges, from every ticket: an archived ticket citing an ID nobody
  # wrote is the same broken reference, and the wave that inherits the citation
  # is the one that trips over it.
  if [ "$deps" != "-" ]; then
    while IFS= read -r dep; do
      [ -z "$dep" ] && continue
      case "$IDSET" in *"$TAB$dep$TAB"*) continue ;; esac
      report "- UNRESOLVED DEPENDENCY: $id depends_on $dep, which has no ticket file -> $rel" \
        "correct the ID in 'depends_on', or remove it"
    done < <(printf '%s\n' "$deps" | awk '
      # This is a single-quoted shell string; keep awk comments free of
      # apostrophes. The bracket expression strips the flow-list punctuation and
      # both quote characters, leaving one bare ID per field.
      {
        gsub(/[][,"'"'"']/, " ")
        for (i = 1; i <= NF; i++) print $i
      }
    ')
  fi

  # The bucket and the status are two spellings of one fact.
  case "$is_done:$status" in
    0:open|0:in-progress|0:blocked) ;;
    1:done|1:wontfix|1:superseded)
      if [ -z "$(fm_value "$file" resolution)" ]; then
        report "! NO RESOLUTION: $id -> $rel" \
          "write one line into 'resolution:' saying how the ticket ended"
      fi
      ;;
    *)
      case "$is_done" in 1) bucket=archive ;; *) bucket=open ;; esac
      report "! BUCKET/STATUS MISMATCH: $id is in $bucket/ with status '$status' -> $rel" \
        "move the file to the bucket its status names, or correct 'status:'"
      ;;
  esac
done <<< "$ROWS"

TOTAL="$(printf '%s\n' "$ROWS" | awk 'NF' | wc -l | tr -d ' ')"

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "OK: $TOTAL ticket file(s) are consistent"
  exit 0
fi
echo
echo "FAIL: $VIOLATIONS violation(s) across $TOTAL ticket file(s)"
exit 1
