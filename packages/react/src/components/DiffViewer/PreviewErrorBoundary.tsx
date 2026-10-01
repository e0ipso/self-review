import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

export interface PreviewErrorBoundaryProps {
  /** The file whose content is rendered below; named in the fallback. */
  filePath: string;
  /**
   * Values the rendered content depends on (the file object, the view mode).
   * When any of them changes, a caught error is cleared and the children
   * render again, so new content or a different view gets a fresh attempt.
   */
  resetKeys: ReadonlyArray<unknown>;
  children: React.ReactNode;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
}

function resetKeysChanged(previous: ReadonlyArray<unknown>, next: ReadonlyArray<unknown>) {
  return previous.length !== next.length || previous.some((key, i) => !Object.is(key, next[i]));
}

/**
 * Contains a render failure to one file's content. Without it, an exception
 * thrown while rendering any single preview (hostile Markdown, a renderer
 * bug) unmounts the whole review, taking the file tree, the toolbar and the
 * Finish Review control with it. The fallback names the file so the reviewer
 * knows which one could not be shown; the rest of the review stays usable.
 */
export default class PreviewErrorBoundary extends React.Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): PreviewErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error(
      `[self-review] Preview for ${JSON.stringify(this.props.filePath)} failed to render:`,
      error,
      info.componentStack ?? ''
    );
  }

  componentDidUpdate(previousProps: PreviewErrorBoundaryProps): void {
    if (this.state.error && resetKeysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role='alert'
        data-testid='preview-error'
        className='m-3 flex items-start gap-2 text-destructive text-sm p-3 border border-destructive/20 rounded'
      >
        <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' aria-hidden='true' />
        <div className='min-w-0 flex-1 space-y-1'>
          <p>
            This file could not be displayed:{' '}
            <code className='font-mono break-all'>{this.props.filePath}</code>
          </p>
          <p className='text-xs text-muted-foreground break-words'>{error.message}</p>
          <p className='text-xs text-muted-foreground'>The rest of the review is unaffected.</p>
        </div>
        <Button variant='outline' size='sm' onClick={this.retry}>
          Try again
        </Button>
      </div>
    );
  }
}
