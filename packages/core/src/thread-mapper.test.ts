// thread-mapper.test.ts
// Fixture-based tests for the deterministic forge-thread → ReviewComment
// mapper. Fixtures cover both forges' normalized shapes: GitHub-style
// numeric-string ids and GitLab-style discussion-hash ids.

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ForgeThread, ForgeThreadAnchor } from './forge-provider';
import { mapThreadsToReviewComments, REVIEW_LEVEL_FILE_PATH } from './thread-mapper';
import { serializeReview } from './xml-serializer';
import type { DiffFile, ReviewState } from './types';

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
      expect(comment.replies?.map(r => r.body)).toEqual([
        'First reply.',
        'Second reply.',
        'Third reply.',
      ]);
      expect(comment.replies?.map(r => r.author)).toEqual(['bob', 'alice', 'carol']);
      expect(comment.replies?.map(r => r.remoteId)).toEqual(['3002', '3003', '3004']);
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
      expect(first.map(c => c.body)).toEqual(['First thread.', 'Second thread.', 'Third thread.']);
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

describe('suggestion extraction from thread bodies', () => {
  /** A modified file whose new side carries `contents` starting at `start`. */
  function diffFile(path: string, start: number, contents: string[]): DiffFile {
    return {
      oldPath: path,
      newPath: path,
      changeType: 'modified',
      isBinary: false,
      hunks: [
        {
          header: `@@ -${start},${contents.length} +${start},${contents.length} @@`,
          oldStart: start,
          oldLines: contents.length,
          newStart: start,
          newLines: contents.length,
          lines: contents.map((content, index) => ({
            type: 'addition' as const,
            oldLineNumber: null,
            newLineNumber: start + index,
            content,
          })),
        },
      ],
    };
  }

  const DIFF = [diffFile('src/app.ts', 9, ['const a = 1;', 'const b = 2;', 'const c = 3;'])];

  function withBody(body: string, anchor?: Partial<ForgeThreadAnchor>): ForgeThread {
    return thread({
      root: { remoteId: '9001', author: 'octocat', body },
      anchor: {
        filePath: 'src/app.ts',
        side: 'new',
        startLine: 10,
        endLine: 10,
        outdated: false,
        ...anchor,
      },
    });
  }

  it('maps a single suggestion fence to a Suggestion anchored at the thread line range', () => {
    const [comment] = mapThreadsToReviewComments(
      [withBody('Prefer a constant.\n\n```suggestion\nconst b = 22;\n```\n')],
      DIFF
    );

    expect(comment.lineRange).toEqual({ side: 'new', start: 10, end: 10 });
    expect(comment.suggestion).toEqual({
      originalCode: 'const b = 2;',
      proposedCode: 'const b = 22;',
    });
    // The body is still passed through verbatim; the fence is not consumed.
    expect(comment.body).toContain('```suggestion');
  });

  it('takes originalCode from the diff across the whole multi-line anchor', () => {
    const [comment] = mapThreadsToReviewComments(
      [
        withBody('```suggestion\nconst [a, b] = [1, 2];\n```', {
          startLine: 9,
          endLine: 10,
        }),
      ],
      DIFF
    );

    expect(comment.suggestion?.originalCode).toBe('const a = 1;\nconst b = 2;');
  });

  it('reads the old side of the diff for an old-side anchor', () => {
    const deletion: DiffFile = {
      oldPath: 'src/old.ts',
      newPath: 'src/old.ts',
      changeType: 'modified',
      isBinary: false,
      hunks: [
        {
          header: '@@ -4,1 +4,0 @@',
          oldStart: 4,
          oldLines: 1,
          newStart: 4,
          newLines: 0,
          lines: [{ type: 'deletion', oldLineNumber: 4, newLineNumber: null, content: 'gone();' }],
        },
      ],
    };

    const [comment] = mapThreadsToReviewComments(
      [
        withBody('```suggestion\nkept();\n```', {
          filePath: 'src/old.ts',
          side: 'old',
          startLine: 4,
          endLine: 4,
        }),
      ],
      [deletion]
    );

    expect(comment.suggestion).toEqual({ originalCode: 'gone();', proposedCode: 'kept();' });
  });

  it('reads an empty fence as a deletion proposal rather than no suggestion', () => {
    const [comment] = mapThreadsToReviewComments([withBody('```suggestion\n```')], DIFF);

    expect(comment.suggestion).toEqual({ originalCode: 'const b = 2;', proposedCode: '' });
  });

  it('accepts a tilde fence and a CRLF body', () => {
    const [comment] = mapThreadsToReviewComments(
      [withBody('Try this:\r\n~~~suggestion\r\nconst b = 22;\r\n~~~\r\n')],
      DIFF
    );

    expect(comment.suggestion?.proposedCode).toBe('const b = 22;');
  });

  it('maps a thread with no fence exactly as it does without a diff', () => {
    const threads = [withBody('Plain prose, no fence.')];

    const withDiff = mapThreadsToReviewComments(threads, DIFF);
    expect(withDiff[0].suggestion).toBeNull();
    expect(withDiff).toEqual(mapThreadsToReviewComments(threads));
  });

  it('ignores a fence that is not tagged suggestion', () => {
    const [comment] = mapThreadsToReviewComments([withBody('```ts\nconst b = 22;\n```')], DIFF);

    expect(comment.suggestion).toBeNull();
  });

  it('ignores a suggestion fence nested inside another code block', () => {
    const [comment] = mapThreadsToReviewComments(
      [withBody('````md\n```suggestion\nconst b = 22;\n```\n````')],
      DIFF
    );

    expect(comment.suggestion).toBeNull();
  });

  it('refuses an ambiguous body carrying more than one suggestion fence', () => {
    const [comment] = mapThreadsToReviewComments(
      [withBody('```suggestion\nfirst;\n```\n\n```suggestion\nsecond;\n```')],
      DIFF
    );

    expect(comment.suggestion).toBeNull();
  });

  it("does not recognize GitLab's range form, whose widened anchor it cannot verify", () => {
    const [comment] = mapThreadsToReviewComments(
      [withBody('```suggestion:-0+1\nconst b = 22;\n```')],
      DIFF
    );

    expect(comment.suggestion).toBeNull();
  });

  it('keeps suggestion null when the anchor degraded to file level', () => {
    const [outdated] = mapThreadsToReviewComments(
      [withBody('```suggestion\nconst b = 22;\n```', { outdated: true })],
      DIFF
    );
    const [lineless] = mapThreadsToReviewComments(
      [withBody('```suggestion\nconst b = 22;\n```', { startLine: null, endLine: null })],
      DIFF
    );

    expect(outdated.lineRange).toBeNull();
    expect(outdated.suggestion).toBeNull();
    expect(lineless.suggestion).toBeNull();
  });

  it('keeps suggestion null when the reviewed diff does not cover the anchor', () => {
    const [missingFile] = mapThreadsToReviewComments(
      [withBody('```suggestion\nx;\n```', { filePath: 'src/absent.ts' })],
      DIFF
    );
    const [outsideHunk] = mapThreadsToReviewComments(
      [withBody('```suggestion\nx;\n```', { startLine: 99, endLine: 99 })],
      DIFF
    );
    const [partlyCovered] = mapThreadsToReviewComments(
      [withBody('```suggestion\nx;\n```', { startLine: 11, endLine: 12 })],
      DIFF
    );

    expect(missingFile.suggestion).toBeNull();
    expect(outsideHunk.suggestion).toBeNull();
    expect(partlyCovered.suggestion).toBeNull();
  });

  it('keeps suggestion null when no diff is supplied at all', () => {
    const [comment] = mapThreadsToReviewComments([withBody('```suggestion\nconst b = 22;\n```')]);

    expect(comment.suggestion).toBeNull();
  });
});

// This suite deliberately does not mock xmllint-wasm: the point is that a
// mapped comment carrying an extracted suggestion really does validate
// against self-review-v3.xsd.
describe('serializing an extracted suggestion', () => {
  let outputDir: string;

  beforeAll(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'self-review-thread-mapper-'));
  });

  afterAll(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it('produces XML that validates against self-review-v3.xsd', async () => {
    const diffFiles: DiffFile[] = [
      {
        oldPath: 'src/app.ts',
        newPath: 'src/app.ts',
        changeType: 'modified',
        isBinary: false,
        hunks: [
          {
            header: '@@ -10,1 +10,1 @@',
            oldStart: 10,
            oldLines: 1,
            newStart: 10,
            newLines: 1,
            lines: [
              {
                type: 'addition',
                oldLineNumber: null,
                newLineNumber: 10,
                content: 'const b = 2 & 3;',
              },
            ],
          },
        ],
      },
    ];
    const comments = mapThreadsToReviewComments(
      [
        thread({
          root: {
            remoteId: '9100',
            author: 'octocat',
            body: 'Parenthesize.\n\n```suggestion\nconst b = (2 & 3);\n```',
          },
        }),
      ],
      diffFiles
    );
    expect(comments[0].suggestion).not.toBeNull();

    const state: ReviewState = {
      timestamp: '2026-09-09T10:00:00.000Z',
      source: { type: 'welcome' },
      remoteUrl: 'https://github.com/owner/repo/pull/42',
      remoteBaseSha: 'aaa111',
      remoteHeadSha: 'bbb222',
      remoteForge: 'github',
      files: [{ path: 'src/app.ts', changeType: 'modified', viewed: false, comments }],
    };

    // serializeReview throws when the document fails XSD validation.
    const xml = await serializeReview(state, join(outputDir, 'review.xml'));

    expect(xml).toContain('<original-code>const b = 2 &amp; 3;</original-code>');
    expect(xml).toContain('<proposed-code>const b = (2 &amp; 3);</proposed-code>');
    // Serialization of an attachment-free review writes nothing to disk.
    expect(readdirSync(outputDir)).toEqual([]);
  });
});
