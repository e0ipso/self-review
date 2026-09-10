#!/usr/bin/env bash
# wave-status.sh — per-wave progress, read from ticket front matter.
#
# The wave is a ticket key, not a table: every open ticket carries `wave: <n>`,
# an archived ticket keeps whichever wave it was drafted with, and the bucket a
# file lives in is what says whether it is done. Nothing is generated to disk —
# this report IS the roadmap.
#
# Prints a done/remaining table for every wave, then the current wave (the
# earliest one with remaining work) and its remaining tickets in `priority`
# order with effort and status, so a run can be resumed without re-reading the
# tree by eye.
#
# Tickets carrying no wave key are counted and reported as unkeyed. Archived
# work resolved before the key existed has no wave to be assigned to, and
# guessing one would put finished work into a wave it never belonged to.
#
# Usage:
#   scripts/wave-status.sh
#   scripts/wave-status.sh --   # -- ends the options, as elsewhere on the skill
#
# `--` means one thing across the skill: the option list ends here and everything
# behind it is positional. This script has no positional to take, so the marker
# is accepted and anything following it is a usage error.
#
# Exit codes: 0 work remains | 1 no runnable wave is left | 2 setup/usage error.

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() {
  echo "usage: wave-status.sh" >&2
  echo "note: -- ends the options; this script takes no argument behind it" >&2
  exit 2
}

# The script reports the whole backlog and takes no options, so every argument
# is a mistake worth refusing: mid-drain, a silently ignored flag reads as "this
# is the whole picture" when the caller believes it asked for something narrower.
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

# Behind the marker every argument is positional, and there is none to take, so
# `wave-status.sh -- --wave 1` is refused rather than answered with the whole
# backlog — which is exactly the plausible wrong answer the refusal above exists
# to prevent.
[ $# -eq 0 ] || usage

ROWS="$(ticket_rows)"
[ -n "$ROWS" ] || {
  echo "error: no ticket files under $SIFT/open or $SIFT/archive" >&2
  echo "hint: a tree with no tickets has nothing to report, not an empty wave" >&2
  exit 2
}

printf '%-6s %7s %6s %10s\n' 'wave' 'total' 'done' 'remaining'
printf '%-6s %7s %6s %10s\n' '------' '-------' '------' '----------'
printf '%s\n' "$ROWS" | awk -F'\t' '
  $1 == 0 { next }                    # the unkeyed are reported under the table
  { total[$1]++; if ($4 == 1) done[$1]++; if (!($1 in seen)) { seen[$1] = 1; order[++n] = $1 } }
  END {
    for (i = 1; i <= n; i++) {
      w = order[i]
      d = (w in done) ? done[w] : 0
      printf "%-6s %7d %6d %10d\n", w, total[w], d, total[w] - d
    }
  }
'

UNKEYED_DONE="$(printf '%s\n' "$ROWS" | awk -F'\t' '$1 == 0 && $4 == 1' | wc -l | tr -d ' ')"
UNKEYED_OPEN="$(printf '%s\n' "$ROWS" | awk -F'\t' '$1 == 0 && $4 == 0' | wc -l | tr -d ' ')"
if [ $((UNKEYED_DONE + UNKEYED_OPEN)) -gt 0 ]; then
  echo
  echo "unkeyed: $((UNKEYED_DONE + UNKEYED_OPEN)) ticket(s) carry no wave key" \
       "($UNKEYED_DONE archived, $UNKEYED_OPEN open), counted in no wave"
  # An open ticket with no wave is not dispatchable, so the report says what to
  # edit rather than leaving the operator to compare two counts.
  [ "$UNKEYED_OPEN" -gt 0 ] &&
    echo "hint: add a wave: key to each unkeyed open ticket to make it dispatchable"
fi

TOTAL="$(printf '%s\n' "$ROWS" | wc -l | tr -d ' ')"
DONE="$(printf '%s\n' "$ROWS" | awk -F'\t' '$4 == 1' | wc -l | tr -d ' ')"
echo
echo "overall: $DONE/$TOTAL done, $((TOTAL - DONE)) remaining"

CURRENT="$(printf '%s\n' "$ROWS" | awk -F'\t' '$1 > 0 && $4 == 0 { print $1; exit }')"
if [ -z "$CURRENT" ]; then
  if [ "$UNKEYED_OPEN" -gt 0 ]; then
    echo "current wave: none — every open ticket is unkeyed"
  else
    echo "current wave: none — every ticket is archived"
  fi
  exit 1
fi

echo "current wave: $CURRENT"
echo "remaining in wave $CURRENT:"
printf '%s\n' "$ROWS" |
  CURRENT_WAVE="$CURRENT" awk -F'\t' '
    BEGIN { want = ENVIRON["CURRENT_WAVE"] + 0 }
    $1 == want && $4 == 0 { printf "  %s  [%s/%s/%s] %s\n", $3, $2, $6, $5, $8 }
  '
exit 0
