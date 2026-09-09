import { describe, it, expect } from 'vitest';
import { normalizeGitDiffArgs } from './git-diff-args';

describe('normalizeGitDiffArgs', () => {
  it('returns unchanged when no positional path args', () => {
    const args = ['--staged', '--ignore-space-change'];
    expect(normalizeGitDiffArgs(args, '/nonexistent')).toEqual(args);
  });

  it('returns unchanged for revision-style args', () => {
    const args = ['main..feature'];
    // 'main..feature' won't exist on the filesystem
    expect(normalizeGitDiffArgs(args, '/nonexistent')).toEqual(args);
  });

  it('inserts -- before an existing path arg', () => {
    // Use a directory that definitely exists
    const args = ['src'];
    const result = normalizeGitDiffArgs(args, process.cwd());
    expect(result).toEqual(['--', 'src']);
  });

  it('preserves flags before the path arg', () => {
    const args = ['--staged', 'src'];
    const result = normalizeGitDiffArgs(args, process.cwd());
    expect(result).toEqual(['--staged', '--', 'src']);
  });

  it('returns unchanged when -- is already present (idempotent)', () => {
    const args = ['--staged', '--', 'src'];
    expect(normalizeGitDiffArgs(args, process.cwd())).toEqual(args);
  });

  it('returns unchanged for empty array', () => {
    expect(normalizeGitDiffArgs([], process.cwd())).toEqual([]);
  });
});
