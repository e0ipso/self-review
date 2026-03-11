import React from 'react';
import type { DiffSource } from '@self-review/core';

export interface EmptyDiffMessageProps {
  diffSource: DiffSource;
}

export function EmptyDiffMessage({ diffSource }: EmptyDiffMessageProps) {
  // Loading/welcome mode: don't render empty state (App.tsx handles these)
  if (diffSource.type === 'welcome' || diffSource.type === 'loading') {
    return null;
  }

  // File mode: error message (shouldn't normally happen)
  if (diffSource.type === 'file') {
    return (
      <div
        className='flex-1 flex items-center justify-center p-8'
        data-testid='empty-diff-help'
      >
        <div className='max-w-lg space-y-6'>
          <h2 className='text-lg font-semibold text-foreground text-center'>
            Could not read file
          </h2>
          <p className='text-sm text-muted-foreground text-center'>
            The file{' '}
            <code className='px-1 py-0.5 rounded bg-muted text-xs font-mono'>
              {diffSource.sourcePath}
            </code>{' '}
            could not be read or is empty.
          </p>
        </div>
      </div>
    );
  }

  // Directory mode: simple message
  if (diffSource.type === 'directory') {
    return (
      <div
        className='flex-1 flex items-center justify-center p-8'
        data-testid='empty-diff-help'
      >
        <div className='max-w-lg space-y-6'>
          <h2 className='text-lg font-semibold text-foreground text-center'>
            No files found
          </h2>
          <p className='text-sm text-muted-foreground text-center'>
            No files found in the selected directory{' '}
            <code className='px-1 py-0.5 rounded bg-muted text-xs font-mono'>
              {diffSource.sourcePath}
            </code>
            . The directory may be empty or all files may be excluded by
            ignore rules.
          </p>
        </div>
      </div>
    );
  }

  // Git mode: detailed help with examples
  return (
    <div
      className='flex-1 flex items-center justify-center p-8'
      data-testid='empty-diff-help'
    >
      <div className='max-w-lg space-y-6'>
        <h2 className='text-lg font-semibold text-foreground text-center'>
          No changes found
        </h2>
        <p className='text-sm text-muted-foreground'>
          All arguments are passed directly to{' '}
          <code className='px-1 py-0.5 rounded bg-muted text-xs font-mono'>
            git diff
          </code>
          .
          {diffSource.gitDiffArgs && (
            <span>
              {' '}
              The arguments{' '}
              <code className='px-1 py-0.5 rounded bg-muted text-xs font-mono'>
                {diffSource.gitDiffArgs}
              </code>{' '}
              were passed to git diff. Try different arguments to see your
              changes.
            </span>
          )}
        </p>
        <div>
          <h3 className='text-sm font-medium text-foreground mb-3'>
            Common usage examples:
          </h3>
          <table className='w-full text-sm'>
            <tbody className='text-muted-foreground'>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                  self-review
                </td>
                <td className='py-1.5'>
                  Unstaged working tree changes (default)
                </td>
              </tr>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                  self-review --staged
                </td>
                <td className='py-1.5'>Changes staged for commit</td>
              </tr>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                  self-review HEAD~1
                </td>
                <td className='py-1.5'>Changes in the last commit</td>
              </tr>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                  self-review main..HEAD
                </td>
                <td className='py-1.5'>
                  All changes since branching from main
                </td>
              </tr>
              <tr>
                <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                  self-review -- src/
                </td>
                <td className='py-1.5'>Limit diff to a specific directory</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
