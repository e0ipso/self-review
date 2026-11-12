import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConfigProvider, useConfig, type ConfigContextValue } from './ConfigContext';
import { PreviewRenderingProvider } from './PreviewRenderingContext';
import MermaidBlock from '../components/DiffViewer/MermaidBlock';
import { ComposerCore } from '../components/Comments/ComposerCore';
import type { DiagramRenderRequest } from '../components/DiffViewer/diagram-service';

function systemAppearance(dark = false) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const media = {
    get matches() {
      return dark;
    },
    addEventListener: vi.fn((_event: string, listener: (event: { matches: boolean }) => void) =>
      listeners.add(listener)
    ),
    removeEventListener: vi.fn((_event: string, listener: (event: { matches: boolean }) => void) =>
      listeners.delete(listener)
    ),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media)
  );
  return {
    listeners,
    change(next: boolean) {
      dark = next;
      for (const listener of listeners) listener({ matches: dark });
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

it('updates existing diagrams, editors and scoped CSS on OS changes without another render', async () => {
  const system = systemAppearance();
  const requests: DiagramRenderRequest[] = [];
  const renderDiagram = vi.fn(async (request: DiagramRenderRequest) => {
    requests.push(request);
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" />' };
  });
  let config!: ConfigContextValue;
  let applicationRenders = 0;
  function Probe() {
    config = useConfig();
    applicationRenders++;
    return null;
  }
  const { container, unmount } = render(
    <ConfigProvider initialConfig={{ theme: 'system' }}>
      <Probe />
      <PreviewRenderingProvider diagramRenderer={{ render: renderDiagram }}>
        <MermaidBlock code={'flowchart LR\n A --> B'} />
      </PreviewRenderingProvider>
      <ComposerCore
        body=''
        onBodyChange={() => {}}
        attachments={[]}
        setAttachments={() => {}}
        placeholder='Comment'
        onSubmit={() => {}}
        testId='composer'
      />
    </ConfigProvider>
  );
  await screen.findByRole('img');
  const before = applicationRenders;
  expect(requests.at(-1)?.theme).toBe('light');
  expect(container.querySelector('[data-color-mode]')?.getAttribute('data-color-mode')).toBe(
    'light'
  );
  await act(async () => system.change(true));
  expect(config.config.theme).toBe('system');
  expect(applicationRenders).toBe(before);
  expect(container.querySelector('.self-review')?.classList.contains('dark')).toBe(true);
  expect(container.querySelector('[data-color-mode]')?.getAttribute('data-color-mode')).toBe(
    'dark'
  );
  expect(requests.at(-1)?.theme).toBe('dark');
  expect(requests[0].signal.aborted).toBe(true);
  unmount();
  expect(system.listeners.size).toBe(0);
  expect(requests.at(-1)?.signal.aborted).toBe(true);
});

it('resolves initial preferences and explicit/system transitions with one owned listener', () => {
  const system = systemAppearance(true);
  let config!: ConfigContextValue;
  function Probe() {
    config = useConfig();
    return null;
  }
  const { container, unmount } = render(
    <ConfigProvider initialConfig={{ theme: 'system' }}>
      <Probe />
    </ConfigProvider>
  );
  const dark = () => container.querySelector('.self-review')?.classList.contains('dark');
  expect(dark()).toBe(true);
  expect(system.listeners.size).toBe(1);
  act(() => config.updateConfig({ theme: 'light' }));
  expect(dark()).toBe(false);
  expect(system.listeners.size).toBe(0);
  act(() => system.change(false));
  act(() => config.setConfig({ ...config.config, theme: 'dark' }));
  expect(dark()).toBe(true);
  act(() => config.updateConfig({ theme: 'system' }));
  expect(dark()).toBe(false);
  expect(system.listeners.size).toBe(1);
  act(() => system.change(true));
  expect(dark()).toBe(true);
  unmount();
  expect(system.listeners.size).toBe(0);
});

it.each([
  ['light', true, false],
  ['dark', false, true],
  ['system', false, false],
  ['system', true, true],
] as const)('resolves initial %s intent with OS dark=%s', (theme, systemDark, expected) => {
  const system = systemAppearance(systemDark);
  const { container, unmount } = render(
    <ConfigProvider initialConfig={{ theme }}>
      <span />
    </ConfigProvider>
  );
  expect(container.querySelector('.self-review')?.classList.contains('dark')).toBe(expected);
  expect(system.listeners.size).toBe(theme === 'system' ? 1 : 0);
  unmount();
  expect(system.listeners.size).toBe(0);
});

it('releases a replaced owner and tracks only the new system owner', () => {
  const system = systemAppearance();
  const view = (key: string, theme: 'system' | 'dark') => (
    <ConfigProvider key={key} initialConfig={{ theme }}>
      <span />
    </ConfigProvider>
  );
  const { container, rerender, unmount } = render(view('first', 'system'));
  expect(system.listeners.size).toBe(1);
  rerender(view('second', 'dark'));
  expect(system.listeners.size).toBe(0);
  rerender(view('third', 'system'));
  expect(system.listeners.size).toBe(1);
  act(() => system.change(true));
  expect(container.querySelector('.self-review')?.classList.contains('dark')).toBe(true);
  unmount();
  expect(system.listeners.size).toBe(0);
});
