import { describe, expect, it } from 'vitest';
import { ReviewXmlError, validateReviewState } from '@self-review/core';
import { reviewStateValidatorFor } from './core-compatibility';

function review() {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo', extension: true },
    files: [
      {
        path: 'a',
        changeType: 'added',
        viewed: false,
        comments: [
          {
            id: 'c1',
            filePath: 'a',
            lineRange: { side: 'new', start: 1, end: 2 },
            body: 'body',
            category: 'task',
            suggestion: { originalCode: 'a', proposedCode: 'b' },
            author: 'author',
            severity: 'minor',
            confidence: 'high',
            orphaned: false,
            remoteId: 'root',
            attachments: [
              {
                id: 'a1',
                fileName: 'a.png',
                mediaType: 'image/png',
                data: new Uint8Array([1, 2]).buffer,
              },
            ],
            replies: [{ id: 'r1', body: 'reply', author: 'author', remoteId: 'reply' }],
            extension: { untouched: true },
          },
        ],
      },
    ],
  };
}

it('selects the installed core validator when present', () => {
  expect(reviewStateValidatorFor({ validateReviewState })).toBe(validateReviewState);
});

describe.each([
  ['current core', reviewStateValidatorFor({ validateReviewState })],
  ['core 2.0.4 fallback', reviewStateValidatorFor({})],
] as const)('%s review validation contract', (_name, validate) => {
  it('preserves complete DTOs, optional fields, extensions and binary asset identity', () => {
    const state = review();
    expect(validate(state)).toBe(state);
    expect(validate(state).files[0].comments[0].attachments![0].data).toBe(
      state.files[0].comments[0].attachments[0].data
    );
  });

  it('normalizes historical nullable omissions without changing other values', () => {
    const state = review();
    const comment = state.files[0].comments[0];
    const { lineRange: _range, suggestion: _suggestion, ...legacy } = comment;
    const result = validate({ ...state, files: [{ ...state.files[0], comments: [legacy] }] });
    expect(result.files[0].comments[0]).toEqual({ ...legacy, lineRange: null, suggestion: null });
  });

  it.each([
    (state: ReturnType<typeof review>) => ({ ...state, files: [null] }),
    (state: ReturnType<typeof review>) => ({ ...state, source: { type: 'unknown' } }),
    (state: ReturnType<typeof review>) => ({
      ...state,
      files: [{ ...state.files[0], comments: null }],
    }),
    (state: ReturnType<typeof review>) => ({
      ...state,
      files: [{ ...state.files[0], viewed: 'yes' }],
    }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, { lineRange: { side: 'sideways', start: 1, end: 2 } }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, { lineRange: { side: 'new', start: 2, end: 1 } }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, { lineRange: { side: 'new', start: 0, end: 2 } }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, { lineRange: { side: 'new', start: 1.5, end: 2 } }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, { lineRange: { side: 'new', start: '1', end: 2 } }),
    (state: ReturnType<typeof review>) => changeComment(state, { author: null }),
    (state: ReturnType<typeof review>) => changeComment(state, { severity: 'urgent' }),
    (state: ReturnType<typeof review>) => changeComment(state, { confidence: 'unknown' }),
    (state: ReturnType<typeof review>) => changeComment(state, { replies: [null] }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, { replies: [{ id: 'r', body: false }] }),
    (state: ReturnType<typeof review>) => changeComment(state, { attachments: [null] }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, {
        attachments: [{ id: 'a', fileName: 'a', mediaType: 'image/png', data: {} }],
      }),
    (state: ReturnType<typeof review>) =>
      changeComment(state, { suggestion: { originalCode: 'a', proposedCode: null } }),
    (state: ReturnType<typeof review>) => changeComment(state, { lineRange: null }),
  ])('rejects malformed data with a typed recoverable error %#', mutate => {
    expect(() => validate(mutate(review()))).toThrow(ReviewXmlError);
    expect(() => validate(mutate(review()))).toThrow(/Invalid review state:/);
  });
});

function changeComment(state: ReturnType<typeof review>, changes: Record<string, unknown>) {
  return {
    ...state,
    files: [{ ...state.files[0], comments: [{ ...state.files[0].comments[0], ...changes }] }],
  };
}
