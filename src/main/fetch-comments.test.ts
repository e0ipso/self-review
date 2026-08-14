import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  ForgeThread,
  ForgeUrl,
  ForgeProvider,
} from '../../packages/core/src/forge-provider';
import { ForgeCliUnavailableError } from '../../packages/core/src/forge-provider';
import type { MaterializeResult } from '../../packages/core/src/materializer';
import { REVIEW_LEVEL_FILE_PATH } from '../../packages/core/src/thread-mapper';
import { mapThreadsToReviewComments } from '../../packages/core/src/thread-mapper';
import { serializeReview } from '../../packages/core/src/xml-serializer';
import { parseReviewXmlString } from '../../packages/core/src/xml-parser';
import type { AppConfig, DiffFile } from '../shared/types';
import {
  buildRemoteReviewState,
  runFetchComments,
  type FetchCommentsDeps,
} from './fetch-comments';

// Mock xmllint-wasm so the round-trip test does not load WASM. The
// serializer's validation call is still asserted through the mock.
vi.mock('xmllint-wasm', () => ({
  validateXML: vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
}));

function makeDiffFile(path: string, changeType: DiffFile['changeType'] = 'modified'): DiffFile {
  return {
    oldPath: changeType === 'added' ? '/dev/null' : path,
    newPath: changeType === 'deleted' ? '/dev/null' : path,
    changeType,
    isBinary: false,
    hunks: [],
  };
}

function makeThread(
  remoteId: string,
  filePath: string | null,
  line: number | null = 1
): ForgeThread {
  return {
    root: { remoteId, author: 'octocat', body: `body ${remoteId}` },
    replies: [],
    anchor:
      filePath === null
        ? null
        : {
            filePath,
            side: 'new',
            startLine: line,
            endLine: line,
            outdated: false,
          },
  };
}

const PR_URL = 'https://github.com/owner/repo/pull/42';

describe('buildRemoteReviewState', () => {
  const baseArgs = {
    remoteUrl: PR_URL,
    forge: 'github' as const,
    baseSha: 'aaa111',
    headSha: 'bbb222',
    timestamp: '2026-08-04T10:00:00.000Z',
  };

  it('places comments on their diff files in diff order, all unviewed', () => {
    const diffFiles = [makeDiffFile('src/a.ts'), makeDiffFile('src/b.ts', 'added')];
    const comments = mapThreadsToReviewComments([
      makeThread('t2', 'src/b.ts'),
      makeThread('t1', 'src/a.ts'),
    ]);

    const state = buildRemoteReviewState({ ...baseArgs, diffFiles, comments });

    expect(state.files.map(f => f.path)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(state.files[0].changeType).toBe('modified');
    expect(state.files[1].changeType).toBe('added');
    expect(state.files.every(f => f.viewed === false)).toBe(true);
    expect(state.files[0].comments.map(c => c.remoteId)).toEqual(['t1']);
    expect(state.files[1].comments.map(c => c.remoteId)).toEqual(['t2']);
  });

  it('carries remote provenance and a source shape with no local attributes', () => {
    const state = buildRemoteReviewState({
      ...baseArgs,
      diffFiles: [],
      comments: [],
    });

    expect(state.remoteUrl).toBe(PR_URL);
    expect(state.remoteBaseSha).toBe('aaa111');
    expect(state.remoteHeadSha).toBe('bbb222');
    expect(state.remoteForge).toBe('github');
    expect(state.timestamp).toBe('2026-08-04T10:00:00.000Z');
    // The remote-* attributes ARE the source shape; the three source shapes
    // are mutually exclusive, so no git/directory source attributes.
    expect(state.source).toEqual({ type: 'welcome' });
  });

  it('adds synthetic entries for comment paths missing from the diff', () => {
    const diffFiles = [makeDiffFile('src/a.ts')];
    const comments = mapThreadsToReviewComments([
      makeThread('t1', 'src/gone.ts'),
    ]);

    const state = buildRemoteReviewState({ ...baseArgs, diffFiles, comments });

    const synthetic = state.files.find(f => f.path === 'src/gone.ts');
    expect(synthetic).toBeDefined();
    expect(synthetic!.changeType).toBe('modified');
    expect(synthetic!.viewed).toBe(false);
    expect(synthetic!.comments.map(c => c.remoteId)).toEqual(['t1']);
  });

  it('folds review-level threads into a trailing sentinel-path file entry', () => {
    const diffFiles = [makeDiffFile('src/a.ts')];
    const comments = mapThreadsToReviewComments([
      makeThread('rt-1', null),
      makeThread('t1', 'src/a.ts'),
    ]);

    const state = buildRemoteReviewState({ ...baseArgs, diffFiles, comments });

    const last = state.files[state.files.length - 1];
    expect(last.path).toBe(REVIEW_LEVEL_FILE_PATH);
    expect(last.comments.map(c => c.remoteId)).toEqual(['rt-1']);
  });

  it('emits no sentinel entry when there are no review-level threads', () => {
    const state = buildRemoteReviewState({
      ...baseArgs,
      diffFiles: [makeDiffFile('src/a.ts')],
      comments: mapThreadsToReviewComments([makeThread('t1', 'src/a.ts')]),
    });

    expect(state.files.some(f => f.path === REVIEW_LEVEL_FILE_PATH)).toBe(false);
  });
});

describe('runFetchComments', () => {
  let written: Array<{ path: string; content: string }>;
  let cleanup: ReturnType<typeof vi.fn>;
  let provider: ForgeProvider;
  let deps: FetchCommentsDeps;

  const materializeResult = (): MaterializeResult => ({
    repoPath: '/tmp/clone',
    baseSha: 'aaa111',
    headSha: 'bbb222',
    mode: 'temp-clone',
    cleanup,
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    written = [];
    cleanup = vi.fn();
    provider = {
      forge: 'github',
      fetchBaseBranch: vi.fn().mockResolvedValue('main'),
      fetchThreads: vi
        .fn()
        .mockResolvedValue([makeThread('t1', 'src/a.ts'), makeThread('rt-1', null)]),
    };
    deps = {
      runner: vi.fn(),
      createProvider: vi.fn().mockImplementation(() => provider),
      detectExistingClone: vi.fn().mockResolvedValue(null),
      materialize: vi.fn().mockResolvedValue(materializeResult()),
      resolveRemoteDefaultBranch: vi.fn().mockResolvedValue('trunk'),
      loadDiffFiles: vi.fn().mockResolvedValue([makeDiffFile('src/a.ts')]),
      serialize: vi.fn().mockResolvedValue('<xml/>'),
      writeFile: (path, content) => written.push({ path, content }),
      loadConfig: vi.fn().mockReturnValue({ outputFile: './review.xml' } as AppConfig),
      now: () => new Date('2026-08-04T10:00:00.000Z'),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the serialized review to the configured output path and cleans up', async () => {
    await runFetchComments(PR_URL, { cwd: '/work', deps });

    expect(written).toHaveLength(1);
    expect(written[0].path).toBe('/work/review.xml');
    expect(written[0].content).toBe('<xml/>\n');
    expect(cleanup).toHaveBeenCalled();

    const serialized = (deps.serialize as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(serialized.remoteUrl).toBe(PR_URL);
    expect(serialized.remoteForge).toBe('github');
    expect(serialized.remoteBaseSha).toBe('aaa111');
    expect(serialized.remoteHeadSha).toBe('bbb222');
  });

  it('materializes against the provider base branch', async () => {
    await runFetchComments(PR_URL, { cwd: '/work', deps });

    const materializeMock = deps.materialize as ReturnType<typeof vi.fn>;
    expect(materializeMock.mock.calls[0][1]).toBe('main');
    expect(materializeMock.mock.calls[0][2]).toBe('/work');
    expect(materializeMock.mock.calls[0][4]).toBeUndefined();
  });

  it('falls back to the git-only default branch with a stderr notice when the CLI is unavailable', async () => {
    provider.fetchBaseBranch = vi
      .fn()
      .mockRejectedValue(new ForgeCliUnavailableError('github', 'gh', 'gh not found'));

    await runFetchComments(PR_URL, { cwd: '/work', deps });

    expect(deps.detectExistingClone).toHaveBeenCalledWith(
      expect.anything(),
      '/work',
      deps.runner
    );
    expect(deps.resolveRemoteDefaultBranch).toHaveBeenCalledWith(
      expect.anything(),
      deps.runner,
      null
    );
    const materializeMock = deps.materialize as ReturnType<typeof vi.fn>;
    expect(materializeMock.mock.calls[0][1]).toBe('trunk');
    expect(materializeMock.mock.calls[0][4]).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('falling back')
    );
  });

  it('fails with a clear error when thread fetching is unavailable, and still cleans up', async () => {
    provider.fetchThreads = vi
      .fn()
      .mockRejectedValue(new ForgeCliUnavailableError('github', 'gh', 'gh not found'));

    await expect(runFetchComments(PR_URL, { cwd: '/work', deps })).rejects.toThrow(
      /gh/
    );
    expect(cleanup).toHaveBeenCalled();
    expect(written).toHaveLength(0);
  });

  it('cleans up the clone when serialization fails', async () => {
    deps.serialize = vi.fn().mockRejectedValue(new Error('validation failed'));

    await expect(runFetchComments(PR_URL, { cwd: '/work', deps })).rejects.toThrow(
      'validation failed'
    );
    expect(cleanup).toHaveBeenCalled();
  });

  it('rejects URLs that are not PR/MR URLs', async () => {
    await expect(
      runFetchComments('https://example.com/not-a-pr', { cwd: '/work', deps })
    ).rejects.toThrow(/not a recognized/i);
    expect(deps.materialize).not.toHaveBeenCalled();
  });

  it('forwards --all-threads as includeResolved', async () => {
    await runFetchComments(PR_URL, { cwd: '/work', deps, includeResolved: true });

    expect(provider.fetchThreads).toHaveBeenCalledWith(
      expect.objectContaining({ number: 42 }),
      { includeResolved: true }
    );
  });

  it('defaults to unresolved threads only', async () => {
    await runFetchComments(PR_URL, { cwd: '/work', deps });

    expect(provider.fetchThreads).toHaveBeenCalledWith(
      expect.objectContaining({ number: 42 }),
      { includeResolved: false }
    );
  });

  it('produces a state that round-trips through serialize and parse', async () => {
    provider.fetchThreads = vi.fn().mockResolvedValue([
      {
        root: { remoteId: 'thread-9', author: 'octocat', body: 'anchored' },
        replies: [{ remoteId: 'reply-10', author: 'hubot', body: 'reply' }],
        anchor: {
          filePath: 'src/a.ts',
          side: 'new' as const,
          startLine: 3,
          endLine: 5,
          outdated: false,
        },
      },
      makeThread('rt-1', null),
    ] satisfies ForgeThread[]);
    // Use the REAL serializer so the round-trip exercises the production
    // XML path (validation is mocked to valid at the module level).
    deps.serialize = (state, outputPath) => serializeReview(state, outputPath);

    await runFetchComments(PR_URL, { cwd: '/work', deps });

    expect(written).toHaveLength(1);
    const parsed = parseReviewXmlString(written[0].content);

    expect(parsed.remoteUrl).toBe(PR_URL);
    expect(parsed.remoteBaseSha).toBe('aaa111');
    expect(parsed.remoteHeadSha).toBe('bbb222');
    expect(parsed.remoteForge).toBe('github');

    const anchored = parsed.comments.find(c => c.remoteId === 'thread-9');
    expect(anchored).toBeDefined();
    expect(anchored!.filePath).toBe('src/a.ts');
    expect(anchored!.lineRange).toEqual({ side: 'new', start: 3, end: 5 });
    expect(anchored!.author).toBe('octocat');
    expect(anchored!.replies).toHaveLength(1);
    expect(anchored!.replies![0].remoteId).toBe('reply-10');

    const reviewLevel = parsed.comments.find(c => c.remoteId === 'rt-1');
    expect(reviewLevel).toBeDefined();
    expect(reviewLevel!.filePath).toBe(REVIEW_LEVEL_FILE_PATH);

    // No file marked viewed: nothing has been reviewed yet.
    expect(parsed.viewedFiles).toEqual([]);
  });
});
