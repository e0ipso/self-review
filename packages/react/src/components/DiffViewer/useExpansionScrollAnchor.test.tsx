import { useRef } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { DiffHunk } from '@self-review/types';
import { useExpansionScrollAnchor } from './useExpansionScrollAnchor';
afterEach(cleanup);
it('compensates old-side anchors once after commit, ignores tiny drift and obsolete owners', () => {
  const container = document.createElement('div');
  container.setAttribute('data-scroll-container', 'diff');
  const section = document.createElement('section');
  const line = document.createElement('div');
  line.setAttribute('data-line-number', '10');
  line.setAttribute('data-line-side', 'old');
  section.append(line);
  container.append(section);
  let top = 120;
  container.getBoundingClientRect = () => ({ top: 20 }) as DOMRect;
  line.getBoundingClientRect = () => ({ top }) as DOMRect;
  container.scrollTop = 40;
  const hunks: DiffHunk[] = [
    {
      header: '',
      oldStart: 10,
      newStart: 10,
      oldLines: 1,
      newLines: 0,
      lines: [{ type: 'deletion', oldLineNumber: 10, newLineNumber: null, content: 'original' }],
    },
  ];
  const owner = {};
  const hook = renderHook(
    ({ input, identity }) => {
      const ref = useRef<HTMLElement | null>(section);
      return useExpansionScrollAnchor(ref, input, identity);
    },
    { initialProps: { input: hunks, identity: owner } }
  );
  hook.result.current.capture(hunks, 'up', 0, 'top');
  top = 150;
  hook.rerender({ input: [...hunks], identity: owner });
  expect(container.scrollTop).toBe(70);
  top = 190;
  hook.rerender({ input: [...hunks], identity: owner });
  expect(container.scrollTop).toBe(70);
  hook.result.current.capture(hunks, 'all', 0, 'top');
  top = 190.5;
  hook.rerender({ input: [...hunks], identity: owner });
  expect(container.scrollTop).toBe(70);
  hook.result.current.capture(hunks, 'up', 0, 'top');
  top = 250;
  hook.rerender({ input: [...hunks], identity: {} });
  expect(container.scrollTop).toBe(70);
});
