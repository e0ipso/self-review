import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import DiffViewer, { COLLAPSE_THRESHOLD } from './DiffViewer';
import type { DiffFile } from '@self-review/types';

// Mock context hooks
const mockDiffFiles: DiffFile[] = [];
const mockDiagnostics: string[] = [];
const mockDiffSource = { type: 'git' as const, gitDiffArgs: '', repository: '' };
const mockConfig = { diffView: 'unified' as const };

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    diffFiles: mockDiffFiles,
    diffSource: mockDiffSource,
    diagnostics: mockDiagnostics,
  }),
}));

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({
    config: mockConfig,
  }),
}));

vi.mock('./FileSection', () => ({
  default: ({ file, expanded }: { file: DiffFile; expanded: boolean }) => (
    <div
      data-testid={`file-section-${file.newPath || file.oldPath}`}
      data-expanded={String(expanded)}
    >
      {file.newPath || file.oldPath}
    </div>
  ),
}));

function makeDiffFile(path: string): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  };
}

function makeDiffFiles(count: number): DiffFile[] {
  return Array.from({ length: count }, (_, i) => makeDiffFile(`file-${i}.ts`));
}

describe('DiffViewer', () => {
  describe('COLLAPSE_THRESHOLD', () => {
    it('is 50', () => {
      expect(COLLAPSE_THRESHOLD).toBe(50);
    });
  });

  describe('initial expanded state', () => {
    it('initializes files as expanded when count is at the threshold', () => {
      mockDiffFiles.length = 0;
      mockDiffFiles.push(...makeDiffFiles(COLLAPSE_THRESHOLD));

      const { getAllByTestId } = render(<DiffViewer />);
      const sections = getAllByTestId(/^file-section-/);

      expect(sections).toHaveLength(COLLAPSE_THRESHOLD);
      sections.forEach(section => {
        expect(section.getAttribute('data-expanded')).toBe('true');
      });
    });

    it('initializes files as expanded when count is below the threshold', () => {
      mockDiffFiles.length = 0;
      mockDiffFiles.push(...makeDiffFiles(10));

      const { getAllByTestId } = render(<DiffViewer />);
      const sections = getAllByTestId(/^file-section-/);

      expect(sections).toHaveLength(10);
      sections.forEach(section => {
        expect(section.getAttribute('data-expanded')).toBe('true');
      });
    });

    it('initializes files as collapsed when count exceeds the threshold', () => {
      mockDiffFiles.length = 0;
      mockDiffFiles.push(...makeDiffFiles(COLLAPSE_THRESHOLD + 1));

      const { getAllByTestId } = render(<DiffViewer />);
      const sections = getAllByTestId(/^file-section-/);

      expect(sections).toHaveLength(COLLAPSE_THRESHOLD + 1);
      sections.forEach(section => {
        expect(section.getAttribute('data-expanded')).toBe('false');
      });
    });
  });

  describe('load diagnostics', () => {
    it('shows the diagnostics instead of an empty-state message when no file loaded', () => {
      mockDiffFiles.length = 0;
      mockDiagnostics.length = 0;
      mockDiagnostics.push('conflict.txt: combined (merge conflict) diff output is not supported');

      const { getByTestId, queryByText } = render(<DiffViewer />);

      expect(getByTestId('diff-diagnostics').textContent).toContain('conflict.txt');
      expect(queryByText('No changes found')).toBeNull();
      mockDiagnostics.length = 0;
    });

    it('keeps the diagnostics visible above the files that did load', () => {
      mockDiffFiles.length = 0;
      mockDiffFiles.push(...makeDiffFiles(2));
      mockDiagnostics.length = 0;
      mockDiagnostics.push('conflict.txt: combined (merge conflict) diff output is not supported');

      const { getByTestId, getAllByTestId } = render(<DiffViewer />);

      expect(getByTestId('diff-diagnostics').textContent).toContain('conflict.txt');
      expect(getAllByTestId(/^file-section-/)).toHaveLength(2);
      mockDiagnostics.length = 0;
    });

    it('renders no diagnostics element for a clean load', () => {
      mockDiffFiles.length = 0;
      mockDiffFiles.push(...makeDiffFiles(1));
      mockDiagnostics.length = 0;

      const { queryByTestId } = render(<DiffViewer />);

      expect(queryByTestId('diff-diagnostics')).toBeNull();
    });
  });
});
