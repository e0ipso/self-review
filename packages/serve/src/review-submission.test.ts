import { describe, expect, it, vi } from 'vitest';
import { createReviewSession, ReviewPublishError, type ReviewState } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';
import { createReviewOperations } from './review-operations';
import { REQUEST_SHUTDOWN } from './request-admission';
import { ReviewSubmission } from './review-submission';

const state: ReviewState = {
  timestamp: '2026-01-01T00:00:00Z',
  source: { type: 'git', repository: '/review', gitDiffArgs: '' },
  files: [],
};

function setup(reportDiagnostic?: (message: string) => void) {
  const operations = {
    submitReviewState: vi.fn(),
    publishReview: vi.fn().mockResolvedValue({ outputPath: '/review.xml' }),
  };
  return { operations, submission: new ReviewSubmission(operations, reportDiagnostic) };
}

describe('submission diagnostics', () => {
  it('reports successful publication through the supplied instance callback', async () => {
    const report = vi.fn();
    const { submission } = setup(report);
    expect(submission.begin()).toBe(true);
    expect(await submission.publish(state)).toEqual({ ok: true, outputPath: '/review.xml' });
    expect(report.mock.calls).toEqual([['[serve] Review written to /review.xml']]);
    submission.release();
    expect(submission.completed).toBe(true);
    expect(submission.begin()).toBe(false);
  });

  it('reports a known refusal and its details, preserving a repaired retry', async () => {
    const report = vi.fn();
    const { operations, submission } = setup(report);
    operations.publishReview.mockRejectedValueOnce(
      new ReviewPublishError('permission-denied', '/review.xml', 'denied', { details: ['detail'] })
    );
    submission.begin();
    expect(await submission.publish(state)).toEqual({
      ok: false,
      code: 'permission-denied',
      message: 'denied',
      details: ['detail'],
    });
    expect(report.mock.calls.flat()).toEqual([
      '[serve] Review not saved (permission-denied): denied',
      '[serve]   detail',
      '[serve] The review is still open in the browser. Fix the problem and press Finish Review again.',
    ]);
    submission.release();
    expect(submission.begin()).toBe(true);
    expect(await submission.publish(state)).toEqual({ ok: true, outputPath: '/review.xml' });
  });

  it('keeps callback failures from reopening a committed publication', async () => {
    const { submission, operations } = setup(() => {
      throw new Error('reporter failed');
    });
    submission.begin();
    expect(await submission.publish(state)).toEqual({ ok: true, outputPath: '/review.xml' });
    submission.release();
    expect(submission.completed).toBe(true);
    expect(submission.begin()).toBe(false);
    expect(operations.publishReview).toHaveBeenCalledOnce();
  });

  it('keeps the underlying refusal when its callback throws', async () => {
    const { submission, operations } = setup(() => {
      throw new Error('reporter failed');
    });
    operations.publishReview.mockRejectedValueOnce(
      new ReviewPublishError('no-space', '/review.xml', 'disk full', { details: ['out of space'] })
    );
    submission.begin();
    expect(await submission.publish(state)).toEqual({
      ok: false,
      code: 'no-space',
      message: 'disk full',
      details: ['out of space'],
    });
    submission.release();
    expect(submission.begin()).toBe(true);
  });

  it('contains an asynchronous callback rejection without losing the publication result', async () => {
    const { submission } = setup(async () => {
      throw new Error('async reporter failed');
    });
    submission.begin();
    expect(await submission.publish(state)).toEqual({ ok: true, outputPath: '/review.xml' });
    submission.release();
    expect(submission.begin()).toBe(false);
  });

  it('wires the server reporter without changing refusal, retry or completion responses', async () => {
    const report = vi.fn(() => {
      throw new Error('reporter failed');
    });
    const session = createReviewSession();
    session.diffData = { source: state.source, files: [] };
    const operations = createReviewOperations(session, {
      path: '/review.xml',
      origin: 'explicit',
    });
    vi.spyOn(operations, 'publishReview')
      .mockRejectedValueOnce(new ReviewPublishError('validation-failed', '/review.xml', 'invalid'))
      .mockResolvedValue({ outputPath: '/review.xml' });
    const server = createReviewServer({ capability: 'key', operations, reportDiagnostic: report });
    const { url } = await listenLoopback(server);
    const submit = () =>
      fetch(url + 'api/review', {
        method: 'POST',
        headers: { authorization: 'Bearer key', 'content-type': 'application/json' },
        body: JSON.stringify(state),
      });
    try {
      const refused = await submit();
      expect(refused.status).toBe(422);
      expect(await refused.json()).toEqual({
        ok: false,
        code: 'validation-failed',
        message: 'invalid',
        details: [],
      });
      expect(await (await submit()).json()).toEqual({ ok: true, outputPath: '/review.xml' });
      expect((await submit()).status).toBe(503);
      expect(report).toHaveBeenCalledWith('[serve] Review not saved (validation-failed): invalid');
      expect(report).toHaveBeenCalledWith('[serve] Review written to /review.xml');
    } finally {
      const drained = server[REQUEST_SHUTDOWN]();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await drained;
    }
  });

  it('retains stderr as the default and isolates reporters between instances', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const report = vi.fn();
      const first = setup(report);
      const second = setup();
      first.submission.begin();
      second.submission.begin();
      await first.submission.publish(state);
      expect(stderr).not.toHaveBeenCalled();
      await second.submission.publish(state);
      expect(stderr).toHaveBeenCalledExactlyOnceWith('[serve] Review written to /review.xml');
      expect(report.mock.calls).toEqual([['[serve] Review written to /review.xml']]);
    } finally {
      stderr.mockRestore();
    }
  });
});

it('keeps legacy handoff ordering when a custom operation set carries extension properties', async () => {
  const order: string[] = [];
  const legacy = {
    submitReviewState: vi.fn(() => {
      order.push('submit');
    }),
    publishReview: vi.fn(async () => {
      order.push('publish');
      return { outputPath: '/review.xml' };
    }),
    publication: {
      publishReview: vi.fn(async () => {
        throw new Error('unrelated extension');
      }),
    },
  };
  const submission = new ReviewSubmission(legacy, vi.fn());
  submission.begin();
  await expect(submission.publish(state)).resolves.toEqual({ ok: true, outputPath: '/review.xml' });
  expect(order).toEqual(['submit', 'publish']);
  expect(legacy.publication.publishReview).not.toHaveBeenCalled();
});
