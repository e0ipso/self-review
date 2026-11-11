import React from 'react';
import { it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DiffNavigationProvider, useDiffNavigationContext } from './DiffNavigationContext';

it('selects from every current intersection and forgets unregistered sections', () => {
  let callback!: IntersectionObserverCallback;
  let navigation!: ReturnType<typeof useDiffNavigationContext>;
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
  function Probe() {
    navigation = useDiffNavigationContext();
    return <span>{navigation.activeFilePath ?? 'none'}</span>;
  }
  const view = render(
    <DiffNavigationProvider>
      <Probe />
    </DiffNavigationProvider>
  );
  const a = document.createElement('div');
  const b = document.createElement('div');
  a.setAttribute('data-file-path', 'a');
  b.setAttribute('data-file-path', 'b');
  const entry = (target: Element, ratio: number) =>
    ({ target, intersectionRatio: ratio, isIntersecting: ratio > 0 }) as IntersectionObserverEntry;
  act(() => {
    navigation.registerFileElement('a', a);
    navigation.registerFileElement('b', b);
    callback([entry(a, 0.8), entry(b, 0.3)], observer as unknown as IntersectionObserver);
  });
  expect(screen.getByText('a')).toBeTruthy();
  act(() => callback([entry(b, 0.5)], observer as unknown as IntersectionObserver));
  expect(screen.getByText('a')).toBeTruthy();
  act(() => navigation.unregisterFileElement('a', a));
  expect(screen.getByText('b')).toBeTruthy();
  act(() => callback([entry(b, 0)], observer as unknown as IntersectionObserver));
  expect(screen.getByText('none')).toBeTruthy();
  act(() => navigation.unregisterFileElement('b', b));
  expect(observer.unobserve).toHaveBeenCalledWith(b);
  view.unmount();
  vi.unstubAllGlobals();
});
