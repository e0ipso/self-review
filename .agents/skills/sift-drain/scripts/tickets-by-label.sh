#!/usr/bin/env bash
# tickets-by-label.sh — list tickets that carry a given label.
#
# Usage:
#   scripts/tickets-by-label.sh caching
#   scripts/tickets-by-label.sh caching --open
#   scripts/tickets-by-label.sh caching --paths
#   scripts/tickets-by-label.sh --paths -- caching
#
# `--` ends the options: every argument behind it is positional, whatever it
# looks like, and exactly one of them may be the label. A kebab label can never
# begin with a hyphen, so the marker is never strictly needed — it is there for
# the caller who passes a label out of a variable and spells the guard anyway.
# `--` is honoured identically by list-labels.sh, which has no positional to
# take and so refuses anything at all behind it.
#
# Default output is TSV: id<TAB>title<TAB>relative-path
#
# Exit codes: 0 success | 2 setup/usage error.

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() {
  echo "usage: tickets-by-label.sh <label> [--open] [--paths]" >&2
  echo "       tickets-by-label.sh [--open] [--paths] -- <label>" >&2
  echo "note: -- ends the options; exactly one label may follow it" >&2
  exit 2
}

LABEL=""
OPEN_ONLY=0
PATHS_ONLY=0

# take_label — the one-label rule, in one place, so the arm that reads a label
# before the marker and the loop that reads one after it cannot drift. Two
# labels look like an AND this script does not implement, and answering for
# either one would be a plausible wrong answer.
take_label() {
  [ -z "$LABEL" ] || usage
  LABEL="$1"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --open) OPEN_ONLY=1 ;;
    --paths) PATHS_ONLY=1 ;;
    --)
      shift
      break
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      exit 2
      ;;
    *) take_label "$1" ;;
  esac
  shift
done

# Behind the marker nothing is an option any more, so a leading hyphen reaches
# the kebab validator as a label rather than the parser as a flag.
while [ $# -gt 0 ]; do
  take_label "$1"
  shift
done

if [ -z "$LABEL" ]; then
  usage
fi

if ! label_is_kebab "$LABEL"; then
  echo "error: invalid label (expected kebab-case): $LABEL" >&2
  exit 2
fi

SEARCH_FLAG=""
[ "$OPEN_ONLY" = "1" ] && SEARCH_FLAG="--open"

while read -r dir; do
  find "$dir" -name "$PREFIX-*.md" 2>/dev/null
done < <(ticket_search_dirs $SEARCH_FLAG) | sort | while read -r f; do
  if fm_labels "$f" | grep -qxF "$LABEL"; then
    if [ "$PATHS_ONLY" = "1" ]; then
      printf '%s\n' "${f#"$ROOT/"}"
    else
      printf '%s\t%s\t%s\n' \
        "$(fm_value "$f" id)" \
        "$(fm_value "$f" title)" \
        "${f#"$ROOT/"}"
    fi
  fi
done
