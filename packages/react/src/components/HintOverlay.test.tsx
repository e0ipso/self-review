import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HintOverlay } from './HintOverlay';

// Regression guard for SR-0060: the overlay portal and its labels must keep
// stable data-testid hooks. The webapp e2e step for hint-mode coverage
// (tests/webapp-steps/02-file-tree-navigation.steps.ts) addresses these
// nodes by test id, not by their inline z-index style.
describe('HintOverlay', () => {
  const makeHint = (label: string) => ({
    label,
    element: document.createElement('div'),
    rect: { left: 10, top: 20, width: 30, height: 40 } as DOMRect,
  });

  it('renders nothing when there are no hints', () => {
    const { container } = render(<HintOverlay hints={[]} inputBuffer='' />);
    expect(container.querySelector('[data-testid="hint-overlay"]')).toBeNull();
  });

  it('exposes a stable test id on the portal container and each label', () => {
    render(<HintOverlay hints={[makeHint('aa'), makeHint('ab')]} inputBuffer='' />);

    const overlay = document.querySelector('[data-testid="hint-overlay"]');
    expect(overlay).toBeTruthy();
    expect(document.querySelector('[data-testid="hint-label-aa"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="hint-label-ab"]')).toBeTruthy();
  });

  it('filters labels by the input buffer while keeping their test ids', () => {
    render(<HintOverlay hints={[makeHint('aa'), makeHint('ab')]} inputBuffer='ab' />);

    expect(document.querySelector('[data-testid="hint-label-aa"]')).toBeNull();
    expect(document.querySelector('[data-testid="hint-label-ab"]')).toBeTruthy();
  });
});
