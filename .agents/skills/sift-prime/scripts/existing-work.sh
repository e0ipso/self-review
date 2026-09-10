#!/usr/bin/env bash
# existing-work.sh — does a candidate collide with prior work?
#
# Pass one or more search terms and get back the tickets that carry them. The
# output is bounded by construction, not by how narrow the terms happen to be:
# at most 25 rows, each with a `resolution` column of at most 200 characters. A
# project whose whole archive shares one subject can be queried with its own
# vocabulary and still answer in a few kilobytes.
#
# Usage:
#   scripts/existing-work.sh [--] <term>...
#
# Every ticket under .ai/sift/open and .ai/sift/archive is searched whole, front
# matter and body, for any term as a case-insensitive fixed string. Terms OR
# together, and a file matching any of them yields exactly one line. `--` ends
# the options, so a hyphen-leading term goes behind it. Zero terms is a usage
# error, and so is an empty term: `grep -F -e ""` matches every file, which
# would silently bring back the full dump this script no longer prints.
#
# One tab-separated line per match, sorted by ID, no header:
#
#   <ID><TAB><status><TAB><type><TAB><title><TAB><resolution>
#
# `resolution` is empty for open tickets and carries the closing line for
# archived ones. A tab, carriage return or newline inside a front-matter value is
# squashed to one space so every line stays a strict 5-field TSV: a stray tab in
# a title would otherwise shift it into the `resolution` column and make an open
# ticket read as already decided against. A `resolution` past 200 characters is
# cut there and marked with a trailing `...`; when one of those rows is about to
# decide a verdict, read that ticket file for the verbatim text. ID, status, type
# and title are never cut — the title is what the reader judges with.
#
# At most SIFT_MATCH_LIMIT rows are printed, default 25. When more tickets match
# than that, the survivors are the ones matching the most distinct terms, ties
# broken by ascending ID; rank decides survival only, and the printed rows stay
# ID-sorted. Overflow puts a notice on stderr naming how many matched, how many
# were shown, and the remedy, while stdout stays pure TSV and the exit stays 0: a
# capped answer is a successful answer with a stated limitation. An answer that
# overflowed is incomplete, so narrow the terms and ask again rather than
# concluding from the rows that fit.
#
# Overrides:
#   SIFT_MATCH_LIMIT  rows to print (default: 25; positive integer)
#
# Nothing is written. No match prints nothing and exits 0, and so does a tree
# with no tickets: an empty answer means no ticket carries these terms, not that
# no duplicate exists.
#
# Exit codes: 0 success (including no match, and including a capped answer)
#             2 setup or usage error.

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

TAB="$(printf '\t')"

# --- Row cap ----------------------------------------------------------------
# Read beside lib.sh's own overrides and reported the same way: one `error:`
# line, one `hint:` line, exit 2 before anything is printed on stdout. Zero is
# rejected with the malformed values because a cap of zero answers every query
# with silence, which reads exactly like "no collision".
LIMIT="${SIFT_MATCH_LIMIT:-25}"
case "$LIMIT" in
  '' | *[!0-9]*) LIMIT="" ;;
  *[!0]*) ;;
  *) LIMIT="" ;;
esac
if [ -z "$LIMIT" ]; then
  echo "error: SIFT_MATCH_LIMIT must be a positive integer: ${SIFT_MATCH_LIMIT:-}" >&2
  echo "hint: unset it for the default of 25 rows" >&2
  exit 2
fi

usage() {
  echo "usage: existing-work.sh [--] <term>..." >&2
  echo "note: -- ends the options; every argument behind it is a search term" >&2
  exit 2
}

TERMS=()

# One term rule, shared by both argument loops below.
take_term() {
  if [ -z "$1" ]; then
    echo "error: empty search term" >&2
    usage
  fi
  TERMS+=("$1")
}

while [ $# -gt 0 ]; do
  case "$1" in
    --)
      shift
      break
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      usage
      ;;
    *) take_term "$1" ;;
  esac
  shift
done

# Everything behind `--` is a term, hyphen-leading or not. Without this second
# loop the break above would drop the arguments the marker exists to protect.
while [ $# -gt 0 ]; do
  take_term "$1"
  shift
done

[ "${#TERMS[@]}" -gt 0 ] || usage

# The candidate list. `find` into a `while read` loop because .ai/sift is usually
# gitignored (ignore-aware search finds nothing there) and BSD xargs has no
# no-run-if-empty flag. The loop is fed by a redirect rather than a pipe so it
# runs in this shell and the array survives it.
FILES=()
while IFS= read -r f; do
  FILES+=("$f")
done < <(find "$SIFT/open" "$SIFT/archive" -name '*--*.md' 2>/dev/null)

# A cold tree answers nothing, and must not fall through to a `grep` with no file
# operands, which would read stdin instead.
[ "${#FILES[@]}" -gt 0 ] || exit 0

# Pass 1 — one `grep -l` per term over the whole list, not one grep per file per
# term. Each invocation names every file that carries that term at most once, so
# concatenating the lists and counting repeats gives each file the number of
# distinct terms it matched, which is the rank the cap selects on below.
HITS=""
for term in "${TERMS[@]}"; do
  # grep exits 1 for no match and 2 for a real error. Absorb only the 1 — for
  # `-l` over a list, "this term is in no ticket" is the ordinary case — because
  # a query that half read the tree must not go on to report no collision.
  rc=0
  term_hits="$(grep -l -i -F -e "$term" -- "${FILES[@]}")" || rc=$?
  if [ "$rc" -gt 1 ]; then
    echo "error: search failed with status $rc on term: $term" >&2
    exit "$rc"
  fi
  [ -n "$term_hits" ] && HITS="$HITS$term_hits"$'\n'
done

# `uniq -c` right-aligns its count in a leading field whose width differs between
# userlands, and a path may hold spaces, so the count is read off the first run of
# digits and everything after the one separator space is the path, verbatim.
COUNTS="$(printf '%s' "$HITS" | sort | uniq -c |
  awk -v tab="$TAB" '{
    c = $1
    sub(/^[[:space:]]*[0-9]+[[:space:]]/, "")
    print c tab $0
  }')"

# No match prints nothing and exits 0, same as a tree with no tickets.
[ -n "$COUNTS" ] || exit 0

MATCHED_COUNT="$(printf '%s\n' "$COUNTS" | wc -l | tr -d '[:space:]')"

if [ "$MATCHED_COUNT" -gt "$LIMIT" ]; then
  # Rank by distinct-term count descending, ties by ascending ID, and keep the
  # first LIMIT. `awk NR<=n` rather than `head -n` so the sort ahead of it is
  # never handed a closed pipe under `pipefail`.
  SELECTED="$(printf '%s\n' "$COUNTS" |
    while IFS="$TAB" read -r c p; do
      printf '%s\t%s\t%s\n' "$c" "$(fm_value "$p" id)" "$p"
    done |
    sort -t"$TAB" -k1,1nr -k2,2 |
    awk -v n="$LIMIT" 'NR <= n' |
    cut -f 3-)"
  echo "notice: matched $MATCHED_COUNT tickets, showing the $LIMIT best matches;" \
    "narrow the terms to this candidate's distinguishing vocabulary" >&2
else
  SELECTED="$(printf '%s\n' "$COUNTS" | cut -f 2-)"
fi

# Pass 2 — rows for the surviving files, in ID order whatever order rank left
# them in.
printf '%s\n' "$SELECTED" |
  while IFS= read -r f; do
    t_id="$(fm_value "$f" id)"
    t_status="$(fm_value "$f" status)"
    t_type="$(fm_value "$f" type)"
    t_title="$(fm_value "$f" title)"
    t_resolution="$(fm_value "$f" resolution)"
    # One space per offending character: the value stays legible and the field
    # count stays at five.
    t_id="${t_id//[$'\t\r\n']/ }"
    t_status="${t_status//[$'\t\r\n']/ }"
    t_type="${t_type//[$'\t\r\n']/ }"
    t_title="${t_title//[$'\t\r\n']/ }"
    t_resolution="${t_resolution//[$'\t\r\n']/ }"
    # After the squash, so the marker lands at character 200 of what is printed.
    # Bash counts and slices characters under the caller's locale, which keeps a
    # multibyte sequence at the boundary whole.
    if [ "${#t_resolution}" -gt 200 ]; then
      t_resolution="${t_resolution:0:200}..."
    fi
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "$t_id" "$t_status" "$t_type" "$t_title" "$t_resolution"
  done |
  sort
exit 0
