import React from 'react';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';

export interface SuggestionPanelProps {
  originalCode: string;
  proposedCode: string;
  onProposedChange: (code: string) => void;
  onSubmit: () => void;
}

export function SuggestionPanel({
  originalCode,
  proposedCode,
  onProposedChange,
  onSubmit,
}: SuggestionPanelProps) {
  return (
    <>
      <Separator />
      <div className='p-3 space-y-2 bg-muted/20'>
        <div data-testid='suggestion-original'>
          <label className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block'>
            Original
          </label>
          <Textarea
            value={originalCode}
            disabled
            className='font-mono text-xs bg-muted/30 resize-none'
            rows={3}
          />
        </div>
        <div data-testid='suggestion-proposed'>
          <label className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block'>
            Suggested
          </label>
          <Textarea
            value={proposedCode}
            onChange={e => onProposedChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder='Enter your suggested code...'
            className='font-mono text-xs resize-y'
            rows={3}
          />
        </div>
      </div>
    </>
  );
}
