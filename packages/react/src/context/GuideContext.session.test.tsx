import React from 'react';
import { describe, it, expect } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { DiffLoadPayload, GuideLoadPayload } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import { installBrowserApiStubs } from '../test-helpers';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import { ConfigProvider } from './ConfigContext';
import { ReviewProvider } from './ReviewContext';
import { GuideProvider, useGuide } from './GuideContext';
installBrowserApiStubs();
const guide: GuideLoadPayload = { overview: 'A only', groups: [] };
function source(path: string): DiffLoadPayload {
  return { source: { type: 'directory', sourcePath: path }, files: [] };
}
function Probe() {
  const { guide, mode, setMode } = useGuide();
  return (
    <button onClick={() => setMode('flat')}>
      {guide?.overview ?? 'no guide'}:{mode}
    </button>
  );
}
function Tree({ adapter }: { adapter: ReviewAdapter }) {
  return (
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider>
        <GuideProvider>
          <ReviewProvider>
            <Probe />
          </ReviewProvider>
        </GuideProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}

describe('guide session ownership', () => {
  it('clears an initial-response guide on replacement and resets presentation mode', async () => {
    let push!: (p: DiffLoadPayload) => void;
    let pushGuide!: (p: GuideLoadPayload) => void;
    const adapter: ReviewAdapter = {
      loadDiff: async () => source('/a'),
      onDiffLoad: cb => {
        push = cb;
        return () => {};
      },
      onGuideLoad: cb => {
        pushGuide = cb;
        return () => {};
      },
    };
    render(<Tree adapter={adapter} />);
    await act(async () => {});
    act(() => pushGuide(guide));
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('button').textContent).toBe('A only:flat');
    act(() => push(source('/b')));
    expect(screen.getByRole('button').textContent).toBe('no guide:guided');
  });
  it('retains a guide delivered before the first diff, but clears it for a new adapter', async () => {
    let resolve!: (p: DiffLoadPayload) => void;
    const first: ReviewAdapter = {
      loadDiff: () =>
        new Promise(r => {
          resolve = r;
        }),
      onGuideLoad: cb => {
        cb(guide);
        return () => {};
      },
    };
    const second: ReviewAdapter = { loadDiff: async () => source('/b') };
    const view = render(<Tree adapter={first} />);
    await act(async () => resolve(source('/a')));
    expect(screen.getByRole('button').textContent).toBe('A only:guided');
    view.rerender(<Tree adapter={second} />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('no guide:guided'));
  });
});
