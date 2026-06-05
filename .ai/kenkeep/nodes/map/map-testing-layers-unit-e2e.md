---
schema_version: 1
id: map-testing-layers-unit-e2e
title: Testing layers (unit + e2e)
kind: map
tags:
  - task-manager
  - testing
  - layers
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Vitest for fast unit tests; Playwright + Cucumber for webapp e2e (CI) and
  Electron e2e (local only).
---
The app has two testing layers:

1. **Unit tests** (Vitest) — colocated `*.test.ts` files. Separate configs for main (Node env) and renderer (jsdom). Run via `npm run test:unit`, `test:unit:main`, `test:unit:renderer`, `test:coverage`.
2. **E2E tests** (Playwright + Cucumber) in two tiers:
   - **Webapp e2e** (primary, runs in CI) — tests `@self-review/react` components via a Vite dev server with fixtures. Run via `npm run test:e2e`.
   - **Electron e2e** (supplementary, local only) — tests Electron-specific behavior (XML output, resume, error handling, welcome screen, expand context, find-in-page). Requires packaging + xvfb. Run via `npm run test:e2e:electron`.

Coverage target is ~50–60% on business logic; thresholds are collected but not enforced.
