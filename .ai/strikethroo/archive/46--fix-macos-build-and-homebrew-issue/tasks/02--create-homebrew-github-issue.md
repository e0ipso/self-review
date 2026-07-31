---
id: 2
group: "homebrew-tracking"
dependencies: []
status: "completed"
created: "2026-03-14"
skills:
  - github-actions
---
# Create Homebrew Tap GitHub Issue

## Objective
Create a GitHub issue on `e0ipso/self-review` to track Homebrew Cask distribution support, referencing issue #57.

## Skills Required
- github-actions (gh CLI usage)

## Acceptance Criteria
- [ ] GitHub issue created on `e0ipso/self-review` with clear title referencing Homebrew
- [ ] Issue body references issue #57 as the originating request
- [ ] Issue outlines the high-level approach: `homebrew-tap` repo with Cask formula pointing to darwin-arm64 .zip
- [ ] Issue is labeled with `enhancement`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Use `gh issue create` to create the issue
- Reference issue #57 in the body
- Label with `enhancement`

## Input Dependencies
None.

## Output Artifacts
- A new GitHub issue URL

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

Create the issue using `gh`:

```bash
gh issue create \
  --repo e0ipso/self-review \
  --title "Add Homebrew Cask distribution for macOS" \
  --label "enhancement" \
  --body "$(cat <<'EOF'
## Summary

Add Homebrew Cask support so macOS users can install and update self-review via `brew install --cask self-review`.

References: #57

## Proposed Approach

1. **Create a `homebrew-tap` repository** (e.g., `e0ipso/homebrew-self-review`) containing a Cask formula
2. **Cask formula** points to the `Self.Review-darwin-arm64-*.zip` release asset on GitHub Releases
3. **Optional CI automation**: Add a step to `release-darwin.yml` that bumps the Cask formula version after a successful macOS build

## Prerequisites

- The macOS darwin-arm64 build must be working and producing release assets (tracked separately)

## Benefits

- `brew install --cask self-review` for easy installation
- `brew upgrade` for seamless updates
- Standard macOS distribution channel
EOF
)"
```

</details>
