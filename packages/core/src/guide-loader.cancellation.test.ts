import { beforeEach, expect, it, vi } from 'vitest';
import { loadGuide } from './guide-loader';
import { readFileWithinBudget } from './bounded-read';
import { parseGuideXml } from './guide-parser';
import type { GuideParseResult } from './guide-parser';

vi.mock('./bounded-read');
vi.mock('./guide-parser', async importOriginal => ({
  ...(await importOriginal<typeof import('./guide-parser')>()),
  parseGuideXml: vi.fn(),
}));

const content = { kind: 'ok' as const, content: Buffer.from('<guide/>') };
const parsed: GuideParseResult = { ok: true, guide: { groups: [] } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readFileWithinBudget).mockResolvedValue(content);
  vi.mocked(parseGuideXml).mockResolvedValue(parsed);
});

it('refuses an already cancelled guide without opening or parsing it', async () => {
  const owner = new AbortController();
  const reason = new Error('Startup replaced');
  owner.abort(reason);
  const reportDiagnostic = vi.fn();
  await expect(
    loadGuide('/review.xml', {}, [], { signal: owner.signal, reportDiagnostic })
  ).rejects.toBe(reason);
  expect(readFileWithinBudget).not.toHaveBeenCalled();
  expect(parseGuideXml).not.toHaveBeenCalled();
  expect(reportDiagnostic).not.toHaveBeenCalled();
});

it('propagates cancellation through a pending read and waits for its descriptor cleanup', async () => {
  const owner = new AbortController();
  const reason = new Error('Startup timed out');
  let release!: () => void;
  let closed = false;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  vi.mocked(readFileWithinBudget).mockImplementation(async (_path, _limit, options) => {
    try {
      await gate;
      options?.signal?.throwIfAborted();
      return content;
    } finally {
      closed = true;
    }
  });
  const reportDiagnostic = vi.fn();
  const result = loadGuide('/review.xml', {}, [], { signal: owner.signal, reportDiagnostic });
  const failure = result.catch((error: unknown) => error);
  owner.abort(reason);
  expect(closed).toBe(false);
  release();
  expect(await failure).toBe(reason);
  expect(closed).toBe(true);
  expect(parseGuideXml).not.toHaveBeenCalled();
  expect(reportDiagnostic).not.toHaveBeenCalled();
});

it('does not parse a read that became obsolete before delivery', async () => {
  const owner = new AbortController();
  const reason = new Error('Review window closed');
  vi.mocked(readFileWithinBudget).mockImplementation(async () => {
    owner.abort(reason);
    return content;
  });
  await expect(loadGuide('/review.xml', {}, [], { signal: owner.signal })).rejects.toBe(reason);
  expect(parseGuideXml).not.toHaveBeenCalled();
});

it('does not adopt validation that completed after its startup owner was cancelled', async () => {
  const owner = new AbortController();
  const reason = new Error('Review replaced during validation');
  let complete!: (result: GuideParseResult) => void;
  vi.mocked(parseGuideXml).mockImplementation(
    () =>
      new Promise(resolve => {
        complete = resolve;
      })
  );
  const reportDiagnostic = vi.fn();
  const result = loadGuide('/review.xml', {}, [], { signal: owner.signal, reportDiagnostic });
  const failure = result.catch((error: unknown) => error);
  await vi.waitFor(() => expect(parseGuideXml).toHaveBeenCalledOnce());
  owner.abort(reason);
  complete(parsed);
  expect(await failure).toBe(reason);
  expect(reportDiagnostic).not.toHaveBeenCalled();
});

it('keeps optional-guide failure nonfatal when a diagnostic callback throws', async () => {
  vi.mocked(readFileWithinBudget).mockRejectedValue(new Error('Unreadable guide'));
  const reportDiagnostic = vi.fn(() => {
    throw new Error('Reporter unavailable');
  });
  await expect(loadGuide('/review.xml', {}, [], { reportDiagnostic })).resolves.toBeNull();
  expect(reportDiagnostic).toHaveBeenCalledOnce();
});
