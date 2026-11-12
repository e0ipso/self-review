import { expect, it, vi } from 'vitest';
import { runMenuAction } from './action-failure';

it.each(['throw', 'reject'] as const)(
  'consumes action failure and a reporter that can %s',
  async kind => {
    const error = new Error('openExternal failed');
    const report = vi.fn(() => {
      if (kind === 'throw') throw new Error('report failed');
      return Promise.reject(new Error('report failed'));
    });
    await expect(runMenuAction(() => Promise.reject(error), report)).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledExactlyOnceWith(error);
  }
);

it('also contains synchronous action errors without native effects', async () => {
  const report = vi.fn();
  await runMenuAction(() => {
    throw new Error('cannot open');
  }, report);
  expect(report).toHaveBeenCalledOnce();
});
