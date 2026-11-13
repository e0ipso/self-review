import { expect, it } from 'vitest';
import { decodeReadResult } from './read-result';

it.each([
  null,
  { kind: 'apply', status: 'applied' },
  { kind: 'file', hunks: [{}] },
  { kind: 'context', context: { hunks: null, totalLines: 1 } },
  { kind: 'image', image: { dataUri: 'javascript:alert(1)' } },
  { kind: 'attachment', data: 'not bytes' },
  { kind: 'error', code: 'x', message: 'x'.repeat(2049) },
])('rejects malformed read responses instead of inventing content: %j', value => {
  expect(() => decodeReadResult(value)).toThrow(/Invalid desktop read response/);
});

it('reconstructs bounded structured failures as Errors', () => {
  expect(() =>
    decodeReadResult({ kind: 'error', code: 'io-error', message: 'Attachment read failed' })
  ).toThrow('Attachment read failed');
  try {
    decodeReadResult({ kind: 'error', code: 'io-error', message: 'Attachment read failed' });
  } catch (error) {
    expect(error).toMatchObject({ code: 'io-error' });
  }
});
