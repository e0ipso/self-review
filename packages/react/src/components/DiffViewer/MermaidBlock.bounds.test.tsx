import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import MermaidBlock, { MERMAID_RENDER_TIMEOUT_MS } from './MermaidBlock';

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({ config: { theme: 'light' } }),
}));

// Stands in for the library; MermaidBlock.test.tsx runs the real one.
const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock('mermaid', () => ({ default: mermaidMock }));

const SVG = (attrs: string, body = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

afterEach(() => {
  vi.useRealTimers();
});

describe('MermaidBlock render bounds', () => {
  it('stops waiting and shows a contained error when rendering times out', async () => {
    vi.useFakeTimers();
    let finish!: (value: { svg: string }) => void;
    mermaidMock.render.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    render(<MermaidBlock code='flowchart LR\n A --> B' />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MERMAID_RENDER_TIMEOUT_MS - 1);
    });
    expect(screen.queryByTestId('mermaid-error')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId('mermaid-error').textContent).toMatch(/timed out/);
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('[data-mermaid-sandbox]')).toBeNull();
    await act(async () => finish({ svg: SVG('viewBox="0 0 10 10"') }));
  });

  it('shows a contained error instead of a broken image when the output is not well-formed SVG', async () => {
    mermaidMock.render.mockResolvedValue({ svg: SVG('viewBox="0 0 10 10"', '<g>') });
    render(<MermaidBlock code='flowchart LR\n A --> B' />);
    const error = await screen.findByTestId('mermaid-error');
    expect(error.textContent).toMatch(/well-formed SVG/);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('rejects output whose root is not an SVG element', async () => {
    mermaidMock.render.mockResolvedValue({
      svg: '<div xmlns="http://www.w3.org/1999/xhtml">not a diagram</div>',
    });
    render(<MermaidBlock code='flowchart LR\n A --> B' />);
    expect((await screen.findByTestId('mermaid-error')).textContent).toMatch(/well-formed SVG/);
  });

  it('gives the image its intrinsic size from the viewBox', async () => {
    mermaidMock.render.mockResolvedValue({ svg: SVG('width="100%" viewBox="0 0 320.4 180"') });
    render(<MermaidBlock code='flowchart LR\n A --> B' />);
    const img = (await screen.findByRole('img')) as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('321');
    expect(img.getAttribute('height')).toBe('180');
    expect(img.src).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('initializes Mermaid with the strict, content-proof configuration', async () => {
    mermaidMock.render.mockResolvedValue({ svg: SVG('viewBox="0 0 10 10"') });
    render(<MermaidBlock code='flowchart LR\n A --> B' />);
    await screen.findByRole('img');
    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        htmlLabels: false,
        startOnLoad: false,
        secure: expect.arrayContaining(['securityLevel', 'themeCSS', 'fontFamily', 'htmlLabels']),
      })
    );
    // Mermaid gets the container passed in; nothing is appended to <body> on its own.
    const container = mermaidMock.render.mock.calls[0][2] as HTMLElement;
    expect(container).toBeInstanceOf(HTMLElement);
    expect(container.isConnected).toBe(false);
  });
});

describe('Mermaid pre-layout admission and explicit retry', () => {
  it.each([
    'flowchart LR\n' +
      Array.from({ length: 17 }, (_, i) => `A${i}`).join(' & ') +
      ' --> ' +
      Array.from({ length: 17 }, (_, i) => `B${i}`).join(' & '),
    'flowchart LR\n' + 'subgraph x\n'.repeat(13) + 'A --> B\n' + 'end\n'.repeat(13),
    'flowchart LR\nA["' + 'x'.repeat(600) + '"]',
    'flowchart LR\n' + Array.from({ length: 70 }, (_, i) => `A${i} --> A${i + 1}`).join('\n'),
  ])('keeps adversarial source visible without invoking Mermaid', async code => {
    render(<MermaidBlock code={code} />);
    expect((await screen.findByRole('alert')).textContent).toContain('complexity limits');
    expect(screen.getByText(code, { exact: true, normalizer: value => value }).tagName).toBe('PRE');
    expect(mermaidMock.initialize).not.toHaveBeenCalled();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it('retries a failed diagram only on request', async () => {
    mermaidMock.render
      .mockRejectedValueOnce(new Error('layout failed'))
      .mockResolvedValueOnce({ svg: SVG('viewBox="0 0 10 10"') });
    render(<MermaidBlock code='flowchart LR\n A --> B' />);
    expect((await screen.findByRole('alert')).textContent).toContain('layout failed');
    expect(mermaidMock.render).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('img', { name: 'Mermaid diagram' });
    expect(mermaidMock.render).toHaveBeenCalledTimes(2);
  });
});

it('serializes layout and refuses excess queued diagrams without starting them', async () => {
  const finish: Array<(value: { svg: string }) => void> = [];
  mermaidMock.render.mockImplementation(
    () =>
      new Promise(resolve => {
        finish.push(resolve);
      })
  );
  render(
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <MermaidBlock key={i} code={`flowchart LR\n A${i} --> B${i}`} />
      ))}
    </>
  );
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  expect(mermaidMock.render).toHaveBeenCalledOnce();
  for (let i = 0; i < 8; i++) {
    await act(async () => finish[i]({ svg: SVG('viewBox="0 0 10 10"') }));
  }
  expect(screen.getAllByRole('img')).toHaveLength(8);
  expect(mermaidMock.render).toHaveBeenCalledTimes(8);
});

it.each([SVG('viewBox="0 0 10 10"', 'x'.repeat(1_000_000)), SVG('viewBox="0 0 100000 100000"')])(
  'contains excessive SVG output or intrinsic dimensions',
  async svg => {
    mermaidMock.render.mockResolvedValue({ svg });
    render(<MermaidBlock code='flowchart LR\n A --> B' />);
    expect((await screen.findByRole('alert')).textContent).toContain('image size limit');
    expect(screen.queryByRole('img')).toBeNull();
  }
);
