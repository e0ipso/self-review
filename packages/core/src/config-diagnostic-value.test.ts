import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { loadConfigWithProvenance } from './config';

it.each([
  ['max-files', 'maxFiles', 17],
  ['max-total-lines', 'maxTotalLines', 29],
  ['theme', 'theme', 'dark'],
  ['diff-view', 'diffView', 'split'],
] as const)(
  'keeps valid project settings when %s is an uncoercible YAML mapping',
  (key, property, inherited) => {
    const root = mkdtempSync(join(tmpdir(), 'sr-config-diagnostic-'));
    try {
      const home = join(root, 'home');
      const project = join(root, 'project');
      mkdirSync(join(home, '.config', 'self-review'), { recursive: true });
      mkdirSync(project);
      writeFileSync(
        join(home, '.config', 'self-review', 'config.yaml'),
        'max-files: 17\nmax-total-lines: 29\ntheme: dark\ndiff-view: split\nword-wrap: true\noutput-file: user.xml\n'
      );
      writeFileSync(
        join(project, '.self-review.yaml'),
        `${key}:\n  toString: invalid\n  valueOf: invalid\nword-wrap: false\noutput-file: selected.xml\n`
      );
      const report = vi.fn();
      const loaded = loadConfigWithProvenance({
        cwd: project,
        homeDir: home,
        reportDiagnostic: report,
      });
      expect(loaded.config[property]).toBe(inherited);
      expect(loaded.provenance[property]).toBe('user');
      expect(loaded.config.wordWrap).toBe(false);
      expect(loaded.config.outputFile).toBe('selected.xml');
      expect(loaded.provenance.wordWrap).toBe('project');
      expect(loaded.provenance.outputFile).toBe('project');
      expect(loaded.sources.map(source => source.origin)).toEqual(['user', 'project']);
      expect(report).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith(expect.stringContaining(`Invalid ${key} value`));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
);
