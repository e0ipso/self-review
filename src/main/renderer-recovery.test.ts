import { expect, it, vi } from 'vitest';
import { RendererRecovery } from './renderer-recovery';
function fixture() {
  let reply!: (value: boolean) => void;
  let current = true;
  const effects = {
    isCurrent: () => current,
    confirmDiscard: vi.fn(
      () =>
        new Promise<boolean>(resolve => {
          reply = resolve;
        })
    ),
    discard: vi.fn(async (stillCurrent: () => boolean) => {
      expect(stillCurrent()).toBe(true);
    }),
    invalidateState: vi.fn(),
  };
  const recovery = new RendererRecovery(effects);
  return {
    recovery,
    effects,
    reply: (value: boolean) => reply(value),
    replace: () => {
      current = false;
    },
  };
}
it('requires confirmed failure and deduplicates repeated close requests; Cancel keeps the window', async () => {
  const f = fixture();
  expect(f.recovery.requestClose()).toBe(false);
  f.recovery.failed('unresponsive');
  expect(f.recovery.requestClose()).toBe(true);
  expect(f.recovery.requestClose()).toBe(true);
  await vi.waitFor(() =>
    expect(f.effects.confirmDiscard).toHaveBeenCalledExactlyOnceWith('unresponsive')
  );
  f.reply(false);
  await Promise.resolve();
  await Promise.resolve();
  expect(f.effects.discard).not.toHaveBeenCalled();
  expect(f.effects.invalidateState).toHaveBeenCalledOnce();
});
it.each(['restore', 'replace', 'dispose'] as const)(
  'ignores a native reply after %s',
  async change => {
    const f = fixture();
    f.recovery.failed('crashed');
    f.recovery.requestClose();
    await vi.waitFor(() => expect(f.effects.confirmDiscard).toHaveBeenCalledOnce());
    if (change === 'restore') f.recovery.restored();
    else if (change === 'replace') f.replace();
    else f.recovery.dispose();
    f.reply(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(f.effects.discard).not.toHaveBeenCalled();
    expect(f.recovery.requestClose()).toBe(false);
  }
);
it('discards only after an explicit native approval and rechecks ownership when draining', async () => {
  const f = fixture();
  let guard!: () => boolean;
  f.effects.discard.mockImplementation(async current => {
    guard = current;
  });
  f.recovery.failed('crashed');
  f.recovery.requestClose();
  await vi.waitFor(() => expect(f.effects.confirmDiscard).toHaveBeenCalledOnce());
  f.reply(true);
  await vi.waitFor(() => expect(f.effects.discard).toHaveBeenCalledOnce());
  expect(guard()).toBe(true);
  f.recovery.restored();
  expect(guard()).toBe(false);
});

it('requires a new page load to restore a crashed renderer and refuses IPC while unavailable', () => {
  const f = fixture();
  f.recovery.failed('crashed');
  expect(f.recovery.unavailable).toBe(true);
  f.recovery.responsive();
  expect(f.recovery.unavailable).toBe(true);
  f.recovery.restored();
  expect(f.recovery.unavailable).toBe(false);
});
