// thread-mapper.test.ts
// Fixture-based tests for the deterministic forge-thread → ReviewComment
// mapper. Fixtures cover both forges' normalized shapes: GitHub-style
// numeric-string ids and GitLab-style discussion-hash ids.

import { describe, it, expect } from 'vitest';
import type { ForgeThread } from './forge-provider';
import {
  mapThreadsToReviewComments,
  REVIEW_LEVEL_FILE_PATH,
} from './thread-mapper';

/** Build a thread with sensible defaults, overridable per fixture. */
function thread(overrides: Partial<ForgeThread> = {}): ForgeThread {
  return {
    root: { remoteId: '1001', author: 'octocat', body: 'Root body.' },
    replies: [],
    anchor: {
      filePath: 'src/app.ts',
      side: 'new',
      startLine: 10,
      endLine: 10,
      outdated: false,
    },
    ...overrides,
  };
}

describe('mapThreadsToReviewComments', () => {
  describe('line anchor mapping (exactly-one-pair rule)', () => {
    it('maps a new-side single-line anchor (added or context line) to a new-side range with start = end', () => {
      // GitHub-style fixture: numeric string ids.
      const [comment] = mapThreadsToReviewComments([
        thread({
          anchor: {
            filePath: 'src/app.ts',
            side: 'new',
            startLine: 42,
            endLine: 42,
            outdated: false,
          },
        }),
      ]);
      expect(comment.filePath).toBe('src/app.ts');
      expect(comment.lineRange).toEqual({ side: 'new', start: 42, end: 42 });
    });

    it('maps an old-side anchor (deleted line) to an old-side range', () => {
      // GitLab-style fixture: discussion-hash ids.
      const [comment] = mapThreadsToReviewComments([
        thread({
          root: {
            remoteId: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
            author: 'gitlab-user',
            body: 'Why was this removed?',
          },
          anchor: {
            filePath: 'lib/old.rb',
            side: 'old',
            startLine: 7,
            endLine: 7,
            outdated: false,
          },
        }),
      ]);
      expect(comment.lineRange).toEqual({ side: 'old', start: 7, end: 7 });
    });

    it('maps a multi-line anchor to a range and normalizes reversed bounds', () => {
      const [multi, reversed] = mapThreadsToReviewComments([
        thread({
          anchor: {
            filePath: 'src/app.ts',
            side: 'new',
            startLine: 5,
            endLine: 9,
            outdated: false,
          },
        }),
        thread({
          root: { remoteId: '1002', author: 'octocat', body: 'Reversed.' },
          anchor: {
            filePath: 'src/app.ts',
            side: 'new',
            startLine: 9,
            endLine: 5,
            outdated: false,
          },
        }),
      ]);
      expect(multi.lineRange).toEqual({ side: 'new', start: 5, end: 9 });
      expect(reversed.lineRange).toEqual({ side: 'new', start: 5, end: 9 });
    });
  });

  describe('file-level degradation', () => {
    it('degrades an outdated anchor to a file-level comment keeping the file path and body verbatim', () => {
      const [comment] = mapThreadsToReviewComments([
        thread({
          root: { remoteId: '2001', author: 'octocat', body: 'Historic note.' },
          anchor: {
            filePath: 'src/moved.ts',
            side: 'new',
            startLine: 3,
            endLine: 3,
            outdated: true,
          },
        }),
      ]);
      expect(comment.filePath).toBe('src/moved.ts');
      expect(comment.lineRange).toBeNull();
      // Degradation is structural, not textual.
      expect(comment.body).toBe('Historic note.');
    });

    it('degrades a null-line anchor (file path, no line info) to a file-level comment', () => {
      const [comment] = mapThreadsToReviewComments([
        thread({
          anchor: {
            filePath: 'docs/readme.md',
            side: 'new',
            startLine: null,
            endLine: null,
            outdated: false,
          },
        }),
      ]);
      expect(comment.filePath).toBe('docs/readme.md');
      expect(comment.lineRange).toBeNull();
    });

    it('degrades non-positive line numbers to a file-level comment (XSD requires positive integers)', () => {
      const [comment] = mapThreadsToReviewComments([
        thread({
          anchor: {
            filePath: 'src/app.ts',
            side: 'new',
            startLine: 0,
            endLine: 4,
            outdated: false,
          },
        }),
      ]);
      expect(comment.lineRange).toBeNull();
    });
  });

  describe('review-level threads (no file path)', () => {
    it('maps a positionless thread to a file-level comment on the review-level sentinel path', () => {
      const [comment] = mapThreadsToReviewComments([
        thread({
          root: {
            remoteId: 'f0e1d2c3b4a5968778695a4b3c2d1e0f12345678',
            author: 'gitlab-user',
            body: 'General remark on the MR.',
          },
          anchor: null,
        }),
      ]);
      expect(comment.filePath).toBe(REVIEW_LEVEL_FILE_PATH);
      expect(comment.lineRange).toBeNull();
    });

    it('exposes the sentinel as the empty string so it can never collide with a diff path', () => {
      expect(REVIEW_LEVEL_FILE_PATH).toBe('');
    });
  });

  describe('thread structure, authors and remote ids', () => {
    it('maps root turn to the root comment and subsequent turns to flat replies in document order', () => {
      const [comment] = mapThreadsToReviewComments([
        thread({
          root: { remoteId: '3001', author: 'alice', body: 'Finding.' },
          replies: [
            { remoteId: '3002', author: 'bob', body: 'First reply.' },
            { remoteId: '3003', author: 'alice', body: 'Second reply.' },
            { remoteId: '3004', author: 'carol', body: 'Third reply.' },
          ],
        }),
      ]);
      expect(comment.body).toBe('Finding.');
      expect(comment.author).toBe('alice');
      expect(comment.remoteId).toBe('3001');
      expect(comment.replies?.map((r) => r.body)).toEqual([
        'First reply.',
        'Second reply.',
        'Third reply.',
      ]);
      expect(comment.replies?.map((r) => r.author)).toEqual([
        'bob',
        'alice',
        'carol',
      ]);
      expect(comment.replies?.map((r) => r.remoteId)).toEqual([
        '3002',
        '3003',
        '3004',
      ]);
    });

    it('omits replies entirely when the thread has none', () => {
      const [comment] = mapThreadsToReviewComments([thread()]);
      expect(comment.replies).toBeUndefined();
    });

    it('derives internal ids deterministically from forge ids', () => {
      const [comment] = mapThreadsToReviewComments([
        thread({
          root: { remoteId: '4001', author: 'alice', body: 'Root.' },
          replies: [{ remoteId: '4002', author: 'bob', body: 'Reply.' }],
        }),
      ]);
      expect(comment.id).toBe('remote-4001');
      expect(comment.replies?.[0].id).toBe('remote-4002');
    });
  });

  describe('thresholding metadata', () => {
    it('carries no category, severity or confidence (absent means below every threshold)', () => {
      const [comment] = mapThreadsToReviewComments([thread()]);
      expect(comment.category).toBe('');
      expect(comment.severity).toBeUndefined();
      expect(comment.confidence).toBeUndefined();
      expect(comment.suggestion).toBeNull();
    });
  });

  describe('determinism and ordering', () => {
    it('preserves input thread order and yields deep-equal output on repeated mapping', () => {
      const threads: ForgeThread[] = [
        thread({
          root: { remoteId: '5001', author: 'alice', body: 'First thread.' },
          replies: [{ remoteId: '5002', author: 'bob', body: 'Reply.' }],
        }),
        thread({
          root: {
            remoteId: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            author: 'gitlab-user',
            body: 'Second thread.',
          },
          anchor: null,
        }),
        thread({
          root: { remoteId: '5003', author: 'carol', body: 'Third thread.' },
          anchor: {
            filePath: 'src/x.ts',
            side: 'old',
            startLine: 1,
            endLine: 2,
            outdated: true,
          },
        }),
      ];
      const first = mapThreadsToReviewComments(threads);
      const second = mapThreadsToReviewComments(threads);
      expect(first.map((c) => c.body)).toEqual([
        'First thread.',
        'Second thread.',
        'Third thread.',
      ]);
      expect(second).toEqual(first);
      expect(mapThreadsToReviewComments([])).toEqual([]);
    });

    it('does not mutate its input', () => {
      const input = [thread()];
      const snapshot = structuredClone(input);
      mapThreadsToReviewComments(input);
      expect(input).toEqual(snapshot);
    });
  });
});
