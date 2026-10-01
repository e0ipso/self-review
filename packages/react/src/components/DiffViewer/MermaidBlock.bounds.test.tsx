import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import MermaidBlock, { MERMAID_RENDER_TIMEOUT_MS } from './MermaidBlock';

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({ config: { theme: 'light' } }),
}));

// The render bounds are about what the block does around Mermaid, not
// inside it, so this file stands in for the library. MermaidBlock.test.tsx
// runs the real one.
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
    mermaidMock.render.mockImplementation(() => new Promise(() => {}));
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
    // The render container is passed in, so nothing is appended to <body>
    // on Mermaid's own initiative, and it is gone once rendering is done.
    const container = mermaidMock.render.mock.calls[0][2] as HTMLElement;
    expect(container).toBeInstanceOf(HTMLElement);
    expect(container.isConnected).toBe(false);
  });
});
