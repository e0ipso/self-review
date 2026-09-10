#!/usr/bin/env bash
# list-labels.sh — print every label in use across the ticket tree.
#
# Labels are the free-form kebab tags in front-matter (`labels: [api, caching]`).
#
# Usage:
#   scripts/list-labels.sh              # one label per line, sorted
#   scripts/list-labels.sh --counts     # label<TAB>ticket-count, sorted by label
#   scripts/list-labels.sh --open       # open/ bucket only
#   scripts/list-labels.sh --counts --  # -- ends the options, as in tickets-by-label.sh
#
# `--` means one thing across the skill: the option list ends here and everything
# behind it is positional. This script has no positional to take, so the marker
# is accepted and anything following it is a usage error.
#
# A label that is not kebab-case is still listed — it is in the tree, and a
# listing that hid it would send an operator hunting for a label the discovery
# tool denied existed — but it earns a warning on stderr naming the ticket that
# carries it, because `tickets-by-label.sh` refuses such a label as a lookup
# argument. stdout stays the machine-readable list in both modes.
#
# Exit codes: 0 success | 2 setup error.

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() {
  echo "usage: list-labels.sh [--counts] [--open]" >&2
  echo "note: -- ends the options; this script takes no argument behind it" >&2
  exit 2
}

COUNTS=0
OPEN_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --counts) COUNTS=1 ;;
    --open) OPEN_ONLY=1 ;;
    --)
      shift
      break
      ;;
    *) usage ;;
  esac
  shift
done

# Behind the marker every argument is positional, and there is no positional to
# be: `list-labels.sh -- --counts` asked for a label listing of a thing named
# `--counts`, not for the count mode, and answering with counts would be the
# plausible wrong answer.
[ $# -eq 0 ] || usage

SEARCH_FLAG=""
[ "$OPEN_ONLY" = "1" ] && SEARCH_FLAG="--open"

while read -r dir; do
  find "$dir" -name "$PREFIX-*.md" 2>/dev/null
done < <(ticket_search_dirs $SEARCH_FLAG) | sort | while read -r f; do
  # De-duplicate within the ticket, so `labels: [api, api]` is one ticket
  # carrying api rather than two mentions of it, and flag anything the lookup
  # would refuse while the file it came from is still in hand.
  #
  # The refusal rule is lib.sh's SIFT_LABEL_RE, the same string tickets-by-label.sh
  # tests its argument against, so the warning cannot come to disagree with the
  # lookup it names. Both it and the ticket path arrive through the environment
  # and ENVIRON rather than -v, because -v re-scans its argument for ANSI escapes:
  # a path holding the two characters "\" and "t" would be named with a real tab
  # in it, so the warning would point at a file that does not exist and send an
  # operator to the wrong one. Both are read once in BEGIN, so the sweep still
  # spends one awk per ticket and none per label.
  fm_labels "$f" | SIFT_LABEL_RE="$SIFT_LABEL_RE" SIFT_LABEL_TICKET="${f#"$ROOT/"}" awk '
    BEGIN { kebab = ENVIRON["SIFT_LABEL_RE"]; t = ENVIRON["SIFT_LABEL_TICKET"] }
    !seen[$0]++ {
      print
      if ($0 !~ kebab) {
        printf "warning: %s: not kebab-case, tickets-by-label.sh will refuse it: %s\n",
          t, $0 > "/dev/stderr"
      }
    }
  '
done | {
  if [ "$COUNTS" = "1" ]; then
    # Strip the count off the FRONT of the `uniq -c` line and keep the rest as
    # the label. Reading the label back as a field would truncate it at its
    # first blank; the count is a leading run of padding, digits and one blank,
    # and the padding width changes as soon as a count reaches ten. The input
    # to `uniq -c` is already sorted and `uniq` preserves that order, so no
    # re-sort is needed — and `sort -k1,1` would key on the same truncation.
    sort | uniq -c |
      awk '{ n = $1; sub(/^[[:space:]]*[0-9]+[[:space:]]+/, ""); printf "%s\t%s\n", $0, n }'
  else
    sort -u
  fi
}
