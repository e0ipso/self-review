import { describe, expect, it } from 'vitest';
import { serializeReview } from './xml-serializer';
import { parseReviewXmlString } from './xml-parser';
import type { ReviewState } from './types';

function state(path: string, changeType: ReviewState['files'][number]['changeType']): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
    files: [
      {
        path,
        changeType,
        viewed: true,
        comments: [
          {
            id: 'c',
            filePath: path,
            body: '  café 雪 😀\r\n',
            category: 'bug',
            lineRange:
              path === ''
                ? null
                : { side: changeType === 'deleted' ? 'old' : 'new', start: 1, end: 1 },
            suggestion: null,
            severity: 'minor',
            confidence: 'high',
            author: 'reviewer',
            remoteId: 'thread',
            replies: [{ id: 'r', body: '00123\r\n', author: 'peer', remoteId: 'reply' }],
          },
        ],
      },
    ],
  };
}

describe('serialized comment ownership', () => {
  it('rejects a path that would change ownership during an XML round trip', async () => {
    const review = state('a.ts', 'modified');
    review.files[0].comments[0].filePath = 'b.ts';
    await expect(serializeReview(review, '/unused/review.xml')).rejects.toMatchObject({
      name: 'ReviewXmlError',
      code: 'invalid-state',
    });
    expect(review.files[0].comments[0].filePath).toBe('b.ts');
  });

  it.each([
    ['a.ts', 'modified'],
    ['new/renamed.ts', 'renamed'],
    ['deleted.ts', 'deleted'],
    ['café/雪😀.ts', 'added'],
    ['', 'modified'],
  ] as const)(
    'round-trips valid %s ownership with metadata and flat replies',
    async (path, changeType) => {
      const review = state(path, changeType);
      const { xml, assets } = await serializeReview(review, '/unused/review.xml');
      expect(assets).toEqual([]);
      const parsed = parseReviewXmlString(xml);
      expect(parsed.comments).toHaveLength(1);
      const { id: _id, replies, ...comment } = parsed.comments[0];
      const {
        id: _originalId,
        replies: originalReplies,
        ...expected
      } = review.files[0].comments[0];
      expect(comment).toEqual(expected);
      expect(replies?.map(({ id: _id, ...reply }) => reply)).toEqual(
        originalReplies?.map(({ id: _id, ...reply }) => reply)
      );
    }
  );

  it('retains missing transient IDs and nullable normalization in pure serialization', async () => {
    const complete = state('a.ts', 'modified');
    const {
      id: _id,
      lineRange: _line,
      suggestion: _suggestion,
      ...comment
    } = complete.files[0].comments[0];
    const review = { ...complete, files: [{ ...complete.files[0], comments: [comment] }] };
    const { xml } = await serializeReview(review as ReviewState, '/unused/review.xml');
    expect(parseReviewXmlString(xml).comments[0]).toMatchObject({
      filePath: 'a.ts',
      lineRange: null,
      suggestion: null,
    });
    expect(review.files[0].comments[0]).not.toHaveProperty('id');
    expect(review.files[0].comments[0]).not.toHaveProperty('lineRange');
  });
});
