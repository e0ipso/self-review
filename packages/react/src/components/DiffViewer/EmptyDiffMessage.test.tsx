import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyDiffMessage } from './EmptyDiffMessage';

const GIT_SOURCE = { type: 'git' as const, gitDiffArgs: '--stat', repository: '/repo' };

describe('EmptyDiffMessage', () => {
  it('offers the usage help when a git review is empty and nothing went wrong', () => {
    render(<EmptyDiffMessage diffSource={GIT_SOURCE} diagnostics={[]} />);

    expect(screen.getByText('No changes found')).toBeTruthy();
    expect(screen.queryByTestId('diff-diagnostics')).toBeNull();
  });

  it('shows the diagnostics instead of claiming there are no changes', () => {
    render(
      <EmptyDiffMessage
        diffSource={GIT_SOURCE}
        diagnostics={[
          'Unsupported git diff option --stat: self-review reads patch output only',
          'conflict.txt: combined (merge conflict) diff output is not supported',
        ]}
      />
    );

    expect(screen.queryByText('No changes found')).toBeNull();
    const list = screen.getByTestId('diff-diagnostics');
    expect(list.textContent).toContain('--stat');
    expect(list.textContent).toContain('conflict.txt');
  });
});
