import { describe, it, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import { validateReviewState } from './review-state-validation';
import { ReviewXmlError } from './xml-errors';
import { createReviewSession, submitReviewState } from './review-handlers';
import type { ReviewState } from './types';

function review(): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
    remoteUrl: 'https://github.com/a/b/pull/1',
    remoteBaseSha: 'a',
    remoteHeadSha: 'b',
    remoteForge: 'github',
    files: [
      {
        path: '',
        changeType: 'modified',
        viewed: false,
        comments: [
          {
            id: 'c',
            filePath: '',
            body: '00123',
            category: '',
            lineRange: { side: 'old', start: 1, end: 2 },
            suggestion: { originalCode: 'a', proposedCode: '' },
            author: 'bot',
            severity: 'critical',
            confidence: 'low',
            orphaned: true,
            remoteId: 'thread',
            attachments: [
              {
                id: 'asset',
                fileName: 'image.png',
                mediaType: 'image/png',
                data: new Uint8Array([1]).buffer,
              },
            ],
            replies: [
              {
                id: 'r',
                body: 'reply',
                author: 'me',
                remoteId: 'note',
                attachments: [
                  { id: 'a', fileName: '.self-review-assets/x.png', mediaType: 'image/png' },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('validateReviewState', () => {
  it('retains supported metadata, ordering, sentinel paths, buffers and unknown extension fields', () => {
    const value = { ...review(), futureField: { retained: true } };
    const before = structuredClone(value);
    validateReviewState(value);
    expect(value).toEqual(before);
  });

  it('normalizes omitted nullable fields without dropping metadata or changing the input', () => {
    const complete = review();
    const {
      lineRange: _range,
      suggestion: _suggestion,
      ...comment
    } = complete.files[0].comments[0];
    const legacy = { ...complete, files: [{ ...complete.files[0], comments: [comment] }] };
    const validated = validateReviewState(legacy);
    expect(validated.files[0].comments[0]).toEqual({
      ...comment,
      lineRange: null,
      suggestion: null,
    });
    expect(legacy.files[0].comments[0]).not.toHaveProperty('lineRange');
    expect(validated.files[0].comments[0].attachments).toBe(comment.attachments);
    expect(validated.remoteForge).toBe('github');
  });

  it('accepts an ArrayBuffer from another realm', () => {
    const value = review();
    value.files[0].comments[0].attachments![0].data = runInNewContext(
      'new Uint8Array([1, 2]).buffer'
    ) as ArrayBuffer;
    expect(validateReviewState(value)).toBe(value);
  });

  it('rejects a detached attachment buffer with a validation error', () => {
    const value = review();
    const data = value.files[0].comments[0].attachments![0].data!;
    structuredClone(data, { transfer: [data] });
    expect(() => validateReviewState(value)).toThrow(ReviewXmlError);
  });

  it.each([
    null,
    { ...review(), timestamp: false },
    { ...review(), source: { type: 'future' } },
    { ...review(), source: { type: 'git', gitDiffArgs: [], repository: '/repo' } },
    { ...review(), files: null },
    { ...review(), files: new Array(1) },
    { ...review(), files: [{ ...review().files[0], comments: null }] },
    { ...review(), remoteForge: 'future' },
  ])('rejects malformed review structure %# with a typed error', value => {
    expect(() => validateReviewState(value)).toThrow(ReviewXmlError);
    expect(() => validateReviewState(value)).toThrow(/Invalid review state: review/);
  });

  it.each([
    { id: null },
    { body: false },
    { category: [] },
    { author: 7 },
    { severity: 'urgent' },
    { confidence: 'certain' },
    { orphaned: 'true' },
    { lineRange: { side: 'both', start: 1, end: 1 } },
    { lineRange: { side: 'new', start: '1', end: 1 } },
    { lineRange: { side: 'new', start: 1, end: Infinity } },
    { lineRange: { side: 'new', start: 3, end: 1 } },
    { lineRange: null },
    { suggestion: { originalCode: false, proposedCode: '' } },
    { attachments: [null] },
    { attachments: [{ id: 'a', fileName: 'x', mediaType: 'image/png', data: [1, 2] }] },
    { replies: [null] },
    { replies: [{ id: 'r', body: false }] },
    { replies: [{ id: 'r', body: '', attachments: 'file' }] },
  ])('rejects malformed nested values %# before replacing submitted state', patch => {
    const session = createReviewSession();
    const previous = review();
    submitReviewState(session, previous);
    const invalid: unknown = review();
    const state = invalid as ReviewState;
    Object.assign(state.files[0].comments[0], patch);
    expect(() => submitReviewState(session, state)).toThrow(ReviewXmlError);
    expect(session.reviewState).toBe(previous);
  });

  it.each([
    { type: 'git', gitDiffArgs: '', repository: '' },
    { type: 'directory', sourcePath: '/d' },
    { type: 'file', sourcePath: '/f' },
    { type: 'welcome' },
    { type: 'loading' },
  ])('accepts supported source $type', source => {
    expect(() => validateReviewState({ ...review(), source })).not.toThrow();
  });
});
