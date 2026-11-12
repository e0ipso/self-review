import { describe, expect, it, vi } from 'vitest';
import { getRepoRootAsync, getUntrackedFilesAsync, runGitDiffAsync, GitCommandError } from './git';
import { CommandCancelledError } from './forge-provider';
import { loadConfigWithProvenance } from './config';
import { loadLocalReview } from './startup';
import { nodeReadFsLayer } from './safe-fs-read';
import { createReviewSession, submitReviewState } from './review-session';
import type { ReviewState } from './types';

const reporters = {
  throwing: () => {
    throw new Error('reporter failure');
  },
  rejecting: () => Promise.reject(new Error('reporter failure')),
};

describe.each(Object.entries(reporters))('%s diagnostics', (_name, reporter) => {
  it('preserves original git failures and cancellation identity', async () => {
    const failure = new GitCommandError(['rev-parse'], 1, 'runner failure');
    const cancelled = new CommandCancelledError('aborted', 'git', []);
    for (const error of [failure, cancelled]) {
      const options = { runner: vi.fn().mockRejectedValue(error), reportDiagnostic: reporter };
      await expect(getRepoRootAsync('/virtual', options)).rejects.toBe(error);
      await expect(runGitDiffAsync([], '/virtual', undefined, options)).rejects.toBe(error);
    }
    await expect(
      getRepoRootAsync('/virtual', {
        runner: async () => ({ exitCode: 1, stdout: '', stderr: 'missing repo' }),
        reportDiagnostic: reporter,
      })
    ).rejects.toMatchObject({ name: 'GitCommandError', stderr: 'missing repo' });
  });

  it('keeps the compatibility untracked fallback', async () => {
    await expect(
      getUntrackedFilesAsync('/virtual', {
        runner: vi.fn().mockRejectedValue(new Error('unavailable')),
        reportDiagnostic: reporter,
      })
    ).resolves.toEqual([]);
  });

  it('keeps valid config overrides after warnings and load errors', () => {
    const result = loadConfigWithProvenance({
      cwd: '/virtual/project',
      homeDir: '/virtual/home',
      reportDiagnostic: reporter,
      effects: {
        homeDir() {
          throw new Error('unused');
        },
        cwd() {
          throw new Error('unused');
        },
        exists: () => true,
        read(file) {
          if (file.endsWith('config.yaml')) throw new Error('unreadable user config');
          return {
            kind: 'ok',
            content: Buffer.from('theme: invalid\nword-wrap: true\noutput-file: custom.xml\n'),
          };
        },
      },
    });
    expect(result.config.wordWrap).toBe(true);
    expect(result.config.outputFile).toBe('custom.xml');
    expect(result.provenance.outputFile).toBe('project');
    expect(result.sources).toEqual([
      { origin: 'project', path: '/virtual/project/.self-review.yaml' },
    ]);
  });

  it('returns a valid local source despite payload diagnostic reporter failures', async () => {
    const identity: import('./types').ReviewSourceIdentity = {
      mode: 'git',
      sourceRoot: '/virtual',
      invocationCwd: '/virtual',
      pathPrefix: '',
      gitDiffArgv: ['--stat'],
      oldSide: { kind: 'none' },
      newSide: { kind: 'working-tree' },
    };
    const loaded = await loadLocalReview(
      { mode: 'git' },
      ['--stat'],
      { ignore: [] },
      '/virtual',
      reporter,
      {},
      {
        gitSnapshot: {
          readFs: nodeReadFsLayer,
          loadDiff: async () => ({
            files: [],
            repository: '/virtual',
            identity,
            diagnostics: ['unsupported format'],
          }),
        },
      }
    );
    expect(loaded.identity).toBe(identity);
    expect(loaded.payload.diagnostics).toEqual(['unsupported format']);
    expect(loaded.payload.source).toMatchObject({ type: 'git', repository: '/virtual' });
  });

  it('stores a valid review with its existing aliases', () => {
    const session = createReviewSession();
    const state: ReviewState = {
      timestamp: 'now',
      source: { type: 'directory', sourcePath: '/virtual' },
      files: [],
    };
    submitReviewState(session, state, reporter);
    expect(session.reviewState).toBe(state);
    const stored = session.reviewState;
    submitReviewState(session, state, vi.fn());
    expect(session.reviewState).toBe(stored);
  });
});

it('preserves diagnostic callback arities', async () => {
  const report = vi.fn();
  const failure = new Error('failed');
  await expect(
    getRepoRootAsync('/virtual', {
      runner: vi.fn().mockRejectedValue(failure),
      reportDiagnostic: report,
    })
  ).rejects.toBe(failure);
  expect(report.mock.calls[0]).toEqual(['Error getting repository root: failed']);
  submitReviewState(
    createReviewSession(),
    { timestamp: 'now', source: { type: 'directory', sourcePath: '/virtual' }, files: [] },
    report
  );
  expect(report.mock.calls[1]).toHaveLength(2);
});
