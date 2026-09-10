#!/usr/bin/env bash
# sift-gate: resolve the sift project root and report the tree's state. Reads only.
#
# Walks upward once from canonical $PWD and chooses the nearest match in the
# highest available tier: A .ai/sift, B .git, C AGENTS.md or CLAUDE.md. A .git
# file is valid for worktrees and submodules. $HOME and / are never roots.
# Override root discovery with SIFT_ROOT=/path.
#
# Output: key=value lines on stdout.
#   state=READY|INCOMPLETE|UNINITIALIZED|UNRESOLVED
#   root=<absolute path>          (absent when UNRESOLVED)
#   tier=A|B|C                    (absent when UNRESOLVED)
#   marker=<what matched>         (absent when UNRESOLVED)
#   confidence=high|low           (UNINITIALIZED only)
#   corroboration=<other markers at root, comma-separated, or none>
#   missing=<entries, comma-separated>   (INCOMPLETE only)
#   prefix=<configured prefix>    (READY only)
#
# Exit codes:
#   0  READY          tree present and complete — proceed
#   3  UNINITIALIZED  tier B, high confidence — initialise without asking
#   4  UNINITIALIZED  tier C, low confidence  — report and ask before writing
#   5  UNRESOLVED     no candidate root — ask for an explicit path
#   6  INCOMPLETE     tree present but missing required entries — repair
#   2  usage/environment error

set -u

emit() { printf '%s\n' "$*"; }

# --- Resolve the root -------------------------------------------------------

hit_a=''; hit_b=''; hit_c=''; marker_c=''

if [ -n "${SIFT_ROOT:-}" ]; then
  root=$(cd "$SIFT_ROOT" 2>/dev/null && pwd -P) || {
    emit "state=UNRESOLVED"
    echo "error: SIFT_ROOT is not a readable directory: $SIFT_ROOT" >&2
    exit 2
  }
  tier='override'; marker='SIFT_ROOT'
else
  dir=$(pwd -P) || exit 2
  while :; do
    # Inspect $HOME and / for higher-tier markers, but never select them.
    if [ "$dir" != "/" ] && [ "$dir" != "${HOME:-/dev/null/nonexistent}" ]; then
      if [ -z "$hit_a" ] && [ -d "$dir/.ai/sift" ]; then hit_a=$dir; fi
      if [ -z "$hit_b" ] && [ -e "$dir/.git" ]; then hit_b=$dir; fi
      if [ -z "$hit_c" ]; then
        if [ -f "$dir/AGENTS.md" ]; then
          hit_c=$dir; marker_c='AGENTS.md'
        elif [ -f "$dir/CLAUDE.md" ]; then
          hit_c=$dir; marker_c='CLAUDE.md'
        fi
      fi
    fi
    parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && break
    dir=$parent
  done

  # Tier precedence wins over proximity.
  if   [ -n "$hit_a" ]; then root=$hit_a; tier='A'; marker='.ai/sift'
  elif [ -n "$hit_b" ]; then root=$hit_b; tier='B'; marker='.git'
  elif [ -n "$hit_c" ]; then root=$hit_c; tier='C'; marker="$marker_c"
  else
    emit "state=UNRESOLVED"
    echo "error: no sift root found at or above $(pwd -P)" >&2
    echo "hint: run from inside the project, or set SIFT_ROOT=/path/to/project" >&2
    exit 5
  fi
fi

# --- Corroborating markers at the chosen root -------------------------------

corr=''
for m in .git AGENTS.md CLAUDE.md .ai/sift; do
  [ "$m" = "$marker" ] && continue
  if [ -e "$root/$m" ]; then
    if [ -z "$corr" ]; then corr="$m"; else corr="$corr,$m"; fi
  fi
done
[ -z "$corr" ] && corr='none'

emit "root=$root"
emit "tier=$tier"
emit "marker=$marker"
emit "corroboration=$corr"

# --- Report the tree's state ------------------------------------------------

sift="$root/.ai/sift"

# tests/static/gate-handoff-contract.test.sh pins the exit 4 and 6 actions above.
if [ ! -d "$sift" ]; then
  emit "state=UNINITIALIZED"
  case "$tier" in
    C) emit "confidence=low";  exit 4 ;;
    *) emit "confidence=high"; exit 3 ;;
  esac
fi

# Milestone folders, categories, and tickets are created on demand.
missing=''
for entry in README.md MILESTONES.md config/config.yaml open archive schemas scripts/sift.sh; do
  if [ ! -e "$sift/$entry" ]; then
    if [ -z "$missing" ]; then missing="$entry"; else missing="$missing,$entry"; fi
  fi
done

if [ -n "$missing" ]; then
  emit "state=INCOMPLETE"
  emit "missing=$missing"
  exit 6
fi

prefix=$(sed -n 's/^prefix:[[:space:]]*["'\'']\{0,1\}\([A-Za-z0-9_]\{1,\}\).*/\1/p' \
  "$sift/config/config.yaml" | head -n 1)
if [ -z "$prefix" ]; then
  emit "state=INCOMPLETE"
  emit "missing=config/config.yaml:prefix"
  exit 6
fi

emit "state=READY"
emit "prefix=$prefix"
exit 0
