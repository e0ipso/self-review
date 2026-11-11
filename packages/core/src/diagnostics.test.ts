import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  loadConfig,
  loadConfigWithProvenance,
  createReviewSession,
  submitReviewState,
  type DiagnosticReporter,
  type ReviewState,
} from './index';
import { getRepoRootAsync, getUntrackedFilesAsync, runGitDiffAsync } from './git';
import { getGitDiffStats } from './payload-sizing';
import { ReviewXmlError } from './xml-errors';

let root: string;
let stderr: ReturnType<typeof vi.spyOn>;
let messages: [string, string?][];
let reportDiagnostic: DiagnosticReporter;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'self-review-diagnostics-'));
  stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
  messages = [];
  reportDiagnostic = (message, detail) => {
    messages.push([message, detail]);
  };
});
afterEach(() => {
  stderr.mockRestore();
  rmSync(root, { recursive: true, force: true });
});

function review(): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    source: { type: 'git', repository: '/repo', gitDiffArgs: '--staged' },
    files: [
      {
        path: 'a.txt',
        changeType: 'added',
        viewed: false,
        comments: [
          {
            id: 'c',
            filePath: 'a.txt',
            body: 'private reviewed text',
            category: '',
            lineRange: null,
            suggestion: null,
          },
        ],
      },
    ],
  };
}

const options = () => ({ cwd: root, homeDir: root, reportDiagnostic });

describe('per-call configuration diagnostics', () => {
  it('collects parse and invalid-value warnings without writing to stderr', () => {
    writeFileSync(
      join(root, '.self-review.yaml'),
      'theme: impossible\ndiff-view: invalid\ncategories: []\n'
    );
    expect(loadConfig(options()).theme).toBe('system');
    expect(messages.map(([message]) => message)).toEqual([
      'Warning: Invalid theme value "impossible", using default',
      'Warning: Invalid diff-view value "invalid", using default',
      'Warning: Category configuration has no usable categories, using default categories',
    ]);
    expect(stderr).not.toHaveBeenCalled();
    messages.length = 0;
    writeFileSync(join(root, '.self-review.yaml'), 'theme: [');
    expect(loadConfig(options()).theme).toBe('system');
    expect(messages[0][0]).toContain('Warning: Failed to load project config');
    expect(stderr).not.toHaveBeenCalled();
  });

  it('warns about unsupported output-format while preserving its value and provenance', () => {
    writeFileSync(join(root, '.self-review.yaml'), 'output-format: json\n');
    const loaded = loadConfigWithProvenance(options());
    expect(loaded.config.outputFormat).toBe('json');
    expect(loaded.provenance.outputFormat).toBe('project');
    expect(loaded.sources).toEqual([{ origin: 'project', path: join(root, '.self-review.yaml') }]);
    expect(messages).toEqual([
      [
        'Warning: output-format is deprecated; only XML output is supported. The configured value is retained for compatibility.',
        undefined,
      ],
    ]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it('keeps the XML default quiet and existing stderr warning calls intact', () => {
    writeFileSync(join(root, '.self-review.yaml'), 'output-format: xml\ntheme: invalid\n');
    expect(loadConfig({ cwd: root, homeDir: root }).outputFormat).toBe('xml');
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      'Warning: Invalid theme value "invalid", using default'
    );
  });
});

describe('submitted-state diagnostics', () => {
  it('stores validated state and reports only its existing metadata summary', () => {
    const session = createReviewSession();
    const state = review();
    submitReviewState(session, state, reportDiagnostic);
    expect(session.reviewState).toBe(state);
    expect(messages).toEqual([
      [
        '[review] Review state submitted:',
        JSON.stringify({
          timestamp: state.timestamp,
          source: state.source,
          fileCount: 1,
        }),
      ],
    ]);
    expect(JSON.stringify(messages)).not.toContain('private reviewed text');
    expect(stderr).not.toHaveBeenCalled();
  });

  it('preserves default stderr arguments and rejects invalid state before reporting', () => {
    const session = createReviewSession();
    const state = review();
    submitReviewState(session, state);
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      '[review] Review state submitted:',
      JSON.stringify({
        timestamp: state.timestamp,
        source: state.source,
        fileCount: 1,
      })
    );
    expect(() =>
      submitReviewState(
        session,
        { ...state, files: null } as unknown as ReviewState,
        reportDiagnostic
      )
    ).toThrow(ReviewXmlError);
    expect(session.reviewState).toBe(state);
    expect(messages).toEqual([]);
  });
});

describe('git compatibility diagnostics', () => {
  it('routes helper warnings and errors to the supplied reporter', async () => {
    const execution = {
      reportDiagnostic,
      runner: async () => ({ stdout: '', stderr: 'unavailable', exitCode: 128 }),
    };
    await expect(getRepoRootAsync(root, execution)).rejects.toThrow('unavailable');
    await expect(runGitDiffAsync([], root, undefined, execution)).rejects.toThrow('unavailable');
    await expect(getUntrackedFilesAsync(root, execution)).resolves.toEqual([]);
    await expect(getGitDiffStats([], root, execution)).resolves.toEqual({
      fileCount: 0,
      totalLines: 0,
    });
    expect(messages.map(([message]) => message)).toEqual([
      expect.stringContaining('Error getting repository root:'),
      expect.stringContaining('Error running git diff:'),
      expect.stringContaining('Warning: Failed to list untracked files:'),
      expect.stringContaining('[payload-sizing] Failed to get git diff stats:'),
    ]);
    expect(stderr).not.toHaveBeenCalled();
  });
});
