import { describe, it, expect } from 'vitest';
import type { AppConfig } from './types';
import { applyStagedUntrackedDefault } from './staged-untracked';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    theme: 'system',
    diffView: 'split',
    fontSize: 14,
    outputFormat: 'xml',
    outputFile: './review.xml',
    ignore: [],
    categories: [],
    defaultDiffArgs: '',
    showUntracked: true,
    showUntrackedExplicit: false,
    wordWrap: true,
    maxFiles: 500,
    maxTotalLines: 100000,
    ...overrides,
  };
}

describe('applyStagedUntrackedDefault', () => {
  it('returns config unchanged when gitDiffArgs contains neither --staged nor --cached', () => {
    const config = makeConfig({ showUntracked: true, showUntrackedExplicit: false });
    const result = applyStagedUntrackedDefault(config, []);
    expect(result.showUntracked).toBe(true);
    expect(result).toBe(config);
  });

  it('returns config unchanged for a revision range like main..feature', () => {
    const config = makeConfig({ showUntracked: true });
    const result = applyStagedUntrackedDefault(config, ['main..feature']);
    expect(result.showUntracked).toBe(true);
    expect(result).toBe(config);
  });

  it('sets showUntracked to false when --staged is present and user has not explicitly opted in', () => {
    const config = makeConfig({ showUntracked: true, showUntrackedExplicit: false });
    const result = applyStagedUntrackedDefault(config, ['--staged']);
    expect(result.showUntracked).toBe(false);
    // Other fields should be preserved
    expect(result.diffView).toBe(config.diffView);
    expect(result.outputFile).toBe(config.outputFile);
  });

  it('sets showUntracked to false when --cached is present (alias for --staged)', () => {
    const config = makeConfig({ showUntracked: true, showUntrackedExplicit: false });
    const result = applyStagedUntrackedDefault(config, ['--cached']);
    expect(result.showUntracked).toBe(false);
  });

  it('respects explicit user opt-in (showUntracked: true, showUntrackedExplicit: true) in staged mode', () => {
    const config = makeConfig({ showUntracked: true, showUntrackedExplicit: true });
    const result = applyStagedUntrackedDefault(config, ['--staged']);
    expect(result.showUntracked).toBe(true);
    expect(result).toBe(config);
  });

  it('leaves showUntracked: false unchanged when user opted out in staged mode', () => {
    const config = makeConfig({ showUntracked: false, showUntrackedExplicit: true });
    const result = applyStagedUntrackedDefault(config, ['--staged']);
    expect(result.showUntracked).toBe(false);
  });

  it('detects staged mode alongside other flags (e.g. --staged combined with -w)', () => {
    const config = makeConfig({ showUntracked: true, showUntrackedExplicit: false });
    const result = applyStagedUntrackedDefault(config, ['--staged', '-w']);
    expect(result.showUntracked).toBe(false);
  });

  it('detects staged mode when --cached is not the first arg', () => {
    const config = makeConfig({ showUntracked: true, showUntrackedExplicit: false });
    const result = applyStagedUntrackedDefault(config, ['-w', '--cached']);
    expect(result.showUntracked).toBe(false);
  });
});
