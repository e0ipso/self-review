---
id: 2
group: "build-config"
dependencies: []
status: "completed"
created: 2026-02-11
skills:
  - electron-forge-configuration
---
# Add asarUnpack Configuration to forge.config.ts

## Objective
Add `asarUnpack` configuration to `packagerConfig` in `forge.config.ts` so that WASM files in the `native_modules` directory are unpacked from the ASAR archive during production builds, allowing worker threads to access them at runtime.

## Skills Required
- electron-forge-configuration: Modifying Electron Forge packager config

## Acceptance Criteria
- [ ] `forge.config.ts` has `asarUnpack: ['**/native_modules/**']` in `packagerConfig`
- [ ] The `asar: true` setting is preserved
- [ ] No other changes to forge.config.ts

## Technical Requirements
- Add `asarUnpack: ['**/native_modules/**']` to the `packagerConfig` object in `forge.config.ts`
- This goes alongside the existing `asar: true` property
- Worker threads and WASM loading cannot read from inside ASAR archives, so this is required for production builds

## Input Dependencies
None

## Output Artifacts
- Updated `forge.config.ts` with `asarUnpack` configuration

## Implementation Notes
- This is a single-line addition to the existing `packagerConfig` object:
  ```ts
  packagerConfig: {
    asar: true,
    asarUnpack: ['**/native_modules/**'],
  },
  ```
