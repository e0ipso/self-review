import { afterEach, expect, it, vi } from 'vitest';
import { DesktopOperations } from './desktop-operations';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => vi.useRealTimers());

it('freezes admission immediately and lets Apply settle before completion', async () => {
  const owner = new DesktopOperations();
  const done = deferred<string>();
  const order: string[] = [];
  const applying = owner.apply(async () => {
    order.push('apply');
    return done.promise;
  });
  const completing = owner.complete(async () => {
    order.push('finish');
  });
  expect(owner.busy).toBe(true);
  await expect(owner.apply(async () => 'second')).rejects.toThrow(/finishing/);
  await Promise.resolve();
  expect(order).toEqual(['apply']);
  done.resolve('applied');
  await expect(applying).resolves.toBe('applied');
  await completing;
  expect(order).toEqual(['apply', 'finish']);
  expect(owner.busy).toBe(false);
});

it('preserves exact precommit cancellation and a committed result after cancellation', async () => {
  const owner = new DesktopOperations();
  const cancel = owner.replaceWindow();
  let entered!: () => void;
  const ready = new Promise<void>(resolve => {
    entered = resolve;
  });
  const applying = owner.apply(
    signal =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        entered();
      })
  );
  const reason = new Error('closed');
  await ready;
  cancel(reason);
  await expect(applying).rejects.toBe(reason);
  owner.replaceWindow();
  const result = { status: 'applied' };
  await expect(
    owner.apply(async () => {
      owner.replaceWindow();
      return result;
    })
  ).resolves.toBe(result);
});

it('rejects read results from old windows and bounds uncooperative work without releasing its slot', async () => {
  vi.useFakeTimers();
  const owner = new DesktopOperations(1);
  const late = deferred<string>();
  const reading = owner.read(() => late.promise, 10);
  const rejected = expect(reading).rejects.toThrow(/timed out/);
  await vi.advanceTimersByTimeAsync(11);
  await expect(owner.read(async () => 'excess')).rejects.toThrow(/Too many/);
  late.resolve('late');
  await rejected;
  const old = deferred<string>();
  const stale = owner.read(() => old.promise);
  await Promise.resolve();
  owner.replaceWindow();
  old.resolve('old');
  await expect(stale).rejects.toThrow(/replaced/);
  await expect(owner.read(async () => 'new')).resolves.toBe('new');
});

it('aborts and drains all operations once, with one bounded shutdown grace', async () => {
  vi.useFakeTimers();
  const owner = new DesktopOperations();
  const never = owner.read(() => new Promise(() => {}));
  void never.catch(() => {});
  await Promise.resolve();
  const stopping = owner.dispose('SIGTERM', 10);
  expect(owner.dispose('again')).toBe(stopping);
  expect(owner.signal.aborted).toBe(true);
  await expect(owner.apply(async () => 'late')).rejects.toThrow('SIGTERM');
  await vi.advanceTimersByTimeAsync(10);
  await stopping;
});
