import { useLocalization } from '../../localization/LocalizationContext';
import React from 'react';
import type { DiffSource } from '@self-review/types';
import { DiffDiagnostics } from './DiffDiagnostics';

export interface EmptyDiffMessageProps {
  diffSource: DiffSource;
  /** Why nothing loaded; a non-empty list is a failed load, never "no changes". */
  diagnostics?: string[];
}

export function EmptyDiffMessage({ diffSource, diagnostics = [] }: EmptyDiffMessageProps) {
  const { t } = useLocalization();
  // Loading/welcome mode: don't render empty state (App.tsx handles these)
  if (diffSource.type === 'welcome' || diffSource.type === 'loading') {
    return null;
  }

  if (diagnostics.length > 0) {
    return (
      <div className='flex-1 flex items-center justify-center p-8' data-testid='empty-diff-help'>
        <div className='max-w-lg w-full space-y-4'>
          <h2 className='text-lg font-semibold text-foreground text-center'>
            {t('The review could not be loaded')}
          </h2>
          <DiffDiagnostics
            diagnostics={diagnostics}
            title={t('The diff could not be read in a form self-review can review')}
          />
        </div>
      </div>
    );
  }

  // File mode: error message (shouldn't normally happen)
  if (diffSource.type === 'file') {
    return (
      <div className='flex-1 flex items-center justify-center p-8' data-testid='empty-diff-help'>
        <div className='max-w-lg space-y-6'>
          <h2 className='text-lg font-semibold text-foreground text-center'>
            {t('Could not read file')}
          </h2>
          <p className='text-sm text-muted-foreground text-center'>
            {t('The file {path} could not be read or is empty.', { path: diffSource.sourcePath })}
          </p>
        </div>
      </div>
    );
  }

  // Directory mode: simple message
  if (diffSource.type === 'directory') {
    return (
      <div className='flex-1 flex items-center justify-center p-8' data-testid='empty-diff-help'>
        <div className='max-w-lg space-y-6'>
          <h2 className='text-lg font-semibold text-foreground text-center'>
            {t('No files found')}
          </h2>
          <p className='text-sm text-muted-foreground text-center'>
            {t(
              'No files found in the selected directory {path}. The directory may be empty or all files may be excluded by ignore rules.',
              { path: diffSource.sourcePath }
            )}
          </p>
        </div>
      </div>
    );
  }

  // Git mode: detailed help with examples
  return (
    <div className='flex-1 flex items-center justify-center p-8' data-testid='empty-diff-help'>
      <div className='max-w-lg space-y-6'>
        <h2 className='text-lg font-semibold text-foreground text-center'>
          {t('No changes found')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('All arguments are passed directly to git diff.')}
          {diffSource.gitDiffArgs && (
            <span>
              {' '}
              {t(
                'The arguments {args} were passed to git diff. Try different arguments to see your changes.',
                { args: diffSource.gitDiffArgs }
              )}
            </span>
          )}
        </p>
        <div>
          <h3 className='text-sm font-medium text-foreground mb-3'>
            {t('Common usage examples:')}
          </h3>
          <table className='w-full text-sm'>
            <tbody className='text-muted-foreground'>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pe-4 font-mono text-xs text-foreground'>self-review</td>
                <td className='py-1.5'>{t('Unstaged working tree changes (default)')}</td>
              </tr>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pe-4 font-mono text-xs text-foreground'>
                  self-review --staged
                </td>
                <td className='py-1.5'>{t('Changes staged for commit')}</td>
              </tr>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pe-4 font-mono text-xs text-foreground'>
                  self-review HEAD~1
                </td>
                <td className='py-1.5'>{t('Changes in the last commit')}</td>
              </tr>
              <tr className='border-b border-border/50'>
                <td className='py-1.5 pe-4 font-mono text-xs text-foreground'>
                  self-review main..HEAD
                </td>
                <td className='py-1.5'>{t('All changes since branching from main')}</td>
              </tr>
              <tr>
                <td className='py-1.5 pe-4 font-mono text-xs text-foreground'>
                  self-review -- src/
                </td>
                <td className='py-1.5'>{t('Limit diff to a specific directory')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
