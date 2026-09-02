import { describe, it, expect, vi } from 'vitest';
import type {
  AppConfig,
  DiffFile,
  DiffHunk,
  DiffLine,
  DiffLoadPayload,
  GuideLoadPayload,
  OutputPathInfo,
  ReviewState,
} from '../shared/types';

// The only mock this module needs: `expandContext` shells out to git.
// Nothing here mocks `electron` — the extracted handlers never touch it.
vi.mock('./git', () => ({
  runGitDiffAsync: vi.fn(),
  readGitBlobAsync: vi.fn(),
}));

import { runGitDiffAsync } from './git';
import {
  createReviewSession,
  expandContext,
  getConfigLoad,
  getDiffLoad,
  getFileHunks,
  submitReviewState,
  takeReviewState,
} from './review-handlers';

// ===== Fixtures (shapes borrowed from ipc-handlers.test.ts) =====

function makeLine(type: DiffLine['type'] = 'addition'): DiffLine {
  return { type, oldLineNumber: null, newLineNumber: 1, content: '+ hello' };
}

function makeHunk(): DiffHunk {
  return {
    header: '@@ -0,0 +1,1 @@',
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: 1,
    lines: [makeLine()],
  };
}

function makeFile(path: string): DiffFile {
  return {
    oldPath: '',
    newPath: path,
    changeType: 'added',
    isBinary: false,
    hunks: [makeHunk()],
  };
}

function makeGitPayload(filePath = 'src/app.ts'): DiffLoadPayload {
  return {
    files: [makeFile(filePath)],
    source: {
      type: 'git',
      gitDiffArgs: 'main..feature',
      repository: '/repo',
    },
  };
}

function makeGuide(name: string): GuideLoadPayload {
  return {
    overview: `Overview for ${name}`,
    groups: [
      {
        name,
        rationale: 'Read these first.',
        implicit: false,
        files: [{ path: 'src/app.ts', description: 'The entry point.' }],
      },
    ],
  };
}

function makeConfig(outputFile: string): AppConfig {
  return {
    theme: 'system',
    diffView: 'split',
    fontSize: 13,
    outputFormat: 'xml',
    outputFile,
    ignore: [],
    categories: [],
    defaultDiffArgs: '',
    showUntracked: false,
    showUntrackedExplicit: false,
    wordWrap: false,
    maxFiles: 100,
    maxTotalLines: 10000,
  };
}

function makeOutputPathInfo(resolvedOutputPath: string): OutputPathInfo {
  return { resolvedOutputPath, outputPathWritable: true };
}

function makeReviewState(timestamp: string): ReviewState {
  return {
    timestamp,
    source: { type: 'directory', sourcePath: '/tmp' },
    files: [
      { path: 'src/app.ts', changeType: 'added', viewed: true, comments: [] },
    ],
  };
}

/** A three-line expanded diff for `src/app.ts`, parsed by the real parser. */
const EXPANDED_DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,3 +1,3 @@',
  ' context before',
  '-old line',
  '+new line',
  ' context after',
  '',
].join('\n');

describe('review-handlers', () => {
  describe('session isolation', () => {
    it('does not let either session observe the other’s state', () => {
      const sessionA = createReviewSession();
      const sessionB = createReviewSession();

      // State on A only.
      sessionA.diffData = makeGitPayload();
      sessionA.guideData = makeGuide('Session A group');

      const loadedFromA = getDiffLoad(sessionA);
      expect(loadedFromA?.diff.files).toHaveLength(1);
      expect(loadedFromA?.guide?.groups[0].name).toBe('Session A group');
      expect(getFileHunks(sessionA, 'src/app.ts')).toHaveLength(1);

      // A's diff is invisible from B.
      expect(getDiffLoad(sessionB)).toBeNull();
      expect(getFileHunks(sessionB, 'src/app.ts')).toBeNull();

      // Now the reverse direction: state on B only. A shared default object
      // would have passed the checks above, so this half is what catches it.
      sessionB.config = makeConfig('b-review.xml');
      sessionB.outputPathInfo = makeOutputPathInfo('/b/review.xml');
      submitReviewState(sessionB, makeReviewState('2026-01-02T00:00:00Z'));

      expect(getConfigLoad(sessionB)?.config.outputFile).toBe('b-review.xml');
      expect(takeReviewState(sessionB)?.timestamp).toBe(
        '2026-01-02T00:00:00Z'
      );

      // B's config and review state are invisible from A.
      expect(getConfigLoad(sessionA)).toBeNull();
      expect(takeReviewState(sessionA)).toBeNull();
    });

    it('writes an expanded context back to its own session only', async () => {
      vi.mocked(runGitDiffAsync).mockResolvedValue(EXPANDED_DIFF);

      const sessionA = createReviewSession();
      const sessionB = createReviewSession();
      sessionA.diffData = makeGitPayload();
      sessionB.diffData = makeGitPayload();

      const originalHunks = getFileHunks(sessionB, 'src/app.ts');
      expect(originalHunks).toEqual([makeHunk()]);

      const result = await expandContext(sessionA, {
        filePath: 'src/app.ts',
        contextLines: 10,
      });

      expect(runGitDiffAsync).toHaveBeenCalledWith(
        ['main..feature', '-U10', '--', 'src/app.ts'],
        '/repo'
      );
      expect(result?.hunks[0].header).toBe('@@ -1,3 +1,3 @@');

      // A's session state carries the expansion...
      expect(getFileHunks(sessionA, 'src/app.ts')).toEqual(result?.hunks);
      // ...and B's is untouched. This is the write path, which the
      // read-only assertions above cannot cover.
      expect(getFileHunks(sessionB, 'src/app.ts')).toEqual([makeHunk()]);
    });
  });

  describe('diff and guide delivery', () => {
    it('returns the prepared diff and the loaded guide together', () => {
      const session = createReviewSession();
      session.diffData = makeGitPayload();
      session.guideData = makeGuide('Core change');

      const result = getDiffLoad(session);

      expect(result?.diff.files[0]).toMatchObject({
        newPath: 'src/app.ts',
        hunks: [makeHunk()],
        contentLoaded: true,
      });
      expect(result?.guide).toEqual(makeGuide('Core change'));
    });

    it('returns the diff alone when no guide is loaded, in large mode too', () => {
      const session = createReviewSession();
      session.diffData = { ...makeGitPayload(), isLargePayload: true };

      const result = getDiffLoad(session);

      expect(result?.guide).toBeNull();
      // Large mode strips hunks for the initial transfer; the session keeps
      // the full data for later per-file loads.
      expect(result?.diff.files[0]).toMatchObject({
        newPath: 'src/app.ts',
        hunks: [],
        contentLoaded: false,
      });
      expect(getFileHunks(session, 'src/app.ts')).toEqual([makeHunk()]);
    });

    it('returns nothing at all for a session with no diff', () => {
      expect(getDiffLoad(createReviewSession())).toBeNull();
    });
  });

  describe('per-file hunks', () => {
    it('matches by new path, falls back to old path, and returns null otherwise', () => {
      const session = createReviewSession();
      const deleted: DiffFile = {
        oldPath: 'src/gone.ts',
        newPath: '',
        changeType: 'deleted',
        isBinary: false,
        hunks: [makeHunk()],
      };
      session.diffData = {
        files: [makeFile('src/app.ts'), deleted],
        source: { type: 'directory', sourcePath: '/tmp' },
      };

      expect(getFileHunks(session, 'src/app.ts')).toEqual([makeHunk()]);
      expect(getFileHunks(session, 'src/gone.ts')).toEqual(deleted.hunks);
      expect(getFileHunks(session, 'src/never-existed.ts')).toBeNull();
      expect(getFileHunks(createReviewSession(), 'src/app.ts')).toBeNull();
    });
  });

  describe('config load', () => {
    it('returns the config with its output path info, or nothing without a config', () => {
      const session = createReviewSession();
      expect(getConfigLoad(session)).toBeNull();

      session.config = makeConfig('review.xml');
      // No output path resolved yet: the config still travels.
      expect(getConfigLoad(session)).toEqual({
        config: session.config,
        outputPathInfo: null,
      });

      session.outputPathInfo = makeOutputPathInfo('/work/review.xml');
      expect(getConfigLoad(session)).toEqual({
        config: session.config,
        outputPathInfo: { resolvedOutputPath: '/work/review.xml', outputPathWritable: true },
      });
    });
  });

  describe('review state submission', () => {
    it('stores a submitted review and hands it out exactly once', () => {
      const session = createReviewSession();
      expect(takeReviewState(session)).toBeNull();

      const state = makeReviewState('2026-03-04T05:06:07Z');
      submitReviewState(session, state);

      expect(takeReviewState(session)).toBe(state);
      // Consumed: a second take yields nothing, so a save cannot be
      // replayed from a stale session.
      expect(takeReviewState(session)).toBeNull();
    });
  });
});
