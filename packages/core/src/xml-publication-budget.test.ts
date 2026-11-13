import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import type { Attachment, ReviewState } from './types';
import { serializeReview } from './xml-serializer';
import { publishReview } from './review-publisher';
import { parseReviewXml } from './xml-parser';
import { MAX_RESUME_XML_BYTES } from './input-budgets';
import { validateAgainstSchema } from './review-xml-validator';
import * as xmlText from './xml-text';

// Exercise the shared byte boundary without allocating a full-size document or starting WASM.
vi.mock('./input-budgets', async importOriginal => ({
  ...(await importOriginal<typeof import('./input-budgets')>()),
  MAX_RESUME_XML_BYTES: 4096,
}));
vi.mock('./review-xml-validator', () => ({ validateAgainstSchema: vi.fn(async () => {}) }));

let root: string;
let output: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(tmpdir(), 'xml-publication-budget-'));
  output = path.join(root, 'review.xml');
  vi.mocked(validateAgainstSchema).mockClear();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function state(body: string, attachments?: Attachment[]): ReviewState {
  return {
    timestamp: '2026-11-12T00:00:00Z',
    source: { type: 'directory', sourcePath: '/review' },
    files: [
      {
        path: 'file.ts',
        changeType: 'modified',
        viewed: false,
        comments: [
          {
            id: 'comment',
            filePath: 'file.ts',
            body,
            category: 'task',
            lineRange: null,
            suggestion: null,
            attachments,
          },
        ],
      },
    ],
  };
}

it('round-trips Unicode at the shared document limit including the publication newline', async () => {
  const empty = await serializeReview(state(''), output);
  const available = MAX_RESUME_XML_BYTES - Buffer.byteLength(empty.xml + '\n', 'utf8');
  const body = 'é'.repeat(Math.floor(available / 2)) + (available % 2 ? 'x' : '');
  await publishReview(state(body), output, { outputOrigin: 'explicit' });
  expect(fs.statSync(output).size).toBe(MAX_RESUME_XML_BYTES);
  expect(parseReviewXml(output).comments[0].body).toBe(body);

  vi.mocked(validateAgainstSchema).mockClear();
  await expect(serializeReview(state(body + 'x'), output)).rejects.toMatchObject({
    name: 'ReviewXmlError',
    code: 'input-too-large',
  });
  expect(validateAgainstSchema).not.toHaveBeenCalled();
});

it('counts escaped XML bytes before calling the schema validator', async () => {
  const body = '&'.repeat(MAX_RESUME_XML_BYTES / 4);
  expect(Buffer.byteLength(body)).toBeLessThan(MAX_RESUME_XML_BYTES);
  await expect(serializeReview(state(body), output)).rejects.toMatchObject({
    name: 'ReviewXmlError',
    code: 'input-too-large',
  });
  expect(validateAgainstSchema).not.toHaveBeenCalled();
});

it('preserves the previous XML and assets when encoded output would not be resumable', async () => {
  const attachment: Attachment = {
    id: 'image',
    fileName: 'image.png',
    mediaType: 'image/png',
    data: new Uint8Array([1, 2, 3]).buffer,
  };
  await publishReview(state('previous', [attachment]), output, { outputOrigin: 'explicit' });
  const previousXml = fs.readFileSync(output);
  const assets = path.join(root, '.self-review-assets');
  const previousAssets = fs.readdirSync(assets);
  const previousBytes = fs.readFileSync(path.join(assets, previousAssets[0]));
  vi.mocked(validateAgainstSchema).mockClear();

  await expect(
    publishReview(state('&'.repeat(MAX_RESUME_XML_BYTES / 4), [attachment]), output, {
      outputOrigin: 'explicit',
    })
  ).rejects.toMatchObject({ code: 'validation-failed', cause: { code: 'input-too-large' } });
  expect(validateAgainstSchema).not.toHaveBeenCalled();
  expect(fs.readFileSync(output)).toEqual(previousXml);
  expect(fs.readdirSync(assets)).toEqual(previousAssets);
  expect(fs.readFileSync(path.join(assets, previousAssets[0]))).toEqual(previousBytes);
});

it.each(['body', 'author'] as const)(
  'refuses escaped %s before allocating its escaped duplicate',
  async field => {
    const review = state('ordinary');
    const value = '&'.repeat(MAX_RESUME_XML_BYTES / 4);
    review.files[0].comments[0][field] = value;
    const escape = vi.spyOn(xmlText, field === 'body' ? 'escapeXmlText' : 'escapeXmlAttribute');
    try {
      await expect(serializeReview(review, output)).rejects.toMatchObject({
        code: 'input-too-large',
      });
      expect(escape).not.toHaveBeenCalledWith(value);
      expect(validateAgainstSchema).not.toHaveBeenCalled();
    } finally {
      escape.mockRestore();
    }
  }
);

it('stops constructing a document when many individually valid fields exhaust the budget', async () => {
  const review = state('x'.repeat(800));
  const first = review.files[0].comments[0];
  review.files[0].comments = Array.from({ length: 10 }, (_, index) => ({
    ...first,
    id: String(index),
  }));
  review.files[0].comments[9].body = 'last body must not be escaped';
  const escape = vi.spyOn(xmlText, 'escapeXmlText');
  try {
    await expect(serializeReview(review, output)).rejects.toMatchObject({
      code: 'input-too-large',
    });
    expect(escape).not.toHaveBeenCalledWith('last body must not be escaped');
    expect(validateAgainstSchema).not.toHaveBeenCalled();
  } finally {
    escape.mockRestore();
  }
});

it.each(['body', 'author'] as const)(
  'charges escaped whitespace and Unicode exactly at the %s boundary',
  async field => {
    const empty = state('');
    empty.files[0].comments[0][field] = 'seed';
    const seeded = await serializeReview(empty, output);
    const seed = `&<>"'\r\n\té中🙂`;
    const encoded =
      field === 'body' ? xmlText.escapeXmlText(seed) : xmlText.escapeXmlAttribute(seed);
    const available = MAX_RESUME_XML_BYTES - Buffer.byteLength(seeded.xml + '\n') + 4;
    const value = seed + 'x'.repeat(available - Buffer.byteLength(encoded));
    empty.files[0].comments[0][field] = value;
    const result = await serializeReview(empty, output);
    expect(Buffer.byteLength(result.xml + '\n')).toBe(MAX_RESUME_XML_BYTES);
    expect(result.xml).toContain(encoded);
    empty.files[0].comments[0][field] += 'x';
    await expect(serializeReview(empty, output)).rejects.toMatchObject({ code: 'input-too-large' });
  }
);
