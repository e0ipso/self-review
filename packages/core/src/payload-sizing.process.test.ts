import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getGitDiffStats } from './payload-sizing';
import { gitSync } from './test-support/git-env';

// SR-0054: getGitDiffStats used to build one shell command string, so a
// filename carrying shell syntax was executed rather than diffed. Only a real
// child process can tell the difference — a mocked argv check passes either
// way. This is the same fixture shape as git.process.test.ts.
describe('getGitDiffStats runs git without a shell', () => {
  const marker = 'SELF_REVIEW_INJECTION_MARKER';
  let root: string;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-test-stats-'));
    gitSync(['init', '-q', root]);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    '$(touch${IFS}SELF_REVIEW_INJECTION_MARKER)',
    '`touch${IFS}SELF_REVIEW_INJECTION_MARKER`',
    'file with spaces.txt',
    'file "with quotes".txt',
    "file 'with quotes'.txt",
    'ünïcode–name.txt',
  ])('counts the literal filename without executing shell syntax: %s', async filename => {
    writeFileSync(join(root, filename), 'one\ntwo\nthree\n');
    writeFileSync(join(root, 'other.txt'), 'unselected\n');
    gitSync(['add', '--', filename, 'other.txt'], { cwd: root });

    const stats = await getGitDiffStats(['--cached', '--', filename], root);

    expect(existsSync(join(root, marker))).toBe(false);
    // The pathspec selected exactly one file, so the sibling never counted.
    expect(stats).toEqual({ fileCount: 1, totalLines: 3 });
  });

  it('sums added and removed lines across files', async () => {
    writeFileSync(join(root, 'a.txt'), 'a\nb\n');
    gitSync(['add', '--', 'a.txt'], { cwd: root });
    gitSync(['-c', 'user.email=t@e.st', '-c', 'user.name=t', 'commit', '-qm', 'seed'], {
      cwd: root,
    });
    writeFileSync(join(root, 'a.txt'), 'a\nc\n');
    writeFileSync(join(root, 'b.txt'), 'new\n');
    gitSync(['add', '--', 'a.txt', 'b.txt'], { cwd: root });

    // a.txt: 1 added + 1 removed, b.txt: 1 added.
    expect(await getGitDiffStats(['--cached'], root)).toEqual({ fileCount: 2, totalLines: 3 });
  });

  it("counts a binary file without letting numstat's dashes become NaN", async () => {
    writeFileSync(join(root, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255]));
    gitSync(['add', '--', 'blob.bin'], { cwd: root });

    expect(await getGitDiffStats(['--cached'], root)).toEqual({ fileCount: 1, totalLines: 0 });
  });

  it('reports zeros so a failing git never blocks the large-payload guard', async () => {
    const stats = await getGitDiffStats(['no-such-revision..also-missing'], root);

    expect(stats).toEqual({ fileCount: 0, totalLines: 0 });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[payload-sizing] Failed to get git diff stats')
    );
  });
});
