import React from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MermaidBlock, { MERMAID_MAX_SOURCE_CHARS, MERMAID_SECURE_KEYS } from './MermaidBlock';

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({ config: { theme: 'light' } }),
}));

// Mermaid measures text while it lays a diagram out. jsdom has no layout
// engine, so the two geometry calls it needs return a fixed box, the same
// way the audit probe (docs/security-audit-2026-10-01/mermaid-probe.mjs)
// ran the library.
beforeAll(() => {
  const proto = SVGElement.prototype as unknown as Record<string, unknown>;
  proto.getBBox = () => ({ x: 0, y: 0, width: 100, height: 30 });
  proto.getComputedTextLength = () => 30;
});

// The audit's global-selector payload: a fontFamily directive whose value
// closes the font declaration and opens a `:not(...)` rule that matches
// every element in the document the diagram lands in.
const GLOBAL_CSS_PAYLOAD =
  '%%{init: {"fontFamily": "x;a{b} :not(&){background:green !important} c{d}"}}%%\nflowchart LR\n A --> B';

// The audit's passive-HTML payload: a classDef that closes the diagram's
// <style> and <svg> and opens a full-viewport overlay <div>.
const OVERLAY_PAYLOAD = [
  'stateDiagram-v2',
  ' classDef overlay fill:red</style></svg><div style="position:fixed;inset:0;z-index:2147483647;background:black;color:white">AUDIT OVERLAY</div><svg><style>a:b',
  ' [*] --> A:::overlay',
].join('\n');

function renderWithSentinel(code: string) {
  return render(
    <div>
      <button data-testid='sentinel' style={{ backgroundColor: 'rgb(1, 2, 3)' }}>
        UI sentinel
      </button>
      <MermaidBlock code={code} />
    </div>
  );
}

async function findDiagramImage(): Promise<HTMLImageElement> {
  return (await screen.findByRole('img', {}, { timeout: 15000 })) as HTMLImageElement;
}

describe('MermaidBlock isolation', () => {
  it('renders the diagram as an SVG data-URI image, never as document markup', async () => {
    renderWithSentinel('flowchart LR\n A --> B');
    const img = await findDiagramImage();
    expect(img.tagName).toBe('IMG');
    expect(img.src).toMatch(/^data:image\/svg\+xml;base64,/);
    // The encoded image is Mermaid's SVG, so the diagram still exists; it
    // is just not part of the application document.
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(img.src.split(',')[1]), c => c.charCodeAt(0))
    );
    expect(decoded).toContain('<svg');
    expect(document.querySelector('svg')).toBeNull();
    expect(document.querySelector('style')).toBeNull();
  }, 20000);

  it('keeps the global-selector CSS payload out of the application document', async () => {
    renderWithSentinel(GLOBAL_CSS_PAYLOAD);
    const img = await findDiagramImage();
    expect(img.src).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(document.querySelector('style')).toBeNull();
    const sentinel = screen.getByTestId('sentinel');
    expect(sentinel.style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(sentinel).backgroundColor).toBe('rgb(1, 2, 3)');
  }, 20000);

  it('keeps the overlay-div payload out of the application document', async () => {
    renderWithSentinel(OVERLAY_PAYLOAD);
    await waitFor(
      () => {
        // Either a contained image or a contained error; never a free DIV.
        expect(screen.queryByRole('img') ?? screen.queryByText(/Mermaid error/)).not.toBeNull();
      },
      { timeout: 15000 }
    );
    const escaped = [...document.querySelectorAll('div')].filter(
      div => div.textContent === 'AUDIT OVERLAY'
    );
    expect(escaped).toHaveLength(0);
    expect(
      document.querySelector('[style*="position:fixed"], [style*="position: fixed"]')
    ).toBeNull();
  }, 20000);

  it('removes its measurement container from the document after rendering', async () => {
    renderWithSentinel('flowchart LR\n A --> B');
    await findDiagramImage();
    expect(document.querySelectorAll('[data-mermaid-sandbox]')).toHaveLength(0);
    expect(document.querySelectorAll('[id^="dmermaid-"], [id^="mermaid-"]')).toHaveLength(0);
  }, 20000);

  it('ignores init directives that try to change secured configuration', async () => {
    const hostile = [
      '%%{init: {"securityLevel": "loose", "htmlLabels": true, "themeCSS": ".x{color:red}", "fontFamily": "monospace", "maxTextSize": 1}}%%',
      'flowchart LR',
      ' A --> B',
    ].join('\n');
    renderWithSentinel(hostile);
    await findDiagramImage();
    const mermaid = (await import('mermaid')).default;
    const config = mermaid.mermaidAPI.getConfig();
    expect(config.securityLevel).toBe('strict');
    expect(config.htmlLabels).toBe(false);
    expect(config.themeCSS).toBeUndefined();
    expect(config.fontFamily).not.toBe('monospace');
    expect(config.maxTextSize).toBe(MERMAID_MAX_SOURCE_CHARS);
    for (const key of ['securityLevel', 'themeCSS', 'fontFamily', 'htmlLabels', 'maxTextSize']) {
      expect(MERMAID_SECURE_KEYS).toContain(key);
    }
  }, 20000);

  it('refuses diagram source over the size limit with a contained message', async () => {
    const oversized = 'flowchart LR\n' + ' A --> B\n'.repeat(MERMAID_MAX_SOURCE_CHARS / 9 + 1);
    expect(oversized.length).toBeGreaterThan(MERMAID_MAX_SOURCE_CHARS);
    renderWithSentinel(oversized);
    const error = await screen.findByText(/Mermaid error/);
    expect(error.textContent).toMatch(/too large/i);
    expect(screen.queryByRole('img')).toBeNull();
  });
});
