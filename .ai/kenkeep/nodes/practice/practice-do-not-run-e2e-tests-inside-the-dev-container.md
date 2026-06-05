---
schema_version: 1
id: practice-do-not-run-e2e-tests-inside-the-dev-container
title: Do not run e2e tests inside the dev container
kind: practice
tags:
  - task-manager
  - testing
  - devcontainer
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  E2E tests require a host machine with display; check for dev container before
  running them.
---
E2E tests use Playwright with Cucumber and cannot run in the dev container. Always check whether you are inside the dev container before attempting `npm run test:e2e:electron` or related commands. Unit tests work in both the container and the host.

**Why:** E2E tests need a display server (xvfb) and Electron packaging that are not available inside the dev container environment.
