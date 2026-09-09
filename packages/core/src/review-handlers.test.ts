import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as nodePath from 'path';
import type {
  AppConfig,
  DiffFile,
  DiffHunk,
  DiffLine,
  DiffLoadPayload,
  GuideLoadPayload,
  OutputPathInfo,
  ReviewState,
  SuggestionApplyRequest,
} from './types';

// The only mock this module needs: `expandContext` shells out to git.
// Nothing here mocks `electron` — the extracted handlers never touch it.
vi.mock('./git', () => ({
  runGitDiffAsync: vi.fn(),
  readGitBlobAsync: vi.fn(),
}));

import { runGitDiffAsync } from './git';
import {
  applySuggestionForSession,
  commitReviewStart,
  createReviewSession,
  expandContext,
  getConfigLoad,
  getDiffLoad,
  getFileHunks,
  getResumeLoad,
  isTemporaryCloneSession,
  prepareDirectoryReview,
  resolveApplyDestination,
  setApplyDestination,
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
    files: [{ path: 'src/app.ts', changeType: 'added', viewed: true, comments: [] }],
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
      expect(takeReviewState(sessionB)?.timestamp).toBe('2026-01-02T00:00:00Z');

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

    it('keeps a quoted search string and path as single arguments', async () => {
      vi.mocked(runGitDiffAsync).mockResolvedValue(EXPANDED_DIFF);

      const session = createReviewSession();
      session.diffData = makeGitPayload();
      session.diffData.source = {
        type: 'git',
        gitDiffArgs: `-S 'foo bar' main..feature -- 'src/my dir'`,
        repository: '/repo',
      };

      await expandContext(session, {
        filePath: 'src/my dir/app.ts',
        contextLines: 10,
      });

      // A whitespace split would have handed git ["-S", "'foo", "bar'"] and
      // an argument that is not a revision.
      expect(runGitDiffAsync).toHaveBeenCalledWith(
        ['-S', 'foo bar', 'main..feature', '-U10', '--', 'src/my dir/app.ts'],
        '/repo'
      );
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

  describe('resume load', () => {
    it('returns nothing for a session with nothing to resume', () => {
      expect(getResumeLoad(createReviewSession())).toBeNull();
    });

    it('returns comments and viewed files, adding drift only when recorded', () => {
      const session = createReviewSession();
      session.resumeViewedFiles = ['src/app.ts'];

      expect(getResumeLoad(session)).toEqual({
        comments: [],
        viewedFiles: ['src/app.ts'],
      });

      session.resumeRemoteDrift = {
        recordedHeadSha: 'aaa',
        liveHeadSha: 'bbb',
        drifted: true,
      };
      expect(getResumeLoad(session)?.remoteDrift).toEqual({
        recordedHeadSha: 'aaa',
        liveHeadSha: 'bbb',
        drifted: true,
      });
    });
  });

  describe('directory review start', () => {
    let tmpDir: string;

    afterEach(() => {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function makeTree(): string {
      tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'self-review-test-handlers-'));
      fs.writeFileSync(nodePath.join(tmpDir, 'a.ts'), 'const a = 1;\n');
      fs.writeFileSync(nodePath.join(tmpDir, 'b.ts'), 'const b = 2;\n');
      return tmpDir;
    }

    it('scans a directory and skips the threshold check without a config', async () => {
      const session = createReviewSession();
      const dir = makeTree();

      const result = await prepareDirectoryReview(session, dir);

      expect(result.payload.source).toEqual({ type: 'directory', sourcePath: dir });
      expect(result.payload.files.map(f => f.newPath).sort()).toEqual(['a.ts', 'b.ts']);
      expect(result.stats).toBeNull();
      expect(result.exceedsThresholds).toBe(false);
    });

    it('scans a single file as a file review', async () => {
      const session = createReviewSession();
      const file = nodePath.join(makeTree(), 'a.ts');

      const result = await prepareDirectoryReview(session, file);

      expect(result.payload.source).toEqual({ type: 'file', sourcePath: file });
      expect(result.payload.files).toHaveLength(1);
    });

    it('reports exceeded thresholds without touching the session', async () => {
      const session = createReviewSession();
      session.config = { ...makeConfig('review.xml'), maxFiles: 1 };
      const previous = makeGitPayload();
      session.diffData = previous;

      const result = await prepareDirectoryReview(session, makeTree());

      expect(result.exceedsThresholds).toBe(true);
      expect(result.stats).toMatchObject({ fileCount: 2, exceedsFiles: true });
      // A caller that declines the large review must find the session as it
      // was: the review already on screen stays there.
      expect(session.diffData).toBe(previous);
    });

    it('commits the payload to the session and strips hunks for large mode', async () => {
      const session = createReviewSession();
      const { payload } = await prepareDirectoryReview(session, makeTree());
      payload.isLargePayload = true;

      const outgoing = commitReviewStart(session, payload);

      expect(session.diffData).toBe(payload);
      expect(outgoing.files.every(f => f.hunks.length === 0 && f.contentLoaded === false)).toBe(
        true
      );
      // The session keeps the full hunks for later per-file loads.
      expect(getFileHunks(session, 'a.ts')?.length).toBeGreaterThan(0);
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
  // ===== The apply write boundary (SR-0048 / SR-0049 / SR-0051) =====
  //
  // The engine that rewrites the file is covered in apply-suggestion.test.ts.
  // These cover the decision above it, which directory (if any) this session
  // lets an apply write into. The engine never makes that decision for
  // itself, so nothing else guards where the app writes.

  /** A remote session whose diff was materialized into `clonePath`. */
  function makeRemoteSession(clonePath: string, temporaryClone: boolean) {
    const session = createReviewSession();
    session.diffData = {
      files: [makeFile('src/app.ts')],
      source: { type: 'git', gitDiffArgs: 'base...head', repository: clonePath },
      remote: {
        remoteUrl: 'https://github.com/owner/repo/pull/1',
        remoteBaseSha: 'aaaaaaa',
        remoteHeadSha: 'bbbbbbb',
        remoteForge: 'github',
        threadSyncAvailable: true,
        temporaryClone,
      },
    };
    return session;
  }

  function makeApplyRequest(overrides: Partial<SuggestionApplyRequest> = {}) {
    return {
      filePath: 'src/app.ts',
      lineRange: { side: 'new' as const, start: 2, end: 2 },
      suggestion: { originalCode: 'const b = 2;', proposedCode: 'const b = 20;' },
      ...overrides,
    };
  }

  const ORIGINAL_FILE = 'const a = 1;\nconst b = 2;\nconst c = 3;\n';

  describe('apply destination', () => {
    let tmpRoot: string;
    let repoDir: string;
    let elsewhereDir: string;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      tmpRoot = fs.realpathSync(fs.mkdtempSync(nodePath.join(os.tmpdir(), 'self-review-apply-')));
      repoDir = nodePath.join(tmpRoot, 'clone');
      elsewhereDir = nodePath.join(tmpRoot, 'elsewhere');
      fs.mkdirSync(repoDir);
      fs.mkdirSync(elsewhereDir);
    });

    afterEach(() => {
      errorSpy.mockRestore();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('names the reviewed root for every review the user already controls', () => {
      // Nothing loaded: nowhere to write, and no clone to ask about.
      const empty = createReviewSession();
      expect(isTemporaryCloneSession(empty)).toBe(false);
      expect(resolveApplyDestination(empty)).toBeNull();

      const git = createReviewSession();
      git.diffData = makeGitPayload();
      expect(resolveApplyDestination(git)).toBe('/repo');

      const directory = createReviewSession();
      directory.diffData = {
        files: [makeFile('a.ts')],
        source: { type: 'directory', sourcePath: '/scanned' },
      };
      expect(resolveApplyDestination(directory)).toBe('/scanned');

      // A single-file review writes next to the file, not into it.
      const file = createReviewSession();
      file.diffData = {
        files: [makeFile('a.ts')],
        source: { type: 'file', sourcePath: '/scanned/a.ts' },
      };
      expect(resolveApplyDestination(file)).toBe('/scanned');

      // A reused clone is the user's own working tree, so it needs no picker.
      const reused = makeRemoteSession(repoDir, false);
      expect(isTemporaryCloneSession(reused)).toBe(false);
      expect(resolveApplyDestination(reused)).toBe(repoDir);
    });

    it('never names the temporary clone, and holds out until one is picked', () => {
      const session = makeRemoteSession(repoDir, true);

      expect(isTemporaryCloneSession(session)).toBe(true);
      expect(resolveApplyDestination(session)).toBeNull();

      expect(setApplyDestination(session, elsewhereDir)).toEqual({
        status: 'chosen',
        destinationRoot: elsewhereDir,
      });
      expect(resolveApplyDestination(session)).toBe(elsewhereDir);
    });

    it('rejects a relative path without consulting the cwd', () => {
      const session = makeRemoteSession(repoDir, true);

      expect(setApplyDestination(session, 'elsewhere')).toMatchObject({
        status: 'rejected',
        reason: 'destination-not-absolute',
      });
      expect(resolveApplyDestination(session)).toBeNull();
    });

    it('rejects a path that is not an existing directory', () => {
      const session = makeRemoteSession(repoDir, true);
      const filePath = nodePath.join(elsewhereDir, 'a-file.txt');
      fs.writeFileSync(filePath, 'not a directory\n');

      expect(setApplyDestination(session, filePath)).toMatchObject({
        status: 'rejected',
        reason: 'destination-not-a-directory',
      });
      expect(setApplyDestination(session, nodePath.join(tmpRoot, 'no-such-dir'))).toMatchObject({
        status: 'rejected',
        reason: 'destination-not-a-directory',
      });
      expect(resolveApplyDestination(session)).toBeNull();
    });

    it('rejects the temporary clone itself and anything inside it', () => {
      const session = makeRemoteSession(repoDir, true);
      const nested = nodePath.join(repoDir, 'src');
      fs.mkdirSync(nested);

      // The clone is deleted when the review ends, so a write into it is lost
      // however the reviewer reached it.
      expect(setApplyDestination(session, repoDir)).toMatchObject({
        status: 'rejected',
        reason: 'destination-inside-temporary-clone',
      });
      expect(setApplyDestination(session, nested)).toMatchObject({
        status: 'rejected',
        reason: 'destination-inside-temporary-clone',
      });
      // A symlink into the clone is the same directory by another name.
      const link = nodePath.join(elsewhereDir, 'link-to-clone');
      fs.symlinkSync(nested, link, 'dir');
      expect(setApplyDestination(session, link)).toMatchObject({
        status: 'rejected',
        reason: 'destination-inside-temporary-clone',
      });

      expect(resolveApplyDestination(session)).toBeNull();
    });
  });

  describe('suggestion apply', () => {
    let tmpRoot: string;
    let repoDir: string;
    let filePath: string;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      tmpRoot = fs.realpathSync(fs.mkdtempSync(nodePath.join(os.tmpdir(), 'self-review-apply-')));
      repoDir = nodePath.join(tmpRoot, 'repo');
      fs.mkdirSync(nodePath.join(repoDir, 'src'), { recursive: true });
      filePath = nodePath.join(repoDir, 'src', 'app.ts');
      fs.writeFileSync(filePath, ORIGINAL_FILE);
    });

    afterEach(() => {
      errorSpy.mockRestore();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('writes the proposal into the reviewed working file', () => {
      const session = createReviewSession();
      session.diffData = {
        files: [makeFile('src/app.ts')],
        source: { type: 'directory', sourcePath: repoDir },
      };

      const outcome = applySuggestionForSession(session, makeApplyRequest());

      expect(outcome).toEqual({ status: 'applied', filePath: 'src/app.ts', replacedLines: 1 });
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(
        'const a = 1;\nconst b = 20;\nconst c = 3;\n'
      );
      // The absolute path the engine resolved is not on the wire. The front
      // end is told which reviewed file changed, and nothing about the disk.
      expect(outcome).not.toHaveProperty('absolutePath');
    });

    it('refuses a stale anchor and leaves the bytes untouched', () => {
      const session = createReviewSession();
      session.diffData = {
        files: [makeFile('src/app.ts')],
        source: { type: 'directory', sourcePath: repoDir },
      };

      const outcome = applySuggestionForSession(
        session,
        makeApplyRequest({
          suggestion: { originalCode: 'const b = 999;', proposedCode: 'const b = 20;' },
        })
      );

      expect(outcome).toMatchObject({ status: 'refused', reason: 'context-mismatch' });
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(ORIGINAL_FILE);
    });

    it('refuses when the review has no directory of its own to write into', () => {
      // A session with no diff loaded has no source root, so there is no
      // destination to derive and none to ask for either.
      const outcome = applySuggestionForSession(createReviewSession(), makeApplyRequest());

      expect(outcome).toMatchObject({ status: 'refused', reason: 'no-destination' });
      expect((outcome as { detail: string }).detail).toBe(
        'This review has no working directory to write into.'
      );
    });

    it('refuses a temporary-clone review until the reviewer names a destination', () => {
      const session = makeRemoteSession(repoDir, true);

      const refused = applySuggestionForSession(session, makeApplyRequest());

      expect(refused).toMatchObject({ status: 'refused', reason: 'destination-required' });
      // Refused rather than written into the clone, which is deleted when the
      // review ends.
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(ORIGINAL_FILE);

      // Once a destination exists the same request writes there instead, and
      // the clone copy stays as it was.
      const destination = nodePath.join(tmpRoot, 'chosen');
      fs.mkdirSync(nodePath.join(destination, 'src'), { recursive: true });
      fs.writeFileSync(nodePath.join(destination, 'src', 'app.ts'), ORIGINAL_FILE);
      expect(setApplyDestination(session, destination)).toMatchObject({ status: 'chosen' });

      expect(applySuggestionForSession(session, makeApplyRequest())).toEqual({
        status: 'applied',
        filePath: 'src/app.ts',
        replacedLines: 1,
      });
      expect(fs.readFileSync(nodePath.join(destination, 'src', 'app.ts'), 'utf-8')).toBe(
        'const a = 1;\nconst b = 20;\nconst c = 3;\n'
      );
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(ORIGINAL_FILE);
    });

    it('refuses a file path that resolves outside the destination', () => {
      const session = createReviewSession();
      session.diffData = {
        files: [makeFile('src/app.ts')],
        source: { type: 'directory', sourcePath: repoDir },
      };

      const outcome = applySuggestionForSession(
        session,
        makeApplyRequest({ filePath: '../escaped.ts' })
      );

      expect(outcome).toMatchObject({ status: 'refused', reason: 'path-escapes-destination' });
      expect(fs.existsSync(nodePath.join(tmpRoot, 'escaped.ts'))).toBe(false);
    });
  });
});
