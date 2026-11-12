import { describe, expect, it, vi } from 'vitest';
import * as core from '@self-review/core';
import type { SuggestionApplyRequest, SuggestionApplyOutcome } from '@self-review/core';
import { applyFor } from './apply-compatibility';
import { startupSourceFor } from './startup-compatibility';
import { requestContractFor } from './request-contract-compatibility';

const request: SuggestionApplyRequest = {
  filePath: 'a.txt',
  lineRange: { side: 'new', start: 0, end: -1 },
  suggestion: { originalCode: 'a', proposedCode: 'b' },
};
const refusal: SuggestionApplyOutcome = {
  status: 'refused',
  filePath: 'a.txt',
  reason: 'invalid-anchor',
  detail: 'invalid',
};

describe('optional core capabilities', () => {
  it('awaits the asynchronous writer and preserves a committed outcome after abort', async () => {
    let complete!: (outcome: SuggestionApplyOutcome) => void;
    const asynchronous = vi.fn(
      () =>
        new Promise<SuggestionApplyOutcome>(done => {
          complete = done;
        })
    );
    const synchronous = vi.fn(() => refusal);
    const signal = new AbortController();
    const session = core.createReviewSession();
    const pending = applyFor({
      applySuggestionForSession: synchronous,
      applySuggestionForSessionAsync: asynchronous,
    })(session, request, { signal: signal.signal });
    expect(asynchronous).toHaveBeenCalledWith(session, request, { signal: signal.signal });
    expect(synchronous).not.toHaveBeenCalled();
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    // The fake has crossed rename. A late abort cannot turn success into refusal.
    signal.abort(new Error('disconnected'));
    const applied: SuggestionApplyOutcome = {
      status: 'applied',
      filePath: 'a.txt',
      replacedLines: 1,
    };
    complete(applied);
    await expect(pending).resolves.toBe(applied);
  });

  it('preserves the modern writer exact precommit abort reason', async () => {
    const controller = new AbortController();
    const reason = new Error('cancel before rename');
    const pending = applyFor({
      applySuggestionForSession: () => refusal,
      applySuggestionForSessionAsync: (_session, _request, options) =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), {
            once: true,
          });
        }),
    })(core.createReviewSession(), request, { signal: controller.signal });
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
  });

  it('loads with only the previous core export surface', async () => {
    const syncApply = vi.fn(() => refusal);
    const source = { mode: 'welcome' as const };
    const syncSource = vi.fn<typeof core.resolveStartupSource>(() => source);
    await expect(
      applyFor({ applySuggestionForSession: syncApply })(core.createReviewSession(), request)
    ).resolves.toBe(refusal);
    await expect(
      startupSourceFor({ resolveStartupSource: syncSource })([], '/launch', {})
    ).resolves.toBe(source);
    expect(requestContractFor({}).decode(request)).toEqual({ ok: true, value: request });
    expect(syncApply).toHaveBeenCalledOnce();
    expect(syncSource).toHaveBeenCalledOnce();
  });

  it('selects current public source detection and structural decoding', async () => {
    const source = { mode: 'welcome' as const };
    const modern = vi.fn<typeof core.resolveStartupSourceAsync>().mockResolvedValue(source);
    const old = vi.fn(core.resolveStartupSource);
    const controller = new AbortController();
    const options = { signal: controller.signal };
    await expect(
      startupSourceFor({ resolveStartupSource: old, resolveStartupSourceAsync: modern })(
        [],
        '/launch',
        options
      )
    ).resolves.toBe(source);
    expect(modern).toHaveBeenCalledWith([], '/launch', options);
    expect(old).not.toHaveBeenCalled();
    const decode = vi.fn(core.decodeSuggestionApplyRequest);
    expect(
      requestContractFor({ decodeSuggestionApplyRequest: decode }).decode(request)
    ).toMatchObject({ ok: true });
    expect(decode).toHaveBeenCalledWith(request);
  });

  it.each([
    null,
    [],
    { ...request, lineRange: '1' },
    { ...request, lineRange: { side: 'new', start: '1', end: 2 } },
    request,
    { ...request, lineRange: null },
    { ...request, extension: 1 },
  ])('keeps the previous-core decoder aligned with the public decoder: %j', value => {
    expect(requestContractFor({}).decode(value)).toEqual(core.decodeSuggestionApplyRequest(value));
  });
});

it('does not relabel a legacy Apply committed during a signal as a refusal', async () => {
  const controller = new AbortController();
  const applied: SuggestionApplyOutcome = {
    status: 'applied',
    filePath: 'a.txt',
    replacedLines: 1,
  };
  const write = vi.fn(() => {
    controller.abort(new Error('signal observed while synchronous writer ran'));
    return applied;
  });
  await expect(
    applyFor({ applySuggestionForSession: write })(core.createReviewSession(), request, {
      signal: controller.signal,
    })
  ).resolves.toBe(applied);
  expect(write).toHaveBeenCalledOnce();
});

it('does not invoke legacy Apply after cancellation was already observed', async () => {
  const reason = new Error('cancelled before invocation');
  const write = vi.fn(() => refusal);
  await expect(
    applyFor({ applySuggestionForSession: write })(core.createReviewSession(), request, {
      signal: AbortSignal.abort(reason),
    })
  ).rejects.toBe(reason);
  expect(write).not.toHaveBeenCalled();
});

it('retains custom selector method receivers when resolving capabilities once', async () => {
  const engine = {
    source: { mode: 'welcome' as const },
    outcome: refusal,
    resolveStartupSource() {
      return this.source;
    },
    applySuggestionForSession() {
      return this.outcome;
    },
  };
  await expect(startupSourceFor(engine)([], '/launch', {})).resolves.toBe(engine.source);
  await expect(applyFor(engine)(core.createReviewSession(), request)).resolves.toBe(engine.outcome);
});

it('selects only required capabilities while preserving every original root member and alias', async () => {
  const { resolveServeEngine } = await import('./engine-contract');
  const minimal = {
    ReviewXmlError: core.ReviewXmlError,
    resolveStartupSource: () => ({ mode: 'welcome' as const }),
    applySuggestionForSession: () => refusal,
    recordResumedAttachments: core.recordResumedAttachments,
  };
  const selected = resolveServeEngine(minimal);
  expect(selected.core).toBe(minimal);
  await expect(selected.resolveSource([], '/virtual', {})).resolves.toEqual({ mode: 'welcome' });
  await expect(selected.applySuggestion(core.createReviewSession(), request)).resolves.toBe(
    refusal
  );
  const complete: import('./engine-contract').ServeEngine = resolveServeEngine(core);
  const legacyReturn: ReturnType<typeof resolveServeEngine> = complete;
  expect(complete.core).toBe(core);
  expect(legacyReturn.core.parseDiff).toBe(core.parseDiff);
  expect(complete.core.loadResumeDocument).toBe(core.loadResumeDocument);
});
