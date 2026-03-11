import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SyntaxLine from './SyntaxLine';

// No vi.mock('prismjs') or vi.mock('@self-review/react') — this is the
// regression guard ensuring static Prism imports have not been reintroduced.
describe('SyntaxLine', () => {
  it('renders without crashing and without vi.mock for prismjs', () => {
    render(
      <SyntaxLine content="const x = 1;" language="typescript" lineType="add" />,
    );
    // The initial render shows plain-escaped content (Prism hasn't loaded yet in jsdom)
    const code = document.querySelector('code');
    expect(code).toBeTruthy();
    expect(code?.textContent).toContain('const x = 1;');
  });

  it('renders content when language is unrecognised', () => {
    render(
      <SyntaxLine content="hello world" language="unknown-lang" lineType="context" />,
    );
    expect(screen.getByText(/hello world/)).toBeTruthy();
  });

  it('HTML-escapes content containing special characters', () => {
    render(
      <SyntaxLine content="<div>&amp;</div>" language="plaintext" lineType="context" />,
    );
    const code = document.querySelector('code');
    expect(code).toBeTruthy();
    // The raw innerHTML must not contain unescaped < from input
    expect(code?.innerHTML).not.toContain('<div>');
    expect(code?.innerHTML).toContain('&lt;');
  });
});
