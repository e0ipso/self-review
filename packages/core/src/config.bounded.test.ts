import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadConfigWithProvenance } from './config';

// Literal limit here also lets the regression run against a version without the new export.
const CONFIG_LIMIT = 1024 * 1024;
let root: string;
let home: string;
let project: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sr-config-bounded-'));
  home = join(root, 'home');
  project = join(root, 'project');
  mkdirSync(join(home, '.config', 'self-review'), { recursive: true });
  mkdirSync(project);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});
const load = () => loadConfigWithProvenance({ cwd: project, homeDir: home });

describe('bounded configuration inputs', () => {
  it('rejects an oversized project config before parsing and retains user values', () => {
    writeFileSync(join(home, '.config', 'self-review', 'config.yaml'), 'theme: dark\n');
    writeFileSync(join(project, '.self-review.yaml'), `theme: light\n#${'x'.repeat(CONFIG_LIMIT)}`);
    const loaded = load();
    expect(loaded.config.theme).toBe('dark');
    expect(loaded.provenance.theme).toBe('user');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('byte limit'));
  });

  it('refuses a directory without attributing any configuration to it', () => {
    mkdirSync(join(project, '.self-review.yaml'));
    expect(load().sources).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not a regular file'));
  });

  it('refuses a project symlink and allows a user link to a bounded regular file', () => {
    const target = join(root, 'shared.yaml');
    writeFileSync(target, 'theme: dark\n');
    symlinkSync(target, join(home, '.config', 'self-review', 'config.yaml'));
    symlinkSync(target, join(project, '.self-review.yaml'));
    expect(load().sources.map(source => source.origin)).toEqual(['user']);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load project'));
  });

  it('opens a FIFO without waiting for a writer', () => {
    execFileSync('mkfifo', [join(project, '.self-review.yaml')]);
    expect(load().sources).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not a regular file'));
  });

  it('refuses a user symlink to a device without reading it', () => {
    symlinkSync('/dev/zero', join(home, '.config', 'self-review', 'config.yaml'));
    expect(load().sources).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not a regular file'));
  });
});
