import { afterEach, beforeEach, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReviewSession, commitDiffData, resolveLocalSourceIdentity } from '@self-review/core';
import { createReviewOperations } from './review-operations';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(join(tmpdir(), 'serve-bound-operations-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function bound() {
  const session = createReviewSession();
  const source = { type: 'directory' as const, sourcePath: root };
  commitDiffData(
    session,
    {
      source,
      files: [
        { oldPath: 'file', newPath: 'file', changeType: 'modified', hunks: [], isBinary: false },
      ],
    },
    resolveLocalSourceIdentity(source)
  );
  return createReviewOperations(session, { path: join(root, 'review.xml'), origin: 'explicit' });
}
const request = {
  filePath: 'file',
  lineRange: { side: 'new' as const, start: 1, end: 1 },
  suggestion: { originalCode: 'old', proposedCode: 'new' },
};

it('binds the real asynchronous writer so immediate cancellation prevents source replacement', async () => {
  fs.writeFileSync(join(root, 'file'), 'old\n');
  const operations = bound();
  const controller = new AbortController();
  const reason = new Error('request cancelled');
  const pending = operations.applySuggestionForSession(request, { signal: controller.signal });
  controller.abort(reason);
  await expect(pending).rejects.toBe(reason);
  expect(fs.readFileSync(join(root, 'file'), 'utf8')).toBe('old\n');
  expect(fs.readdirSync(root)).toEqual(['file']);
});

it('keeps a committed async source result applied after a later cancellation', async () => {
  fs.writeFileSync(join(root, 'file'), 'old\n');
  const controller = new AbortController();
  const result = await bound().applySuggestionForSession(request, { signal: controller.signal });
  controller.abort();
  expect(result).toMatchObject({ status: 'applied', filePath: 'file' });
  expect(result).not.toHaveProperty('absolutePath');
  expect(fs.readFileSync(join(root, 'file'), 'utf8')).toBe('new\n');
});

it('forwards publication cancellation and preserves the previous review document', async () => {
  const output = join(root, 'review.xml');
  fs.writeFileSync(output, 'previous review');
  const reason = new Error('request cancelled');
  await expect(
    bound().publishReview(
      { timestamp: new Date().toISOString(), source: { type: 'welcome' }, files: [] },
      { signal: AbortSignal.abort(reason) }
    )
  ).rejects.toMatchObject({ name: 'ReviewPublishError', code: 'io-error', cause: reason });
  expect(fs.readFileSync(output, 'utf8')).toBe('previous review');
  expect(fs.readdirSync(root)).toEqual(['review.xml']);
});

it('binds the real publisher budget for disk-derived resumed assets and cleans partial staging', async () => {
  const prior = join(root, 'prior', '.self-review-assets');
  const outputDir = join(root, 'output');
  fs.mkdirSync(prior, { recursive: true });
  fs.mkdirSync(outputDir);
  const output = join(outputDir, 'review.xml');
  fs.writeFileSync(output, 'previous review');
  const session = createReviewSession();
  const origins = new Map<string, string>();
  session.attachmentOrigins = origins;
  const attachments = Array.from({ length: 7 }, (_, index) => {
    const fileName = `.self-review-assets/${index}.png`;
    const origin = join(prior, `${index}.png`);
    fs.closeSync(fs.openSync(origin, 'w'));
    fs.truncateSync(origin, 10 * 1024 * 1024);
    origins.set(fileName, origin);
    return { id: `a${index}`, fileName, mediaType: 'image/png' };
  });
  const operations = createReviewOperations(session, { path: output, origin: 'explicit' });
  await expect(
    operations.publishReview({
      timestamp: '2026-01-01T00:00:00Z',
      source: { type: 'directory', sourcePath: root },
      files: [
        {
          path: 'file',
          changeType: 'added',
          viewed: false,
          comments: [
            {
              id: 'c',
              filePath: 'file',
              lineRange: null,
              suggestion: null,
              body: '',
              category: 'note',
              attachments,
            },
          ],
        },
      ],
    })
  ).rejects.toMatchObject({
    code: 'attachment-unavailable',
    message: expect.stringContaining('publication asset budget'),
  });
  expect(fs.readFileSync(output, 'utf8')).toBe('previous review');
  expect(fs.readdirSync(join(outputDir, '.self-review-assets'))).toEqual([]);
  expect(fs.readdirSync(prior)).toHaveLength(7);
});
