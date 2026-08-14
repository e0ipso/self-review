---
id: 1
group: 'package-config'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - npm-config
---

# Update package.json and .releaserc.json for npm Publishing

## Objective

Prepare the project's package configuration for public npm publishing under the `@e0ipso/self-review` scoped name, and clean up the semantic-release plugin chain to remove plugins that cannot work with protected branches.

## Skills Required

- npm-config: Package.json configuration and npm registry publishing setup

## Acceptance Criteria

- [ ] `package.json` `"name"` field is `"@e0ipso/self-review"`
- [ ] `package.json` `"private": true` line is removed entirely
- [ ] `package.json` `"productName"` field is `"self-review"`
- [ ] `.releaserc.json` no longer contains the `@semantic-release/git` plugin entry (the entire array element with assets/message config)
- [ ] `.releaserc.json` no longer contains `@semantic-release/changelog` (since without `@semantic-release/git` the generated changelog file cannot be committed)
- [ ] Remaining `.releaserc.json` plugins are: `commit-analyzer`, `release-notes-generator`, `npm`, `github` (in that order)
- [ ] No other fields in `package.json` are modified

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `package.json` is at the project root (`/workspace/package.json`)
- `.releaserc.json` is at the project root (`/workspace/.releaserc.json`)
- The `@semantic-release/git` entry is the last element in the plugins array and is a tuple `["@semantic-release/git", { assets: [...], message: "..." }]`
- The `@semantic-release/changelog` entry is a plain string `"@semantic-release/changelog"` in the plugins array

## Input Dependencies

None — this is a standalone configuration task.

## Output Artifacts

- Modified `package.json` with correct name, no private flag, updated productName
- Modified `.releaserc.json` with cleaned-up plugin list

## Implementation Notes

<details>

### package.json changes

Open `/workspace/package.json` and make these exact changes:

1. Line 2: Change `"name": "workspace"` to `"name": "@e0ipso/self-review"`
2. Line 3: Change `"productName": "workspace"` to `"productName": "self-review"`
3. Line 7: Remove the entire `"private": true,` line

No other fields should be touched. The `description` field can remain as-is (it will be updated in a separate effort if needed).

### .releaserc.json changes

Open `/workspace/.releaserc.json` and modify the plugins array:

**Current state:**
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json", "package-lock.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ]
  ]
}
```

**Target state:**
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

Remove both `@semantic-release/changelog` (string entry) and `@semantic-release/git` (array entry with config object). The changelog plugin generates a `CHANGELOG.md` file, but without `@semantic-release/git` it cannot be committed to the repo — so it serves no purpose. GitHub Releases (via `@semantic-release/github`) will contain the release notes instead.

</details>
