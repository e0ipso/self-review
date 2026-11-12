import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PreviewRenderingProvider } from '../../context/PreviewRenderingContext';
import MermaidBlock from './MermaidBlock';
import type { DiagramRenderRequest } from './diagram-service';

vi.mock('../../context/ConfigContext', () => ({ useAppearance: () => ({ theme: 'light' }) }));
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><text>safe</text></svg>';

it('uses the supplied service, aborts replaced work and ignores its late result', async () => {
  const requests: DiagramRenderRequest[] = [];
  const finish: Array<(value: { svg: string }) => void> = [];
  const service = {
    render: vi.fn((request: DiagramRenderRequest) => {
      requests.push(request);
      return new Promise<{ svg: string }>(resolve => finish.push(resolve));
    }),
  };
  const view = (code: string) => (
    <PreviewRenderingProvider diagramRenderer={service}>
      <MermaidBlock code={code} />
    </PreviewRenderingProvider>
  );
  const { rerender, unmount } = render(view('flowchart LR\n A --> B'));
  await act(async () => {});
  rerender(view('flowchart LR\n C --> D'));
  await act(async () => {});
  expect(requests[0].signal.aborted).toBe(true);
  expect(requests[1]).toMatchObject({ source: 'flowchart LR\n C --> D', theme: 'light' });
  await act(async () => finish[0]({ svg }));
  expect(screen.queryByRole('img')).toBeNull();
  await act(async () => finish[1]({ svg }));
  expect(screen.getByRole('img').getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
  expect(document.querySelector('svg')).toBeNull();
  unmount();
  expect(requests[1].signal.aborted).toBe(true);
});

it('checks supplied output and retries failure only on request', async () => {
  const service = {
    render: vi.fn().mockResolvedValueOnce({ svg: '<html />' }).mockResolvedValue({ svg }),
  };
  render(
    <PreviewRenderingProvider diagramRenderer={service}>
      <MermaidBlock code={'flowchart LR\n A --> B'} />
    </PreviewRenderingProvider>
  );
  expect((await screen.findByRole('alert')).textContent).toContain('well-formed SVG');
  expect(service.render).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('img');
  expect(service.render).toHaveBeenCalledTimes(2);
});

it('never sends excessive source to a supplied service', async () => {
  const service = { render: vi.fn() };
  render(
    <PreviewRenderingProvider diagramRenderer={service}>
      <MermaidBlock code={'x'.repeat(50001)} />
    </PreviewRenderingProvider>
  );
  await screen.findByRole('alert');
  expect(service.render).not.toHaveBeenCalled();
});
