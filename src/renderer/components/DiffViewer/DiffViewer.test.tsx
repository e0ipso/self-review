import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import DiffViewer, { COLLAPSE_THRESHOLD } from './DiffViewer';
import type { DiffFile } from '../../../shared/types';

// Mock context hooks
const mockDiffFiles: DiffFile[] = [];
const mockDiffSource = { type: 'git' as const, gitDiffArgs: '', repository: '' };
const mockConfig = { diffView: 'unified' as const };

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    diffFiles: mockDiffFiles,
    diffSource: mockDiffSource,
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
});
