import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import MermaidBlock from './MermaidBlock';
import { PreviewRenderingProvider } from '../../context/PreviewRenderingContext';
import { LocalizationProvider } from '../../localization/LocalizationContext';

import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();

const source = 'flowchart LR\n A[unique source label] --> B';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10">
<title>Deployment &amp; rollback</title><desc>Build before release &lt;script&gt;alert(1)&lt;/script&gt;</desc>
<style>body{display:none}</style><script>alert(1)</script></svg>`;

it('exposes inert title and description and keeps successful source mounted for disclosure', async () => {
  const { container } = render(
    <PreviewRenderingProvider diagramRenderer={{ render: async () => ({ svg }) }}>
      <MermaidBlock code={source} />
    </PreviewRenderingProvider>
  );
  const image = await screen.findByRole('img', { name: 'Deployment & rollback' });
  const description = document.getElementById(image.getAttribute('aria-describedby')!);
  expect(description?.textContent).toBe('Build before release <script>alert(1)</script>');
  expect(
    screen.getByText('Diagram source').closest('details')?.querySelector('pre')?.textContent
  ).toBe(source);
  expect(container.querySelector('svg, style, script')).toBeNull();
  expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
});

it('bounds copied metadata and falls back to a localized image name and source label', async () => {
  const { unmount } = render(
    <PreviewRenderingProvider
      diagramRenderer={{
        render: async () => ({ svg: svg.replace('Deployment &amp; rollback', 'x'.repeat(5000)) }),
      }}
    >
      <MermaidBlock code={source} />
    </PreviewRenderingProvider>
  );
  expect((await screen.findByRole('img')).getAttribute('alt')?.length).toBeLessThanOrEqual(1000);
  unmount();
  render(
    <LocalizationProvider
      messages={{ 'Mermaid diagram': 'Diagrama Mermaid', 'Diagram source': 'Código del diagrama' }}
    >
      <PreviewRenderingProvider
        diagramRenderer={{
          render: async () => ({ svg: '<svg xmlns="http://www.w3.org/2000/svg" />' }),
        }}
      >
        <MermaidBlock code={source} />
      </PreviewRenderingProvider>
    </LocalizationProvider>
  );
  await screen.findByRole('img', { name: 'Diagrama Mermaid' });
  expect(screen.getByText('Código del diagrama').closest('details')?.textContent).toContain(source);
});
