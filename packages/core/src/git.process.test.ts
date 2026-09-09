import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runGitDiff, runGitDiffAsync } from './git';

// Exercise real child processes: mocked argv checks cannot detect shell expansion.
describe.each(['sync', 'async'] as const)('literal git diff arguments (%s)', mode => {
  const originalCwd = process.cwd();
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-test-diff-literal-'));
    execFileSync('git', ['init', '-q', root]);
    // The async wrapper receives an explicit cwd; the sync wrapper inherits it.
    if (mode === 'sync') process.chdir(root);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    '$(touch${IFS}SELF_REVIEW_INJECTION_MARKER)',
    '`touch${IFS}SELF_REVIEW_INJECTION_MARKER`',
    'file with spaces.txt',
    'file "with quotes".txt',
    "file 'with quotes'.txt",
  ])('reviews the literal filename without executing shell syntax: %s', async filename => {
    writeFileSync(join(root, filename), 'selected content\n');
    writeFileSync(join(root, 'other.txt'), 'unselected content\n');
    execFileSync('git', ['add', '--', filename, 'other.txt'], { cwd: root });
    const args = ['--cached', '--', filename];

    const diff = mode === 'sync' ? runGitDiff(args) : await runGitDiffAsync(args, root);

    expect(existsSync(join(root, 'SELF_REVIEW_INJECTION_MARKER'))).toBe(false);
    expect(diff).toContain('+selected content');
    expect(diff).not.toContain('+unselected content');
  });
});
