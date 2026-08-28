import { describe, it, expect } from 'vitest';
import type {
  DiffFile,
  DiffHunk,
  DiffLine,
  DiffLoadPayload,
  GuideLoadPayload,
} from '../shared/types';

import { createReviewSession, handleDiffRequest } from './review-handlers';

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

function makePayload(): DiffLoadPayload {
  return {
    files: [makeFile('src/app.ts')],
    source: { type: 'directory', sourcePath: '/tmp' },
  };
}

function makeGuide(): GuideLoadPayload {
  return {
    overview: 'Read the entry point first.',
    groups: [
      {
        name: 'Entry points',
        rationale: 'Where the change starts.',
        implicit: false,
        files: [{ path: 'src/app.ts', description: 'The entry point.' }],
      },
    ],
  };
}

describe('review-handlers', () => {
  describe('handleDiffRequest', () => {
    it('returns null when the session holds no diff', () => {
      expect(handleDiffRequest(createReviewSession())).toBeNull();
    });

    it('returns the prepared diff and the guide together', () => {
      const session = createReviewSession();
      session.diffData = makePayload();
      session.guideData = makeGuide();

      const result = handleDiffRequest(session);

      // Both halves come back from one call: the HTTP front end serves them
      // in a single response, and the IPC front end sends them as two
      // messages, from this one result.
      expect(result?.diff.files[0]).toMatchObject({
        newPath: 'src/app.ts',
        contentLoaded: true,
      });
      expect(result?.guide).toBe(session.guideData);
    });

    it('returns a null guide when no sidecar was discovered', () => {
      const session = createReviewSession();
      session.diffData = makePayload();

      expect(handleDiffRequest(session)?.guide).toBeNull();
    });

    it('reads only the session it is given', () => {
      const populated = createReviewSession();
      populated.diffData = makePayload();
      populated.guideData = makeGuide();

      // A second front end starting its own session must see nothing of the
      // first one's — the state is an argument, not a module-level cache.
      expect(handleDiffRequest(createReviewSession())).toBeNull();
      expect(handleDiffRequest(populated)).not.toBeNull();
    });
  });
});
