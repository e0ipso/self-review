import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DiffNavigationProvider, useDiffNavigationContext } from './DiffNavigationContext';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('observes duplicate sections, preserves first-match lookup and unregisters only its own element', () => {
  let callback!: IntersectionObserverCallback;
  const observer = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = observer.observe;
      unobserve = observer.unobserve;
      disconnect = observer.disconnect;
    }
  );
  let navigation!: ReturnType<typeof useDiffNavigationContext>;
  function Probe() {
    navigation = useDiffNavigationContext();
    return null;
  }
  const view = render(
    <DiffNavigationProvider>
      <Probe />
    </DiffNavigationProvider>
  );
  const first = document.createElement('section');
  const second = document.createElement('section');
  const other = document.createElement('section');
  first.scrollIntoView = vi.fn();
  second.scrollIntoView = vi.fn();
  const intersect = (target: Element, ratio: number) =>
    ({ target, isIntersecting: ratio > 0, intersectionRatio: ratio }) as IntersectionObserverEntry;
  act(() => {
    navigation.registerFileElement('same', first);
    navigation.registerFileElement('same', second);
    navigation.registerFileElement('other', other);
  });
  expect(observer.unobserve).not.toHaveBeenCalled();
  expect(navigation.getFileElement('same')).toBe(first);
  navigation.scrollToFile('same');
  expect(first.scrollIntoView).toHaveBeenCalledOnce();
  act(() =>
    callback(
      [intersect(first, 0), intersect(second, 0.9), intersect(other, 0.3)],
      observer as unknown as IntersectionObserver
    )
  );
  expect(navigation.activeFilePath).toBe('same');
  act(() => navigation.unregisterFileElement('same', first));
  expect(navigation.getFileElement('same')).toBe(second);
  expect(navigation.activeFilePath).toBe('same');
  act(() => navigation.unregisterFileElement('same', first));
  expect(navigation.getFileElement('same')).toBe(second);
  navigation.scrollToFile('same');
  expect(second.scrollIntoView).toHaveBeenCalledOnce();
  act(() => navigation.unregisterFileElement('same', second));
  expect(navigation.getFileElement('same')).toBeNull();
  expect(navigation.activeFilePath).toBe('other');
  act(() => callback([intersect(second, 1)], observer as unknown as IntersectionObserver));
  expect(navigation.activeFilePath).toBe('other');
  view.unmount();
  expect(observer.disconnect).toHaveBeenCalled();
});
