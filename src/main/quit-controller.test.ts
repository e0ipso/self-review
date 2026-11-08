import { describe, it, expect, vi } from 'vitest';
import { ReviewPublishError } from '../../packages/core/src/review-publisher';
import type { ReviewState } from '../shared/types';
import {
  QuitController,
  describeSaveFailure,
  saveAndQuit,
  type SaveAndQuitDeps,
} from './quit-controller';

function state(): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    source: { type: 'git', gitDiffArgs: '', repository: '/repo' },
    files: [],
  };
}

describe('QuitController', () => {
  it('starts in the reviewing phase and may not quit', () => {
    const controller = new QuitController();
    expect(controller.phase).toBe('reviewing');
    expect(controller.mayQuit).toBe(false);
  });

  it('asks the renderer when a review is open', () => {
    const controller = new QuitController();
    expect(controller.closeRequested(true)).toBe('ask-renderer');
    expect(controller.phase).toBe('reviewing');
  });

  it('allows a close with no review open without leaving the reviewing phase', () => {
    // macOS keeps the app alive after its last window closes; a later window
    // with a real review must still be asked about.
    const controller = new QuitController();
    expect(controller.closeRequested(false)).toBe('allow');
    expect(controller.phase).toBe('reviewing');
    expect(controller.closeRequested(true)).toBe('ask-renderer');
  });

  it('ignores close requests while a save is in flight', () => {
    const controller = new QuitController();
    expect(controller.beginSave()).toBe(true);
    expect(controller.closeRequested(true)).toBe('ignore');
    expect(controller.closeRequested(false)).toBe('ignore');
  });

  it('refuses a second save while one is in flight', () => {
    const controller = new QuitController();
    expect(controller.beginSave()).toBe(true);
    expect(controller.beginSave()).toBe(false);
  });

  it('returns to reviewing after a failed save', () => {
    const controller = new QuitController();
    controller.beginSave();
    controller.saveFailed();
    expect(controller.phase).toBe('reviewing');
    expect(controller.mayQuit).toBe(false);
    expect(controller.closeRequested(true)).toBe('ask-renderer');
    expect(controller.beginSave()).toBe(true);
  });

  it('allows quitting only after a successful save or an explicit discard', () => {
    const saved = new QuitController();
    saved.beginSave();
    saved.saveSucceeded();
    expect(saved.mayQuit).toBe(true);
    expect(saved.closeRequested(true)).toBe('allow');
    expect(saved.beginSave()).toBe(false);

    const discarded = new QuitController();
    discarded.discard();
    expect(discarded.mayQuit).toBe(true);
    expect(discarded.closeRequested(true)).toBe('allow');
  });
});

describe('saveAndQuit', () => {
  function deps(overrides: Partial<SaveAndQuitDeps> = {}): SaveAndQuitDeps {
    return {
      controller: new QuitController(),
      takeState: vi.fn(() => state()),
      publish: vi.fn(async () => undefined),
      reportFailure: vi.fn(async () => undefined),
      quit: vi.fn(),
      ...overrides,
    };
  }

  it('publishes the pushed state and quits on success', async () => {
    const d = deps();
    const outcome = await saveAndQuit(d);
    expect(outcome).toBe('quit');
    expect(d.publish).toHaveBeenCalledTimes(1);
    expect(d.quit).toHaveBeenCalledTimes(1);
    expect(d.reportFailure).not.toHaveBeenCalled();
    expect(d.controller.mayQuit).toBe(true);
  });

  it('keeps the review open and reports when the renderer pushed no state', async () => {
    // The old pull fallback wrote an empty review here; now nothing is written.
    const d = deps({ takeState: vi.fn(() => null) });
    const outcome = await saveAndQuit(d);
    expect(outcome).toBe('failed');
    expect(d.publish).not.toHaveBeenCalled();
    expect(d.quit).not.toHaveBeenCalled();
    expect(d.reportFailure).toHaveBeenCalledTimes(1);
    const failure = vi.mocked(d.reportFailure).mock.calls[0][0];
    expect(failure.code).toBe('no-review-state');
    expect(d.controller.phase).toBe('reviewing');
  });

  it('keeps the review open and reports a publish failure instead of exiting', async () => {
    const error = new ReviewPublishError(
      'output-is-directory',
      '/repo/review.xml',
      'Cannot write /repo/review.xml: it is a directory'
    );
    const d = deps({
      publish: vi.fn(async () => {
        throw error;
      }),
    });
    const outcome = await saveAndQuit(d);
    expect(outcome).toBe('failed');
    expect(d.quit).not.toHaveBeenCalled();
    const failure = vi.mocked(d.reportFailure).mock.calls[0][0];
    expect(failure.code).toBe('output-is-directory');
    expect(failure.message).toContain('it is a directory');
    expect(d.controller.phase).toBe('reviewing');
    // The next attempt is accepted.
    expect(d.controller.beginSave()).toBe(true);
  });

  it('does not start a second save while one is in flight', async () => {
    const controller = new QuitController();
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const d = deps({ controller, publish: vi.fn(() => gate) });
    const first = saveAndQuit(d);
    const second = await saveAndQuit(d);
    expect(second).toBe('busy');
    release();
    expect(await first).toBe('quit');
    expect(d.publish).toHaveBeenCalledTimes(1);
    expect(d.quit).toHaveBeenCalledTimes(1);
  });

  it('reports a failure thrown while reporting without quitting', async () => {
    const d = deps({
      publish: vi.fn(async () => {
        throw new Error('disk on fire');
      }),
    });
    const outcome = await saveAndQuit(d);
    expect(outcome).toBe('failed');
    const failure = vi.mocked(d.reportFailure).mock.calls[0][0];
    expect(failure.code).toBe('io-error');
    expect(failure.message).toContain('disk on fire');
  });
});

describe('describeSaveFailure', () => {
  it('carries the publisher code, message and every detail line', () => {
    const error = new ReviewPublishError(
      'validation-failed',
      '/repo/review.xml',
      'Review XML failed schema validation',
      { details: ['line 3: bad thing', 'line 9: worse thing'] }
    );
    const failure = describeSaveFailure(error, '/repo/review.xml');
    expect(failure.code).toBe('validation-failed');
    expect(failure.message).toBe('Review XML failed schema validation');
    expect(failure.detail).toContain('line 3: bad thing');
    expect(failure.detail).toContain('line 9: worse thing');
    expect(failure.detail).toContain('validation-failed');
  });

  it('points a path problem at changing the output path', () => {
    const error = new ReviewPublishError('permission-denied', '/ro/review.xml', 'EACCES');
    const failure = describeSaveFailure(error, '/ro/review.xml');
    expect(failure.detail).toMatch(/Change\.\.\./);
  });

  it('wraps an unknown error as io-error with its message', () => {
    const failure = describeSaveFailure(new Error('boom'), '/repo/review.xml');
    expect(failure.code).toBe('io-error');
    expect(failure.message).toContain('boom');
  });
});
