import { describe, it, expect } from 'vitest';
import type { DiffFile, ResolvedGuideGroup } from '@self-review/types';
import { buildGuideDisplaySections } from './guide-display';

function makeFile(path: string, oldPath?: string): DiffFile {
  return {
    oldPath: oldPath ?? path,
    newPath: path,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  };
}

// Flat/diff order: alphabetical-ish, deliberately different from guide order.
const readme = makeFile('README.md');
const login = makeFile('src/auth/login.ts');
const config = makeFile('src/config.ts');
const legacy = makeFile('src/legacy.ts');
const feature = makeFile('src/new-feature.ts');

const allFiles = [readme, login, config, legacy, feature];

const groups: ResolvedGuideGroup[] = [
  {
    name: 'Core change',
    rationale: 'The retry wrapper everything else calls',
    implicit: false,
    files: [
      { path: 'src/new-feature.ts', description: 'adds the retry wrapper' },
      { path: 'src/auth/login.ts', description: 'switches login to the wrapper' },
    ],
  },
  {
    name: 'Config',
    rationale: 'Knobs for the new behavior',
    implicit: false,
    files: [{ path: 'src/config.ts', description: 'adds retry limits' }],
  },
  {
    name: 'Everything else',
    implicit: true,
    files: [{ path: 'README.md' }, { path: 'src/legacy.ts' }],
  },
];

describe('buildGuideDisplaySections', () => {
  it('returns a single headerless section with files in input order in flat mode', () => {
    const sections = buildGuideDisplaySections(allFiles, groups, 'flat');
    expect(sections).toHaveLength(1);
    expect(sections[0].header).toBeUndefined();
    expect(sections[0].entries.map(e => e.file)).toEqual(allFiles);
    // Flat mode is today's tree: no guide annotations at all.
    expect(sections[0].entries.every(e => e.description === undefined)).toBe(true);
  });

  it('returns the identity section when no guide groups exist, regardless of mode', () => {
    const sections = buildGuideDisplaySections(allFiles, null, 'guided');
    expect(sections).toHaveLength(1);
    expect(sections[0].header).toBeUndefined();
    expect(sections[0].entries.map(e => e.file)).toEqual(allFiles);
  });

  it('orders groups and files within groups in payload order in guided mode', () => {
    const sections = buildGuideDisplaySections(allFiles, groups, 'guided');
    expect(sections.map(s => s.header?.name)).toEqual([
      'Core change',
      'Config',
      'Everything else',
    ]);
    expect(sections[0].entries.map(e => e.file)).toEqual([feature, login]);
    expect(sections[0].entries.map(e => e.description)).toEqual([
      'adds the retry wrapper',
      'switches login to the wrapper',
    ]);
    expect(sections[0].header).toEqual({
      name: 'Core change',
      rationale: 'The retry wrapper everything else calls',
      implicit: false,
      groupIndex: 0,
    });
    expect(sections[1].entries.map(e => e.file)).toEqual([config]);
  });

  it('renders the implicit group last with its payload name and no descriptions', () => {
    const sections = buildGuideDisplaySections(allFiles, groups, 'guided');
    const last = sections[sections.length - 1];
    expect(last.header).toEqual({
      name: 'Everything else',
      rationale: undefined,
      implicit: true,
      groupIndex: 2,
    });
    expect(last.entries.map(e => e.file)).toEqual([readme, legacy]);
    expect(last.entries.every(e => e.description === undefined)).toBe(true);
  });

  it('hides groups emptied by search filtering and filters within groups', () => {
    // Simulates a search that only matches login + readme.
    const filtered = [readme, login];
    const sections = buildGuideDisplaySections(filtered, groups, 'guided');
    expect(sections.map(s => s.header?.name)).toEqual([
      'Core change',
      'Everything else',
    ]);
    expect(sections[0].entries.map(e => e.file)).toEqual([login]);
    expect(sections[1].entries.map(e => e.file)).toEqual([readme]);
  });

  it('matches renamed files by new path', () => {
    const renamed = makeFile('src/renamed.ts', 'src/original.ts');
    const sections = buildGuideDisplaySections(
      [renamed],
      [
        {
          name: 'Core change',
          rationale: 'r',
          implicit: false,
          files: [{ path: 'src/renamed.ts', description: 'moved here' }],
        },
      ],
      'guided'
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].entries[0].file).toBe(renamed);
    expect(sections[0].entries[0].description).toBe('moved here');
  });

  it('keeps files the guide never mentions reachable by appending them to the implicit section', () => {
    const stray = makeFile('src/stray.ts');
    const sections = buildGuideDisplaySections([...allFiles, stray], groups, 'guided');
    const last = sections[sections.length - 1];
    expect(last.header?.implicit).toBe(true);
    expect(last.entries.map(e => e.file)).toEqual([readme, legacy, stray]);
  });

  it('synthesizes an implicit trailing group for unmentioned files when the payload has none', () => {
    const stray = makeFile('src/stray.ts');
    const explicitOnly = groups.slice(0, 2);
    const sections = buildGuideDisplaySections(
      [login, config, stray],
      explicitOnly,
      'guided'
    );
    const last = sections[sections.length - 1];
    // Labeled and implicit so the files render under a group instead of
    // visually merging into the preceding section; no groupIndex because
    // the payload has no such group.
    expect(last.header).toEqual({ name: 'Everything else', implicit: true });
    expect(last.entries.map(e => e.file)).toEqual([stray]);
  });

  it('keeps groupIndex stable when search filtering omits earlier groups', () => {
    // Search matches only the second group's file: the surviving section
    // sits at position 0 but must still identify as payload group 1, so
    // station numbering and accents stay in sync with the other surfaces.
    const sections = buildGuideDisplaySections([config], groups, 'guided');
    expect(sections).toHaveLength(1);
    expect(sections[0].header?.name).toBe('Config');
    expect(sections[0].header?.groupIndex).toBe(1);
  });

  it('returns a single empty section when no files survive filtering', () => {
    const sections = buildGuideDisplaySections([], groups, 'guided');
    expect(sections).toEqual([]);
  });
});
