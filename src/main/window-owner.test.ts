import { describe, it, expect, vi } from 'vitest';
import { WindowOwner } from './window-owner';
function window() {
  const closed: (() => void)[] = [];
  let destroyed = false;
  return {
    isDestroyed: () => destroyed,
    isMinimized: () => true,
    restore: vi.fn(),
    focus: vi.fn(),
    on: (_event: 'closed', listener: () => void) => {
      closed.push(listener);
    },
    close: () => {
      destroyed = true;
      closed.forEach(listener => listener());
    },
    emitOldClosed: () => closed.forEach(listener => listener()),
  };
}
describe('desktop window ownership', () => {
  it('defers activation until initialized, reuses the live window and reopens after closing', () => {
    const create = vi.fn(window);
    const owner = new WindowOwner(create);
    owner.activate();
    owner.activate();
    expect(create).not.toHaveBeenCalled();
    owner.initialize();
    const first = owner.current!;
    owner.activate();
    owner.initialize();
    expect(create).toHaveBeenCalledOnce();
    expect(first.restore).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalled();
    first.close();
    owner.activate();
    const second = owner.current;
    expect(create).toHaveBeenCalledTimes(2);
    first.emitOldClosed();
    expect(owner.current).toBe(second);
    owner.stop();
    second?.close();
    owner.activate();
    expect(create).toHaveBeenCalledTimes(2);
  });
});
