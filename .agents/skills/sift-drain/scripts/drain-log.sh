#!/usr/bin/env bash
# drain-log.sh — stamp one row per drain event into .ai/sift/RUNLOG.md.
#
# Usage:
#   scripts/drain-log.sh dispatch <TICKET>...
#   scripts/drain-log.sh phase orient|implement|verify|bookkeep
#   scripts/drain-log.sh return <TICKET> <STATUS>...
#   scripts/drain-log.sh report
#   scripts/drain-log.sh -- dispatch <TICKET>...   # -- ends the options
#
# The append-only log records a shared timestamp for every row emitted by one
# command. `report` groups dispatches by epoch and reports runtime, phase timing,
# idle gap, outcomes, and runtime per resolved ticket. Arithmetic uses epoch
# seconds; UTC strings are display-only for GNU/BSD portability.
#
# `--` is accepted only before the subcommand. Everything after the subcommand is
# an operand, and ticket operands must match the configured ticket-ID shape.
#
# Exit codes: 0 success | 2 setup/usage error.

set -uo pipefail
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() {
  echo "usage: drain-log.sh dispatch <TICKET>..." >&2
  echo "       drain-log.sh phase orient|implement|verify|bookkeep" >&2
  echo "       drain-log.sh return <TICKET> <STATUS>..." >&2
  echo "       drain-log.sh report" >&2
  echo "note: -- ends the options; it may stand in front of the subcommand" >&2
  exit 2
}

LOG="$SIFT/RUNLOG.md"

# Validate shape before the append-only log is created. Do not look up a ticket
# file: a return may be stamped after its ticket has moved to archive/.
#
# Accept PREFIX plus four-or-more digits; %04d is a minimum width. The outer arm
# supplies the minimum and the inner arm rejects non-digits. Keep this rule in
# sync with sift-prime/scripts/reserve-ids.sh and run the cross-skill ID test.
# `[0-9]` is intentional and byte-comparable with that copy; the portability ban
# applies to locale-collated letter ranges.
require_ticket_id() {
  case "$1" in
    "$PREFIX"-[0-9][0-9][0-9][0-9]*)
      case "${1#"$PREFIX"-}" in
        *[!0-9]*) ;;
        *) return 0 ;;
      esac
      ;;
  esac
  echo "error: not a ticket ID: $1" >&2
  echo "hint: a ticket ID is $PREFIX- followed by at least four digits, e.g. $PREFIX-0001" >&2
  exit 2
}

# Read the clock once so every row from one command shares an epoch.
stamp() {
  UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  EPOCH="$(date +%s)"
}

# Create the header lazily on the first write.
ensure_log() {
  [ -f "$LOG" ] || {
    {
      echo "# Run log"
      echo
      echo "Append-only. One row per drain event; rows are never rewritten."
      echo
      echo "| event | ticket | phase | utc | epoch | status |"
      echo "|---|---|---|---|---|---|"
    } > "$LOG" || {
      echo "error: cannot create the run log: $LOG" >&2
      exit 2
    }
  }
}

# append_row <event> <ticket> <phase> <utc> <epoch> <status> — one row, six
# columns, a literal dash in every cell the event has no use for.
append_row() {
  printf '| %s | %s | %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4" "$5" "$6" >> "$LOG" || {
    echo "error: cannot append to the run log: $LOG" >&2
    exit 2
  }
}

# Report groups using integer arithmetic on epoch; never parse UTC with
# platform-specific `date -d` or `date -v`.
report() {
  [ -f "$LOG" ] || {
    echo "error: no run log at $LOG" >&2
    echo "hint: a run log is created by the first 'drain-log.sh dispatch <TICKET>' of a drain" >&2
    exit 2
  }

  # Pass path data through ENVIRON; awk -v re-scans backslash escapes.
  SIFT_LOG_PATH="${LOG#"$ROOT/"}" awk -F'|' '
    # This is a single-quoted shell string; keep awk comments free of apostrophes.
    BEGIN { logpath = ENVIRON["SIFT_LOG_PATH"] }

    # POSIX [[:space:]] avoids undefined backslashes in bracket expressions.
    function trim(s) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }

    # Seconds, plus a human-readable form once the figure stops being obvious.
    function human(d,   h, m, s) {
      if (d < 60) return d "s"
      h = int(d / 3600); m = int((d % 3600) / 60); s = d % 60
      if (h > 0) return d "s (" h "h" m "m" s "s)"
      return d "s (" m "m" s "s)"
    }

    function note_add(k, text) {
      rnote[k] = (rnote[k] == "") ? text : rnote[k] "; " text
    }

    # Negative runtime means no measurable duration and is excluded from cost
    # and median figures. Render per-ticket time with integer division.
    function push(tickets, runtime, idle_text, phases, resolved, note,   k) {
      k = ++nrec
      rtick[k] = tickets; rrt[k] = runtime; ridle[k] = idle_text
      rphase[k] = (phases == "") ? "-" : phases
      rres[k] = resolved
      rnote[k] = ""
      if (note != "") note_add(k, note)
      rper[k] = (runtime >= 0 && resolved > 0) ? human(int(runtime / resolved)) : "-"
      return k
    }

    # A negative return epoch closes an incomplete group without a duration.
    function close_group(ret_epoch,
                         i, d, k, tickets, phases, runtime, resolved,
                         idle, idle_text, idle_note, note) {
      tickets = ""; phases = ""; resolved = 0
      for (i = 1; i <= og_n; i++) {
        if (i > 1) tickets = tickets ", "
        tickets = tickets og_t[i] " " ((og_s[i] == "") ? "-" : og_s[i])
        if (og_s[i] == "done") resolved++
      }

      # Each phase ends at the next phase or the closing return.
      for (i = 1; i <= og_np; i++) {
        if (i < og_np) d = og_pe[i + 1] - og_pe[i]
        else if (ret_epoch >= 0) d = ret_epoch - og_pe[i]
        else d = -1
        if (i > 1) phases = phases ", "
        phases = phases og_pn[i] " " ((d < 0) ? "-" : human(d))
      }

      note = ""
      if (ret_epoch < 0) {
        runtime = -1
        note = "INCOMPLETE (no return row)"
      } else {
        runtime = ret_epoch - og_epoch
        if (runtime < 0) { runtime = -1; note = "CORRUPT (negative runtime)" }
      }

      idle_text = "-"; idle_note = ""
      if (ret_epoch >= 0 && have_prev) {
        idle = og_epoch - prev_return
        if (idle < 0) { idle_text = "CORRUPT"; idle_note = "CORRUPT (negative idle gap)" }
        else idle_text = human(idle)
      }

      k = push(tickets, runtime, idle_text, phases, resolved, note)
      if (idle_note != "") note_add(k, idle_note)
      if (ret_epoch >= 0) { prev_return = ret_epoch; have_prev = 1 }
      og = 0
    }

    !/^[[:space:]]*\|/ { next }        # table rows only
    NF < 8 { next }                    # a six-column row is | a | b | c | d | e | f |
    {
      event = trim($2); ticket = trim($3); phase = trim($4)
      epoch = trim($6); status = trim($7)
      if (event != "dispatch" && event != "return" && event != "phase") next

      if (epoch !~ /^[0-9]+$/) {
        push((event == "phase") ? "phase " phase : ticket " " status,
             -1, "-", "-", 0, "CORRUPT (unreadable epoch \"" epoch "\")")
        next
      }
      epoch = epoch + 0

      # A new dispatch epoch closes any still-open group as incomplete.
      if (event == "dispatch") {
        if (og && epoch != og_epoch) close_group(-1)
        if (!og) { og = 1; og_epoch = epoch; og_n = 0; og_np = 0 }
        og_n++; og_t[og_n] = ticket; og_s[og_n] = ""
        next
      }

      if (event == "phase") {
        if (!og) {
          push("phase " phase, -1, "-", "-", 0, "ORPHAN (phase with no dispatch row)")
          next
        }
        og_np++; og_pn[og_np] = phase; og_pe[og_np] = epoch
        next
      }

      # A return outside the open group membership is an orphan; keep the real
      # group open for its own returns.
      matched = 0
      if (og) {
        for (i = 1; i <= og_n; i++) {
          if (og_t[i] == ticket && og_s[i] == "") { og_s[i] = status; matched = 1; break }
        }
      }
      if (!matched) {
        push(ticket " " status, -1, "-", "-", 0, "ORPHAN (return with no dispatch row)")
        next
      }

      pending = 0
      for (i = 1; i <= og_n; i++) if (og_s[i] == "") pending++
      if (pending == 0) close_group(epoch)
    }

    END {
      if (og) close_group(-1)

      if (nrec == 0) {
        print "no drain events recorded in " logpath
        exit 0
      }

      # Use the lower middle completed runtime for an even-sized median.
      n = 0
      for (i = 1; i <= nrec; i++) if (rrt[i] >= 0) v[++n] = rrt[i]
      for (i = 2; i <= n; i++) {           # insertion sort: POSIX awk has no asort
        key = v[i]
        for (j = i - 1; j >= 1 && v[j] > key; j--) v[j + 1] = v[j]
        v[j + 1] = key
      }
      median = (n > 0) ? v[int((n + 1) / 2)] : -1

      for (i = 1; i <= nrec; i++)
        if (rrt[i] >= 0 && median > 0 && rrt[i] > 10 * median)
          note_add(i, "SLOW (" int(rrt[i] / median) "x median)")

      # Completed groups contribute runtime even when they resolved no tickets.
      total = 0; resolved_total = 0
      for (i = 1; i <= nrec; i++)
        if (rrt[i] >= 0) { total += rrt[i]; resolved_total += rres[i] }

      for (i = 1; i <= nrec; i++) {
        if (i > 1) print ""
        print "group " i
        print "  tickets: " rtick[i]
        print "  runtime: " ((rrt[i] >= 0) ? human(rrt[i]) : "-")
        print "  idle before: " ridle[i]
        print "  phases: " rphase[i]
        print "  per ticket resolved: " rper[i]
        print "  notes: " ((rnote[i] == "") ? "-" : rnote[i])
      }

      print ""
      if (n > 0)
        print "median runtime: " human(median) " across " n " completed group(s) of " nrec
      else
        print "median runtime: - (no completed groups of " nrec ")"
      if (resolved_total > 0)
        print "minutes per ticket resolved: " human(int(total / resolved_total)) \
              " across " resolved_total " resolved ticket(s) in " n " completed group(s)"
      else
        print "minutes per ticket resolved: - (no tickets resolved)"
      print "note: runtime is stamped by the orchestrator around the dispatch, so it"
      print "      includes a few seconds of dispatch overhead and is an upper bound."
    }
  ' "$LOG"
}

# Consume an optional `--` before the subcommand; leave the subcommand in $1.
while [ $# -gt 0 ]; do
  case "$1" in
    --)
      shift
      break
      ;;
    *) break ;;   # the subcommand; every argument from here is its operand
  esac
done

MODE="${1:-}"
[ $# -gt 0 ] && shift

# Validate the entire command before creating the header or appending a row.
case "$MODE" in
  dispatch)
    [ $# -ge 1 ] || usage
    for arg in "$@"; do require_ticket_id "$arg"; done
    stamp
    ensure_log
    for arg in "$@"; do append_row dispatch "$arg" - "$UTC" "$EPOCH" -; done
    ;;
  phase)
    [ $# -eq 1 ] || usage
    case "$1" in
      orient|implement|verify|bookkeep) ;;
      *)
        echo "error: not a drain phase: $1" >&2
        usage
        ;;
    esac
    stamp
    ensure_log
    append_row phase - "$1" "$UTC" "$EPOCH" -
    ;;
  return)
    # Return operands are ticket/status pairs; reject a shifted odd list.
    [ $# -ge 2 ] || usage
    [ $(( $# % 2 )) -eq 0 ] || usage
    pos=0
    for arg in "$@"; do
      pos=$((pos + 1))
      if [ $((pos % 2)) -eq 1 ]; then require_ticket_id "$arg"
      elif [ -z "$arg" ]; then usage
      fi
    done
    stamp
    ensure_log
    while [ $# -gt 0 ]; do
      append_row return "$1" - "$UTC" "$EPOCH" "$2"
      shift 2
    done
    ;;
  report)
    [ $# -eq 0 ] || usage
    report
    exit $?
    ;;
  *) usage ;;
esac
