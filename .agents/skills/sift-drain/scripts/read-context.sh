#!/usr/bin/env bash
# Read one bounded page of a file or Markdown section. No state is written.
# Usage: read-context.sh FILE HEADING|--all|--preamble [PAGE]
# Pages contain at most 8000 content bytes plus a short continuation header.
set -uo pipefail
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo 'usage: read-context.sh FILE HEADING|--all|--preamble [PAGE]' >&2
  exit 2
fi
case "${3:-1}" in
  ''|*[!0-9]*|0) echo 'page must be a positive integer' >&2; exit 2 ;;
esac
[ -f "$1" ] && [ -r "$1" ] || { echo 'context file is not readable' >&2; exit 2; }
unterminated=0
last_byte=$(tail -c 1 "$1") || exit 2
[ -z "$last_byte" ] || unterminated=1
SIFT_CONTEXT_UNTERMINATED="$unterminated" SIFT_CONTEXT_HEADING="$2" SIFT_CONTEXT_PAGE="${3:-1}" LC_ALL=C awk '
  BEGIN {
    want = ENVIRON["SIFT_CONTEXT_HEADING"]
    page = ENVIRON["SIFT_CONTEXT_PAGE"] + 0
    all = (want == "--all")
    preamble = (want == "--preamble")
    found = (all || preamble)
    limit = 8000
  }
  /^```/ { fence = !fence }
  !fence && /^## / {
    seen_heading = 1
    if ($0 == want) { active = 1; found = 1 }
    else if (active) active = 0
  }
  all || active || (preamble && !seen_heading) { body = body $0 "\n"; last_included = NR }
  END {
    if (!found) exit 3
    if (ENVIRON["SIFT_CONTEXT_UNTERMINATED"] == 1 && last_included == NR)
      body = substr(body, 1, length(body) - 1)
    length_in_bytes = length(body)
    start = 1; count = 0
    do {
      end = start + limit
      # Keep UTF-8 continuation bytes with their leading byte. LC_ALL=C makes
      # length/substr byte-based on both GNU and BSD awk.
      while (end <= length_in_bytes && end > start &&
        substr(body, end, 1) >= sprintf("%c", 128) &&
        substr(body, end, 1) <= sprintf("%c", 191)) end--
      if (end == start) end = start + limit
      count++
      if (count == page) selected = substr(body, start, end - start)
      start = end
    } while (start <= length_in_bytes)
    if (page > count || page < 1) exit 4
    printf "page: %d/%d; next: %s\n", page, count, (page < count) ? page + 1 : "none"
    printf "%s", selected
  }
' "$1"
result=$?
case "$result" in
  3) echo 'section not found; use an exact ## heading outside code fences' >&2 ;;
  4) echo 'page is outside the selected content' >&2 ;;
esac
exit "$result"
