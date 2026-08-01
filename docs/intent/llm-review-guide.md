# Intent: LLM-generated review walkthrough (guide sidecar)

Confirmed statement of intent, extracted via interview on 2026-08-01.

- **Outcome:** A new standalone `self-review-guide` skill that generates a sidecar XML
  "walkthrough" file (its own XSD, v1, with an embedded-copy sync test like the existing
  pattern). When self-review launches and finds the guide next to the output path
  (convention-based auto-discovery, no new CLI flags), the file tree reorganizes into named,
  ordered groups with rationales, each file gets a one-liner, and a review-level overview
  (prose, optionally Mermaid) appears before the first file.
- **User:** A solo developer reviewing AI-generated multi-file diffs in self-review.
- **Why now:** Agents hand over 25-file diffs in alphabetical order; the first minutes of
  every review are spent reverse-engineering where the change actually lives. CodeRabbit
  showed LLM-generated orientation works.
- **Success:** Time-to-orientation drops to near zero — the reviewer reads the overview and
  starts on "Core change" file 1 immediately, allocating attention by load-bearingness
  instead of alphabet.
- **Constraints:**
  - The guide is orientation only, never suppression — every file stays reachable.
  - Files in the diff but not in the guide land in an implicit "Everything else" group.
  - Files in the guide but not in the diff are silently dropped.
  - A bad, stale, or missing guide degrades silently to today's flat view (stderr warning
    only); it can never block or fail the review.
  - A Guided/Flat toolbar toggle always restores the deterministic alphabetical view.
  - `review.xml` and its v2 XSD are untouched; the guide is a separate concern with a
    separate lifecycle (generated before review, read-only during review).
  - `self-review-critique` calls `self-review-guide` as its first step; the guide skill
    also runs standalone (walkthrough without pre-seeded comments).
- **Out of scope (v1):**
  - Hiding or collapsing files by LLM judgment.
  - Reordering the diff pane. The guide's reading order applies to the file tree only; the
    diff pane keeps rendering file sections in diff order, so walking the tree top-to-bottom
    may scroll the pane non-monotonically. Deliberate v1 boundary.
  - Reordering hunks within a file.
  - Re-discovering the guide when the output path changes at runtime — discovery happens
    once, from the startup output path.
  - Cross-file interleaved narratives (CodeRabbit-style hunk weaving).
  - Any change to the comment/apply pipeline.
  - Any runtime LLM integration in the app itself (the app stays deterministic and
    local-only; the LLM only authors the sidecar artifact ahead of time).

## Guide vocabulary (v1)

1. **Ordered groups** — the file tree reorganizes from alphabetical paths into named groups
   (e.g. "Core change," "Tests," "Generated/mechanical"), each with a one-line rationale,
   in a deliberate reading sequence.
2. **Per-file one-liner** — e.g. "adds the retry wrapper that everything else calls" —
   shown in the tree or file header.
3. **Review-level overview** — short prose summary, optionally with a Mermaid diagram,
   shown before the first file.

## Key design decisions and their rationale

- **Sidecar file, not a section inside `review.xml`.** Two different concerns with two
  different lifecycles and authors. `review.xml` is rewritten on Finish Review; embedding a
  display section forces the serializer to round-trip content it didn't author (noise for
  the apply skill) or drop it (resume loses the guide). Separate schemas also decouple
  release cadences — the presentation schema can iterate without touching the frozen review
  contract.
- **Convention-based auto-discovery, no new CLI flags.** Precedent: `.self-review-assets/`
  is already a sidecar discovered by relative path. The single-file preference was driven
  by launch ergonomics, which discovery-by-convention resolves.
- **Tolerant loading, never fatal.** The guide is orientation garnish on a deterministic
  tool; a stale sidecar must never be worse than no sidecar.
