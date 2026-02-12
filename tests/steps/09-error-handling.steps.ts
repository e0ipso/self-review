/**
 * Step definitions for Feature 09: Error Handling.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { mkdtempSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { getStdout, getStderr, getExitCode, setTestRepoDir } from './app';

const { Given, Then } = createBdd();

// ── Given: special repo setups ──

Given('I am in a directory that is not a git repository', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'self-review-no-git-'));
  setTestRepoDir(dir);
});

Given('a git repository with no commits', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'self-review-empty-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', {
    cwd: dir,
    stdio: 'pipe',
  });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  setTestRepoDir(dir);
});

Given('a git repository with no changes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'self-review-clean-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', {
    cwd: dir,
    stdio: 'pipe',
  });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  // Create a file and commit it so HEAD exists, no unstaged changes
  writeFileSync(join(dir, 'README.md'), '# Test');
  execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  setTestRepoDir(dir);
});

// ── Then: error assertions ──

Then(
  'stderr should contain an error message about not being a git repository',
  async () => {
    const stderr = getStderr();
    expect(stderr.toLowerCase()).toMatch(/not a git repository|not.*git/i);
  }
);

Then('stderr should contain an error message from git', async () => {
  const stderr = getStderr();
  expect(stderr.length).toBeGreaterThan(0);
  expect(stderr.toLowerCase()).toMatch(/fatal|error|unknown|not/i);
});

Then('stderr should contain usage information', async () => {
  const stderr = getStderr();
  expect(stderr).toContain('Usage');
});

Then('stderr should contain a version string', async () => {
  const stderr = getStderr();
  expect(stderr).toMatch(/v?\d+\.\d+\.\d+/);
});
