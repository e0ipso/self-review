import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfigWithProvenance } from './config';
import { createDefaultConfig } from '../../config/src/index';
import { tokenizeGitDiffArgs } from './git-diff-args';

describe('configured git argument syntax admission', () => {
  let root: string;
  let cwd: string;
  let homeDir: string;
  let userFile: string;
  let projectFile: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-config-argv-'));
    cwd = join(root, 'project');
    homeDir = join(root, 'home');
    mkdirSync(cwd);
    mkdirSync(join(homeDir, '.config', 'self-review'), { recursive: true });
    userFile = join(homeDir, '.config', 'self-review', 'config.yaml');
    projectFile = join(cwd, '.self-review.yaml');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it.each(['-S "unfinished', "-S 'unfinished", '-S trailing\\'])(
    'keeps user arguments and provenance when a project string is malformed: %s',
    value => {
      const inherited = '-S "two words" --relative=sub/';
      writeFileSync(userFile, `default-diff-args: ${JSON.stringify(inherited)}\n`);
      writeFileSync(projectFile, `theme: dark\ndefault-diff-args: ${JSON.stringify(value)}\n`);
      const diagnostics: string[] = [];
      const loaded = loadConfigWithProvenance({
        cwd,
        homeDir,
        reportDiagnostic: m => diagnostics.push(m),
      });
      expect(loaded.config.defaultDiffArgs).toBe(inherited);
      expect(loaded.provenance.defaultDiffArgs).toBe('user');
      expect(loaded.config.theme).toBe('dark');
      expect(loaded.provenance.theme).toBe('project');
      expect(loaded.sources).toEqual([
        { origin: 'user', path: userFile },
        { origin: 'project', path: projectFile },
      ]);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toContain('Invalid default-diff-args');
      expect(diagnostics[0]).toContain('keeping the inherited value');
      expect(diagnostics[0]).not.toContain(value);
    }
  );

  it.each(['user', 'project'] as const)(
    'keeps defaults when the %s string is malformed',
    origin => {
      writeFileSync(origin === 'user' ? userFile : projectFile, "default-diff-args: '-S \"open'\n");
      const diagnostics: string[] = [];
      const loaded = loadConfigWithProvenance({
        cwd,
        homeDir,
        reportDiagnostic: m => diagnostics.push(m),
      });
      expect(loaded.config.defaultDiffArgs).toBe(createDefaultConfig().defaultDiffArgs);
      expect(loaded.provenance.defaultDiffArgs).toBe('default');
      expect(diagnostics).toHaveLength(1);
    }
  );

  it('allows a valid project layer after a malformed user layer', () => {
    writeFileSync(userFile, "default-diff-args: '-S \"open'\n");
    const value = '-S "雪 two" --src-prefix \'\' -- "a\\ b"';
    writeFileSync(projectFile, `default-diff-args: ${JSON.stringify(value)}\n`);
    const loaded = loadConfigWithProvenance({ cwd, homeDir, reportDiagnostic: () => {} });
    expect(loaded.config.defaultDiffArgs).toBe(value);
    expect(loaded.provenance.defaultDiffArgs).toBe('project');
    expect(tokenizeGitDiffArgs(value)).toEqual(['-S', '雪 two', '--src-prefix', '', '--', 'a\\ b']);
  });

  it('bounds diagnostics without echoing the configured value', () => {
    const secret = 'private-argument-'.repeat(20000);
    writeFileSync(projectFile, `default-diff-args: ${JSON.stringify(`-S "${secret}`)}\n`);
    const diagnostics: string[] = [];
    loadConfigWithProvenance({ cwd, homeDir, reportDiagnostic: m => diagnostics.push(m) });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].length).toBeLessThan(240);
    expect(diagnostics[0]).not.toContain('private-argument');
  });

  it('retains the existing treatment of a YAML array instead of reinterpreting its elements', () => {
    writeFileSync(userFile, 'default-diff-args: --staged\n');
    writeFileSync(
      projectFile,
      `default-diff-args: ${JSON.stringify(['-S', '"unterminated', '--'])}\n`
    );
    const loaded = loadConfigWithProvenance({ cwd, homeDir, reportDiagnostic: () => {} });
    expect(loaded.config.defaultDiffArgs).toBe('--staged');
    expect(loaded.provenance.defaultDiffArgs).toBe('user');
  });
});
