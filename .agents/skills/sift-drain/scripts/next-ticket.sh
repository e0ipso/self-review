#!/usr/bin/env bash
# next-ticket.sh — print the next sift ticket to dispatch.
#
# Usage:
#   scripts/next-ticket.sh                 # next dispatchable ticket
#   scripts/next-ticket.sh --include-blocked
#   scripts/next-ticket.sh --group         # …plus its whole dispatch group
#   scripts/next-ticket.sh --include-blocked --   # -- ends the options
#
# Reads ticket front matter in dispatch order — `wave` ascending, then
# `priority` within the wave — and reports the first dispatchable open ticket
# plus selected front matter. The lookup state is `result: found|none`;
# `status:` remains the ticket's value and every report key is unique.
#
# `--group` adds same-cluster tickets within the count and effort bounds below,
# without changing the lead. `--` ends options; this command takes no operands.
#
# Exit codes: 0 found | 1 nothing left to dispatch | 2 setup/usage/consistency error.

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() {
  echo "usage: next-ticket.sh [--include-blocked] [--group]" >&2
  echo "note: -- ends the options; this script takes no argument behind it" >&2
  exit 2
}

# Bound one dispatch to four tickets and one xl-sized effort budget.
GROUP_MAX_TICKETS=4
GROUP_MAX_WEIGHT=8

INCLUDE_BLOCKED=0
GROUP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --include-blocked) INCLUDE_BLOCKED=1 ;;
    --group) GROUP=1 ;;
    --)
      shift
      break
      ;;
    *) usage ;;
  esac
  shift
done

# No positional arguments are accepted after the marker.
[ $# -eq 0 ] || usage

ROWS="$(ticket_rows)"
[ -n "$ROWS" ] || {
  echo "error: no ticket files under $SIFT/open or $SIFT/archive" >&2
  echo "hint: a tree with no tickets has nothing to dispatch, not an empty wave" >&2
  exit 2
}

# --- Dependencies ------------------------------------------------------------
# `depends_on` is the dispatch truth: `priority` orders a wave, but a ticket
# whose blocker is still open is not next however early it sorts. A dependency
# is met when its ticket is archived — the bucket is where resolution lives.

# dep_ids <depends_on-value> — one ID per line from a `[A, B]` flow list. A row
# with no dependencies carries ticket_rows' absent-value hyphen, not an ID.
dep_ids() {
  [ "$1" = "-" ] && return 0
  printf '%s\n' "$1" | awk '
    # Match ticket-check: flow punctuation and either quote style wrap values,
    # while whitespace only separates IDs and never becomes part of one.
    {
      gsub(/[][,"'"'"']/, " ")
      for (i = 1; i <= NF; i++) print $i
    }
  '
}

# unmet_dep <depends_on-value> — the first dependency that is not archived, or
# empty. An ID with no ticket file behind it counts as unmet: it cannot have
# been resolved, and dispatching past it would work the wave out of order.
unmet_dep() {
  local dep
  for dep in $(dep_ids "$1"); do
    printf '%s\n' "$ROWS" | SIFT_DEP="$dep" awk -F'\t' '
      BEGIN { want = ENVIRON["SIFT_DEP"] }
      $3 == want && $4 == 1 { found = 1 }
      END { exit found ? 0 : 1 }
    ' && continue
    printf '%s\n' "$dep"
    return 0
  done
}

CHOSEN_WAVE=""
CHOSEN_ID=""
CHOSEN_FILE=""
SKIPPED=""

# dispatchable <wave> <id> <done> <status> <depends_on> — true when this ticket
# can be handed out now; every refusal that is not "already finished" is named
# under skipped:, so a wave is never silently short.
dispatchable() {
  local wave="$1" id="$2" archived="$3" status="$4" deps="$5" blocker
  [ "$archived" = "1" ] && return 1
  if [ "$wave" = "0" ]; then
    SKIPPED="$SKIPPED$id (no wave key, so it is in no wave)"$'\n'
    return 1
  fi
  if [ "$INCLUDE_BLOCKED" = "0" ] && [ "$status" = "blocked" ]; then
    SKIPPED="$SKIPPED$id (status: blocked)"$'\n'
    return 1
  fi
  blocker="$(unmet_dep "$deps")"
  if [ -n "$blocker" ]; then
    SKIPPED="$SKIPPED$id (depends_on $blocker, which is not resolved)"$'\n'
    return 1
  fi
  return 0
}

while IFS=$'\t' read -r wave _pri id archived status _effort deps _title file; do
  dispatchable "$wave" "$id" "$archived" "$status" "$deps" || continue
  CHOSEN_WAVE="$wave"; CHOSEN_ID="$id"; CHOSEN_FILE="$file"
  break
done <<< "$ROWS"

if [ -z "$CHOSEN_ID" ]; then
  echo "result: none"
  echo "note: every ticket is archived or skipped — there is nothing to dispatch"
  [ -n "$SKIPPED" ] && printf 'skipped:\n%s' "$SKIPPED"
  exit 1
fi

REMAINING="$(printf '%s\n' "$ROWS" | CHOSEN_WAVE="$CHOSEN_WAVE" awk -F'\t' '
  BEGIN { want = ENVIRON["CHOSEN_WAVE"] + 0 }
  $1 == want && $4 == 0 { printf "%s ", $3 }')"
REMAINING_COUNT="$(printf '%s\n' "$ROWS" | CHOSEN_WAVE="$CHOSEN_WAVE" awk -F'\t' '
  BEGIN { want = ENVIRON["CHOSEN_WAVE"] + 0 }
  $1 == want && $4 == 0' | wc -l | tr -d ' ')"

# --- The dispatch group ------------------------------------------------------
# Grouping runs after lead selection, preserving the default order and output.

# read_cluster <id> <file> — set CLUSTER or record a malformed advisory value.
# Avoid command substitution because the skipped: update must survive.
CLUSTER=''
read_cluster() {
  local raw
  CLUSTER="$(ticket_cluster "$2")"
  [ -n "$CLUSTER" ] && return 0
  raw="$(fm_value "$2" cluster)"
  [ -n "$raw" ] || return 0
  SKIPPED="$SKIPPED$1 (cluster: $raw is not kebab-case, so it groups alone)"$'\n'
}

# Start with the lead so group output is present even without a cluster.
GROUP_IDS="$CHOSEN_ID"
GROUP_FILES="$CHOSEN_FILE"
GROUP_SIZE=1
GROUP_WEIGHT=0
LEAD_CLUSTER=''

if [ "$GROUP" = "1" ]; then
  read_cluster "$CHOSEN_ID" "$CHOSEN_FILE"
  LEAD_CLUSTER="$CLUSTER"
  GROUP_WEIGHT="$(effort_weight "$(fm_value "$CHOSEN_FILE" effort)")"
fi

if [ -n "$LEAD_CLUSTER" ]; then
  # Scan behind the lead for dispatchable cluster peers. After a non-member gap,
  # do not cross into the next wave while the current wave remains open.
  seen_lead=0
  gap=0
  while IFS=$'\t' read -r wave _pri id archived status effort deps _title file; do
    if [ "$seen_lead" = "0" ]; then
      [ "$id" = "$CHOSEN_ID" ] && seen_lead=1
      continue
    fi
    [ "$archived" = "1" ] && continue # terminal work is nobody else's member
    [ "$wave" != "$CHOSEN_WAVE" ] && [ "$gap" = "1" ] && break
    member=0
    # Membership is dispatchability, so a peer refused for its own reasons is a
    # gap rather than a member — and the refusal is recorded once, by the pass
    # that would have dispatched it as a lead.
    if [ "$wave" != "0" ] &&
       { [ "$INCLUDE_BLOCKED" = "1" ] || [ "$status" != "blocked" ]; } &&
       [ -z "$(unmet_dep "$deps")" ]; then
      read_cluster "$id" "$file"
      [ "$CLUSTER" = "$LEAD_CLUSTER" ] && member=1
    fi
    if [ "$member" = "0" ]; then
      gap=1
      continue
    fi
    # Stop at the first bound breach to preserve dispatch order.
    weight="$(effort_weight "$effort")"
    [ $((GROUP_SIZE + 1)) -gt "$GROUP_MAX_TICKETS" ] && break
    [ $((GROUP_WEIGHT + weight)) -gt "$GROUP_MAX_WEIGHT" ] && break
    GROUP_SIZE=$((GROUP_SIZE + 1))
    GROUP_WEIGHT=$((GROUP_WEIGHT + weight))
    GROUP_IDS="$GROUP_IDS $id"
    GROUP_FILES="$GROUP_FILES"$'\n'"$file"
  done <<< "$ROWS"
fi

echo "result: found"
echo "wave: $CHOSEN_WAVE"
echo "ticket: $CHOSEN_ID"
echo "file: $CHOSEN_FILE"
for key in id title status type milestone priority effort depends_on labels; do
  printf '%s: %s\n' "$key" "$(fm_value "$CHOSEN_FILE" "$key")"
done
echo "remaining_in_wave: $REMAINING_COUNT"
echo "remaining_ids: ${REMAINING% }"
if [ "$GROUP" = "1" ]; then
  # Keep group keys distinct from ticket keys. Paths use a block so spaces survive.
  echo "group_size: $GROUP_SIZE"
  echo "group_tickets: $GROUP_IDS"
  printf 'group_files:\n%s\n' "$GROUP_FILES"
fi
[ -n "$SKIPPED" ] && printf 'skipped:\n%s' "$SKIPPED"
exit 0
