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

it('admits explicit discard when reads are full, cancels Apply, and observes its final result first', async () => {
  const owner = new DesktopOperations(2);
  const reading = owner.read(() => new Promise(() => {}));
  void reading.catch(() => {});
  const order: string[] = [];
  const applying = owner.apply(
    signal =>
      new Promise((_, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            order.push('cancelled');
            reject(signal.reason);
          },
          { once: true }
        );
      })
  );
  const refused = expect(applying).rejects.toThrow('The review was discarded.');
  await Promise.resolve();
  const discarding = owner.complete(async () => {
    order.push('discard');
  }, true);
  await discarding;
  await refused;
  expect(order).toEqual(['cancelled', 'discard']);
  // The uncooperative read still owns its slot until bounded shutdown; it cannot trap Discard.
  await expect(owner.read(async () => 'another')).resolves.toBe('another');
  await owner.dispose('done', 1);
});

function scheduler() {
  const tasks = new Set<{ run: () => void; ms: number }>();
  return {
    tasks,
    schedule: (run: () => void, ms: number) => {
      const task = { run, ms };
      tasks.add(task);
      return () => {
        tasks.delete(task);
      };
    },
    fire: (ms: number) => {
      for (const task of [...tasks])
        if (task.ms === ms) {
          tasks.delete(task);
          task.run();
        }
    },
  };
}
it('uses injected read deadlines, keeps uncooperative admission, and cancels on every read exit', async () => {
  const timing = scheduler();
  const owner = new DesktopOperations(1, timing);
  const late = deferred<string>();
  let signal!: AbortSignal;
  const reading = owner.read(async current => {
    signal = current;
    return late.promise;
  }, 17);
  await Promise.resolve();
  expect([...timing.tasks].map(task => task.ms)).toEqual([17]);
  timing.fire(17);
  expect(signal.aborted).toBe(true);
  await expect(owner.read(async () => 'excess')).rejects.toThrow(/Too many/);
  late.resolve('late');
  await expect(reading).rejects.toThrow(/timed out/);
  expect(timing.tasks.size).toBe(0);
  await expect(owner.read(async () => 'ok')).resolves.toBe('ok');
  await expect(
    owner.read(async () => {
      throw new Error('failed');
    })
  ).rejects.toThrow('failed');
  const cancel = new AbortController();
  const uncooperative = deferred<string>();
  const cancelled = owner.readOwned(() => uncooperative.promise, cancel.signal);
  await Promise.resolve();
  cancel.abort();
  expect(timing.tasks.size).toBe(0);
  uncooperative.resolve('stale');
  await expect(cancelled).rejects.toThrow();
  expect(timing.tasks.size).toBe(0);
});
it('uses injected drain deadlines once and clears timers on disposal or normal drain', async () => {
  const timing = scheduler();
  const owner = new DesktopOperations(32, timing);
  const late = deferred<void>();
  const reading = owner.read(() => late.promise);
  await Promise.resolve();
  const disposal = owner.dispose('closed', 23);
  expect(owner.dispose('again')).toBe(disposal);
  expect([...timing.tasks].map(task => task.ms)).toEqual([23]);
  timing.fire(23);
  await disposal;
  expect(timing.tasks.size).toBe(0);
  late.resolve();
  await expect(reading).rejects.toThrow('closed');
  const normal = new DesktopOperations(32, timing);
  await normal.dispose('normal', 19);
  expect(timing.tasks.size).toBe(0);
});
