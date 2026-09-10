#!/usr/bin/env bash
# Local tracker operations. Run from the project root, or set SIFT_ROOT.
set -eu

usage() {
  cat <<'EOF'
Usage: bash .ai/sift/scripts/sift.sh COMMAND [ARGS]
  list                         list open ticket paths
  reserve [COUNT]              reserve IDs, default 1
  triage [MILESTONE]           list titles and critical tickets
  counts                       count open tickets per milestone
  find ID                      find one ID in either bucket
  search TERM                  search ticket text
  labels | label-counts        list labels or counts
  label LABEL                  list tickets carrying a label
  dependents ID                find references to an ID
  next                         list open critical tickets that are not blocked
  move ID MILESTONE            move an open ticket within open/
  archive ID STATUS RESOLUTION close as done, wontfix or superseded
  consistency | required | resolutions | bugs | features | folders
                               print findings; empty searches are successful
  validate-draft SCHEMA FILE   optional XML validation
EOF
}

die() { printf '%s\n' "sift: $*" >&2; exit 2; }
command=${1:---help}
[ "$#" -eq 0 ] || shift
case "$command" in -h|--help) usage; exit 0 ;; esac
case "$command" in
  list|counts|labels|label-counts|next|consistency|required|resolutions|bugs|features|folders)
    [ "$#" -eq 0 ] || die "$command takes no arguments" ;;
  reserve)
    [ "$#" -le 1 ] || die 'reserve takes at most one count'
    COUNT=${1-1}; [ -n "$COUNT" ] || die 'count must not be empty' ;;
  triage)
    [ "$#" -le 1 ] || die "triage takes at most one milestone"
    MILESTONE=${1-} ;;
  find|search|label|dependents)
    [ "$#" -eq 1 ] || die "$command takes one argument"
    case "$command" in
      find|dependents) ID=$1 ;;
      search) SIFT_SEARCH_TERM=$1 ;;
      label) LABEL=$1 ;;
    esac ;;
  move)
    [ "$#" -eq 2 ] || die 'move requires ID and milestone'
    ID=$1; DEST=$2
    case "$DEST" in ''|.|..|*/*) die 'milestone must be one directory name' ;; esac ;;
  archive)
    [ "$#" -eq 3 ] || die 'archive requires ID, status and resolution'
    ID=$1; STATUS=$2; RESOLUTION=$3
    case "$STATUS" in done|wontfix|superseded) ;; *) die 'invalid terminal status' ;; esac ;;
  validate-draft)
    [ "$#" -eq 2 ] || die 'validate-draft requires schema and draft paths'
    SCHEMA=$1; DRAFT=$2 ;;
  *) die "unknown command: $command (use --help)" ;;
esac

cd "${SIFT_ROOT:-.}" || die 'cannot enter project root'
[ -d .ai/sift/open ] && [ -d .ai/sift/archive ] || die 'missing .ai/sift buckets; run sift-init'
# BEGIN prefix-setup
PREFIX=$(grep -m1 '^prefix:' .ai/sift/config/config.yaml | awk '{print $2}' | tr -d "\"'")
export PREFIX="$PREFIX"
[ -d .ai/sift ] || { echo "missing .ai/sift — run from the repository root" >&2; false; }
# END prefix-setup
PREFIX=${SIFT_PREFIX:-$PREFIX}
printf '%s\n' "$PREFIX" | LC_ALL=C grep -Eq '^[A-Z][A-Z0-9]*$' || die 'invalid ticket prefix'
if [ "${ID+x}" = x ]; then
  printf '%s\n' "$ID" | LC_ALL=C grep -Eq "^$PREFIX-[0-9]{4,}$" || die 'invalid ticket ID'
fi
SIFT=.ai/sift

# Named blocks are exercised directly across the cookbook portability matrix.
case "$command" in
list)
# BEGIN list
find .ai/sift/open -name "$PREFIX-*.md" | sort
# END list
;;
reserve)
# BEGIN reserve
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
# END reserve
;;
triage)
if [ -z "$MILESTONE" ]; then
# BEGIN milestone-setup
MILESTONE=$(basename "$(find .ai/sift/open -mindepth 1 -maxdepth 1 -type d | sort | head -n 1)")
export MILESTONE="$MILESTONE"
# END milestone-setup
fi
# BEGIN triage
grep -r --include="$PREFIX-*.md" -H '^title:' ".ai/sift/open/$MILESTONE" | sort
grep -rl '^priority: p1' .ai/sift/open        # all critical tickets
# END triage
;;
counts)
# BEGIN counts
for m in .ai/sift/open/*/; do
  [ -d "$m" ] || continue
  printf '%-28s %s\n' "$(basename "$m")" "$(find "$m" -name "$PREFIX-*.md" | wc -l)"
done
# END counts
;;
find)
# BEGIN find
find .ai/sift -name "${ID:-$PREFIX-0042}--*.md"
# END find
;;
search)
# BEGIN search
grep -ril -e "${SIFT_SEARCH_TERM:-cache invalidation}" .ai/sift --include="$PREFIX-*.md"
# END search
;;
labels)
# BEGIN labels
find .ai/sift/open .ai/sift/archive -name "$PREFIX-*.md" | sort | while read -r f; do
  awk '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^labels:/ {
      sub(/^labels:[[:space:]]*/, ""); sub(/^\[/, ""); sub(/\][[:space:]]*(#.*)?$/, "")
      n = split($0, a, ",")
      for (i = 1; i <= n; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", a[i])
        if (a[i] != "") print a[i]
      }
      exit
    }
  ' "$f"
done | sort -u
# END labels
;;
label-counts)
# BEGIN label-counts
find .ai/sift/open .ai/sift/archive -name "$PREFIX-*.md" | sort | while read -r f; do
  awk '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^labels:/ {
      sub(/^labels:[[:space:]]*/, ""); sub(/^\[/, ""); sub(/\][[:space:]]*(#.*)?$/, "")
      n = split($0, a, ",")
      for (i = 1; i <= n; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", a[i])
        if (a[i] != "") print a[i]
      }
      exit
    }
  ' "$f" | sort -u
done | sort | uniq -c |
  awk '{ n = $1; sub(/^[[:space:]]*[0-9]+[[:space:]]+/, ""); printf "%s\t%s\n", $0, n }'
# END label-counts
;;
label)
# BEGIN label
LABEL=${LABEL?}
find .ai/sift/open .ai/sift/archive -name "$PREFIX-*.md" | sort | while read -r f; do
  awk -v want="$LABEL" '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^labels:/ {
      sub(/^labels:[[:space:]]*/, ""); sub(/^\[/, ""); sub(/\][[:space:]]*(#.*)?$/, "")
      n = split($0, a, ",")
      for (i = 1; i <= n; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", a[i])
        if (a[i] == want) { print FILENAME; exit }
      }
      exit
    }
  ' "$f"
done | while read -r f; do
  awk '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^id:/    { id = $2; next }
    infm && /^title:/ { title = $0; sub(/^title:[[:space:]]*/, "", title); next }
    END { printf "%s  %s  %s\n", id, title, FILENAME }
  ' "$f"
done
# END label
;;
dependents)
# BEGIN dependents
grep -rlE "${ID:-$PREFIX-0042}([^0-9]|$)" .ai/sift --include="$PREFIX-*.md" | grep -v "${ID:-$PREFIX-0042}--"
# END dependents
;;
next)
# BEGIN next
grep -rl '^priority: p1' .ai/sift/open --include="$PREFIX-*.md" \
  | while read -r f; do grep -q '^status: blocked' "$f" || echo "$f"; done | sort
# END next
;;
move)
# BEGIN move
DEST=${DEST:?}
ID=${ID:?}
f=$(find .ai/sift/open -name "$ID--*.md")
[ -n "$f" ] || { echo "move: no ticket matching $ID" >&2; false; }
[ -f "$f" ] || { echo "move: $ID does not match exactly one ticket" >&2; false; }
d=".ai/sift/open/$DEST/$(basename "$(dirname "$f")")"   # keep the same category
mkdir -p "$d" && mv "$f" "$d/"
# Delete the category and milestone folders the move emptied, never the bucket.
# rmdir is the emptiness test: it refuses a folder another writer just filled.
dir=$(dirname "$f")
while [ "$dir" != .ai/sift/open ] && rmdir "$dir" 2>/dev/null; do
  dir=$(dirname "$dir")
done
t="$d/$(basename "$f")"
DEST="$DEST" awk '
  BEGIN { in_fm = 0; wrote = 0 }
  NR == 1 && /^---[[:space:]]*$/ { in_fm = 1; print; next }  # front matter starts at line 1 only
  in_fm && /^---[[:space:]]*$/ { in_fm = 0; print; next }    # …and ends at the first closing fence
  in_fm && /^milestone:/ {
    print "milestone: " ENVIRON["DEST"]
    wrote = 1
    next
  }
  { print }
  END {
    if (!wrote) {
      print "move: no milestone: key in the front matter" > "/dev/stderr"
      exit 1
    }
  }
' "$t" > "$t.tmp" && mv "$t.tmp" "$t" || {
  rm -f "$t.tmp"
  echo "MILESTONE NOT UPDATED in $t: the file moved, set the key by hand" >&2
  false
}
# END move
;;
archive)
# BEGIN archive
ID=${ID:?}
STATUS=${STATUS:?}
RESOLUTION=${RESOLUTION?}
f=$(find .ai/sift/open -name "$ID--*.md")
[ -n "$f" ] || { echo "archive: no ticket matching $ID" >&2; false; }
[ -f "$f" ] || { echo "archive: $ID does not match exactly one ticket" >&2; false; }
[ -n "$RESOLUTION" ] || { echo "archive: RESOLUTION must be non-empty" >&2; false; }
RESOLUTION="$RESOLUTION" STATUS="$STATUS" TODAY="$(date +%F)" awk '
  BEGIN { in_fm = 0; wrote = 0 }
  function emit_res(   v) {
    v = ENVIRON["RESOLUTION"]
    if (v == "") {
      print "archive: RESOLUTION must be non-empty" > "/dev/stderr"
      exit 1
    }
    print "resolution: \"" v "\""
    wrote = 1
  }
  NR == 1 && /^---[[:space:]]*$/ { in_fm = 1; print; next }  # front matter starts at line 1 only
  in_fm && /^---[[:space:]]*$/ {                             # …and ends at the first closing fence
    if (!wrote) emit_res()                  # insert before closing fence when absent
    in_fm = 0
    print
    next
  }
  in_fm && /^status:/  { print "status: "  ENVIRON["STATUS"]; next }
  in_fm && /^updated:/ { print "updated: " ENVIRON["TODAY"];  next }
  in_fm && /^resolution:[[:space:]]*/ {      # rewrite existing (incl. empty) line
    emit_res()
    next
  }
  { print }
  END {
    if (!wrote) {
      print "archive: no front-matter found to hold resolution" > "/dev/stderr"
      exit 1
    }
  }
' "$f" > "$f.tmp" && mv "$f.tmp" "$f" || { rm -f "$f.tmp"; false; }
dest=$(printf '%s\n' "$f" | sed 's#/open/#/archive/#')
mkdir -p "$(dirname "$dest")" && mv "$f" "$dest"
# Delete the category and milestone folders the move emptied, never the bucket.
# rmdir is the emptiness test: it refuses a folder another writer just filled.
dir=$(dirname "$f")
while [ "$dir" != .ai/sift/open ] && rmdir "$dir" 2>/dev/null; do
  dir=$(dirname "$dir")
done
# END archive
;;
consistency)
# BEGIN consistency
[ -d .ai/sift ] || { echo "missing .ai/sift — run from the repository root" >&2; false; }
# Every open ticket must carry a wave: key.
find .ai/sift/open -name "$PREFIX-*.md" | while read -r f; do
  awk '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^wave:/ { found = 1; exit }
    END { exit(found ? 0 : 1) }
  ' "$f" || echo "NO WAVE: ${f#.ai/sift/}"
done
# Every depends_on ID must resolve to a ticket file, open or archived.
find .ai/sift/open .ai/sift/archive -name "$PREFIX-*.md" | sort | while read -r f; do
  awk '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^depends_on:/ {
      sub(/^depends_on:[[:space:]]*/, ""); sub(/^\[/, ""); sub(/\][[:space:]]*(#.*)?$/, "")
      n = split($0, a, ",")
      for (i = 1; i <= n; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", a[i])
        if (a[i] != "") print a[i]
      }
      exit
    }
  ' "$f" | while read -r dep; do
    find .ai/sift/open .ai/sift/archive -name "$dep--*.md" | grep -q . || \
      echo "UNRESOLVED DEPENDENCY: ${f#.ai/sift/} depends_on $dep, which has no ticket file"
  done
done
# END consistency
;;
required)
# BEGIN required
[ -d .ai/sift ] || { echo "missing .ai/sift — run from the repository root" >&2; false; }
for k in id title status type milestone priority effort created updated; do
  echo "== missing $k:"
  grep -rL "^$k:" .ai/sift/open .ai/sift/archive --include="$PREFIX-*.md" || [ $? -eq 1 ]
done
# END required
;;
resolutions)
# BEGIN resolutions
[ -d .ai/sift ] || { echo "missing .ai/sift — run from the repository root" >&2; false; }
find .ai/sift/open .ai/sift/archive -name "$PREFIX-*.md" | sort | while read -r f; do
  awk '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^status:/ { st = $2; next }
    infm && /^resolution:/ {
      res = $0
      sub(/^resolution:[[:space:]]*/, "", res)
      gsub("[\047\"[:space:]]", "", res)
      next
    }
    END {
      if (st == "done" || st == "wontfix" || st == "superseded")
        if (res == "") print "ARCHIVED WITHOUT RESOLUTION: " FILENAME
    }
  ' "$f"
done
# END resolutions
;;
bugs)
# BEGIN bugs
grep -rl '^type: bug' .ai/sift/open .ai/sift/archive --include="$PREFIX-*.md" \
  | while read -r f; do grep -q '^## Expected behaviour' "$f" || echo "$f"; done
# END bugs
;;
features)
# BEGIN features
grep -rl '^type: feature' .ai/sift/open --include="$PREFIX-*.md" \
  | while read -r f; do grep -q '^## Direction' "$f" || echo "$f"; done
# END features
;;
validate-draft)
# BEGIN validate-draft
if command -v xmllint >/dev/null; then
  xmllint --noout --schema "${SCHEMA:-.ai/sift/schemas/bug-ticket.xsd}" "${DRAFT:-/tmp/draft.xml}"
else
  echo "xmllint not installed — skipping (optional); check the schema by eye"
fi
# END validate-draft
;;
folders)
# BEGIN folders
find .ai/sift/open .ai/sift/archive -name "$PREFIX-*.md" | while read -r f; do
  m=$(awk '
    NR == 1 && /^---[[:space:]]*$/ { infm = 1; next }
    infm && /^---[[:space:]]*$/ { exit }
    infm && /^milestone:/ { print $2; exit }
  ' "$f")
  if [ -z "$m" ]; then
    echo "NO MILESTONE: $f"
  else
    case "$f" in */"$m"/*) ;; *) echo "MISMATCH: $f (says $m)";; esac
  fi
done
# END folders
;;
esac
