import { expect, it } from 'vitest';
import type { DiffSource } from './types';
import { sameDiffSource } from './same-diff-source';

it('compares canonical fields for every source kind independently of order and extensions', () => {
  const sources: DiffSource[] = [
    { type: 'git', repository: '/repo', gitDiffArgs: '--staged' },
    { type: 'directory', sourcePath: '/dir' },
    { type: 'file', sourcePath: '/dir/a' },
    { type: 'welcome' },
    { type: 'loading' },
  ];
  for (const a of sources) {
    const reordered = Object.fromEntries([
      ...Object.entries(a).reverse(),
      ['extra', true],
    ]) as DiffSource;
    expect(sameDiffSource(a, reordered)).toBe(true);
    for (const b of sources) expect(sameDiffSource(a, b)).toBe(a.type === b.type);
  }
  expect(
    sameDiffSource(sources[0], { type: 'git', repository: '/repo/', gitDiffArgs: '--staged' })
  ).toBe(false);
  expect(
    sameDiffSource(sources[0], { type: 'git', repository: '/repo', gitDiffArgs: '--cached' })
  ).toBe(false);
  expect(sameDiffSource(sources[1], { type: 'directory', sourcePath: '/dir/' })).toBe(false);
  expect(sameDiffSource(sources[2], { type: 'file', sourcePath: '/dir/b' })).toBe(false);
});
