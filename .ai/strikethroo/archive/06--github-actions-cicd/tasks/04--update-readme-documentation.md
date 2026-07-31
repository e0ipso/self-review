---
id: 4
group: 'documentation'
dependencies: [3]
status: 'completed'
created: '2026-02-12'
skills:
  - documentation
---

# Update README with CI/CD Documentation

## Objective

Add a CI status badge and a brief CI/CD section to the project's README.md so contributors understand the automated testing and release pipeline.

## Skills Required

- documentation: Technical writing for developer-facing documentation

## Acceptance Criteria

- [ ] README.md has a CI status badge near the top (below the title/heading)
- [ ] README.md has a "CI/CD" section explaining the workflow structure (4 jobs, what triggers them, how releases work)
- [ ] The badge links to the Actions tab for the workflow
- [ ] Branch protection setup steps are documented (one-time manual step)
- [ ] npm Trusted Publishing one-time setup is mentioned

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- The badge URL format: `https://github.com/{owner}/{repo}/actions/workflows/ci.yml/badge.svg?branch=main`
- The badge link target: `https://github.com/{owner}/{repo}/actions/workflows/ci.yml`
- The repository appears to be `e0ipso/self-review` based on the npm scope `@e0ipso`
- Keep documentation concise — this is a developer tool, not a user-facing product

## Input Dependencies

- Task 3 must complete first (need to reference the actual workflow file name and job names)

## Output Artifacts

- Modified `README.md` with CI badge and CI/CD documentation section

## Implementation Notes

<details>

### Badge placement

Add the CI badge immediately after the first `#` heading in `README.md`. Use this markdown:

```markdown
[![CI](https://github.com/e0ipso/self-review/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/e0ipso/self-review/actions/workflows/ci.yml)
```

If the repo owner/name differs, adjust accordingly by checking `git remote -v`.

### CI/CD section content

Add a section (placement depends on existing README structure — after the project description or in a "Development" section) with content similar to:

```markdown
## CI/CD

This project uses GitHub Actions for continuous integration and delivery.

**Test gating**: Every push to `main` and every PR runs three parallel jobs — **Lint**, **Unit Tests**, and **E2E Tests**. All three must pass before a PR can be merged (enforced via branch protection required status checks).

**Automated releases**: When conventional commits are merged to `main`, [semantic-release](https://semantic-release.gitbook.io/) automatically determines the next version, creates a GitHub Release, and publishes to npm as [`@e0ipso/self-review`](https://www.npmjs.com/package/@e0ipso/self-review).

### One-time setup (maintainers)

1. **Branch protection**: After the first workflow run, go to Settings > Branches > Add rule for `main` > Enable "Require status checks to pass" > Select `Lint`, `Unit Tests`, `E2E Tests`.
2. **npm Trusted Publishing**: In the npm package settings for `@e0ipso/self-review`, configure Trusted Publishers > GitHub Actions with this repository and the `ci.yml` workflow.
```

Adapt the above to fit the existing README structure and tone. Read the current README first to match its style.

</details>
