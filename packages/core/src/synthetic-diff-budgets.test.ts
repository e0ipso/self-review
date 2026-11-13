import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  generateSyntheticDiffs,
  generateSyntheticDiffsAsync,
  loadSyntheticFiles,
  loadSyntheticFilesAsync,
} from './synthetic-diff';
import { parseDiffWithDiagnostics } from './diff-parser';
import { scanDirectory, scanFile } from './directory-scanner';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { gitSync } from './test-support/git-env';
import type { SourceBudgets } from './input-budgets';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sr-representation-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

async function project(paths: string[], budgets: Partial<SourceBudgets>) {
  const options = { budgets };
  const result = loadSyntheticFiles(paths, root, options);
  expect(await loadSyntheticFilesAsync(paths, root, options)).toEqual(result);
  const textual = generateSyntheticDiffs(paths, root, options);
  expect(await generateSyntheticDiffsAsync(paths, root, options)).toEqual(textual);
  const parsed = parseDiffWithDiagnostics(textual.diff);
  for (const file of parsed.files) file.omittedReason = textual.omitted.get(file.newPath);
  expect(result.files).toEqual(parsed.files);
  expect(result.diagnostics).toEqual([...textual.diagnostics, ...parsed.diagnostics]);
  return result;
}

describe('finite synthetic representations', () => {
  it.each(['\n\n', 'a\r\n\t\ufeff', 'a\nb\n'])(
    'accepts two lines and refuses one over for %j',
    async text => {
      writeFileSync(join(root, 'edge'), text);
      writeFileSync(join(root, 'over'), text + (text.endsWith('\n') ? '\n' : '\nlast'));
      const result = await project(['edge', 'over'], { maxFileLines: 2 });
      expect(result.files[0].hunks[0].lines).toHaveLength(2);
      expect(result.files[1].hunks).toEqual([]);
      expect(result.files[1].omittedReason).toContain('2-line per-file');
    }
  );

  it('stops aggregate projection across tiny files while retaining omitted identities', async () => {
    for (const name of ['a', 'b', 'c']) writeFileSync(join(root, name), '\n\n');
    const result = await project(['a', 'b', 'c'], { maxTotalLines: 3 });
    expect(result.files.map(f => f.newPath)).toEqual(['a', 'b', 'c']);
    expect(
      result.files
        .slice(1)
        .every(f => f.hunks.length === 0 && f.omittedReason?.includes('3-line total'))
    ).toBe(true);
    expect(result.diagnostics.join(' ')).toContain('representation budget');
  });

  it('bounds metadata-only files and empty hunks independently of lines', async () => {
    for (const name of ['a', 'b', 'c']) writeFileSync(join(root, name), '');
    const exact = await project(['a', 'b'], { maxDiffFiles: 2, maxDiffHunks: 2 });
    expect(exact.files).toHaveLength(2);
    const over = await project(['a', 'b', 'c'], { maxDiffFiles: 2 });
    expect(over.files).toHaveLength(2);
    expect(over.diagnostics.join(' ')).toContain('remaining paths were not loaded');
    const hunks = await project(['a', 'b', 'c'], { maxDiffHunks: 1 });
    expect(hunks.files.slice(1).every(f => f.omittedReason?.includes('1-hunk total'))).toBe(true);
  });

  it('propagates representation limits through both scanning entry points', async () => {
    writeFileSync(join(root, 'f'), '\n'.repeat(20));
    for (const result of [
      await scanDirectory(root, [], { budgets: { maxFileLines: 2 } }),
      await scanFile(join(root, 'f'), { budgets: { maxFileLines: 2 } }),
    ]) {
      expect(result.files[0].hunks).toEqual([]);
      expect(result.files[0].omittedReason).toContain('2-line per-file');
    }
  });

  it('shares aggregate limits between real tracked git and untracked additions', async () => {
    gitSync(['init', '-q', root]);
    writeFileSync(join(root, 'tracked'), 'before\n');
    gitSync(['-C', root, 'add', 'tracked']);
    gitSync([
      '-C',
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'base',
    ]);
    writeFileSync(join(root, 'tracked'), 'after\n');
    writeFileSync(join(root, 'untracked'), 'new\n');
    const exact = await loadGitDiffWithUntracked([], root, { budgets: { maxTotalLines: 3 } });
    expect(exact.files.flatMap(f => f.hunks.flatMap(h => h.lines))).toHaveLength(3);
    const over = await loadGitDiffWithUntracked([], root, { budgets: { maxTotalLines: 2 } });
    expect(over.files.find(f => f.newPath === 'untracked')).toMatchObject({
      hunks: [],
      isUntracked: true,
      omittedReason: expect.stringContaining('0-line total'),
    });
    const files = await loadGitDiffWithUntracked([], root, { budgets: { maxDiffFiles: 1 } });
    expect(files.files.map(f => f.newPath)).toEqual(['tracked']);
    expect(files.diagnostics.join(' ')).toContain('0-file');
  });
});
