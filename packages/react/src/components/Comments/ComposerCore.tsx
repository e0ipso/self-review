import React, { useState, useEffect, useRef, useCallback } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import type { Attachment } from '@self-review/types';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Paperclip } from 'lucide-react';
import EmojiAutocomplete from './EmojiAutocomplete';
import AttachmentThumbnail from './AttachmentThumbnail';
import { useEmojiAutocomplete } from '../../hooks/useEmojiAutocomplete';
import { processImageFile } from '../../utils/image-utils';
import { AttachmentDropZone } from './AttachmentDropZone';

/**
 * Shared composer body used by every markdown editor in the review UI.
 *
 * It owns the drop zone, the MDEditor, emoji autocomplete, the attachment
 * thumbnail strip and the auto-focus/keyboard behaviour. It owns no submit
 * semantics: the parent decides what "submit" means and supplies its own
 * actions bar (and anything else that belongs below the editor) via `children`.
 *
 * Intentionally NOT exported from the package entry point — it is an internal
 * composition detail of `CommentInput` and `ReplyInput`, not public API.
 */
export interface ComposerCoreProps {
  body: string;
  onBodyChange: (body: string) => void;
  attachments: Attachment[];
  /**
   * The parent's `useState` setter. Passed as a setter rather than a plain
   * value callback so appends stay functional updates, which keeps
   * concurrent paste/drop/file-picker attachments from clobbering each other.
   */
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  placeholder: string;
  /** Rendered as an MDEditor extra command, e.g. the "Comment on line 5" label. */
  headerLabel?: React.ReactNode;
  onSubmit: () => void;
  /** `data-testid` of the wrapping element. */
  testId: string;
  /**
   * Element focused when Escape leaves the editor, i.e. the parent's actions
   * bar. When absent (or unmounted) Escape simply blurs the editor.
   */
  actionsRef?: React.RefObject<HTMLElement | null>;
  height?: number;
  /** Rendered inside the wrapper, below the attachment strip. */
  children?: React.ReactNode;
}

export function ComposerCore({
  body,
  onBodyChange,
  attachments,
  setAttachments,
  placeholder,
  headerLabel,
  onSubmit,
  testId,
  actionsRef,
  height = 240,
  children,
}: ComposerCoreProps) {
  const { config } = useConfig();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const emoji = useEmojiAutocomplete(body, onBodyChange, editorContainerRef);

  const handleAttach = useCallback((newAttachments: Attachment[]) => {
    setAttachments(prev => [...prev, ...newAttachments]);
  }, [setAttachments]);

  useEffect(() => {
    // Auto-focus the editor textarea when the composer mounts
    const textarea = editorContainerRef.current?.querySelector<HTMLTextAreaElement>('.w-md-editor-text-input');
    textarea?.focus();
  }, []);

  const resolveIsDark = () => {
    if (config.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return config.theme === 'dark';
  };

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm overflow-hidden relative ${isDragging ? 'border-primary border-2' : 'border-foreground/15'}`}
      data-testid={testId}
    >
      <AttachmentDropZone
        onAttach={handleAttach}
        isDragging={isDragging}
        onDragChange={setIsDragging}
      >
        <div className='p-1 relative' data-color-mode={resolveIsDark() ? 'dark' : 'light'} ref={editorContainerRef}>
          <MDEditor
            value={body}
            onChange={(val) => onBodyChange(val || '')}
            preview='edit'
            highlightEnable={false}
            commands={[
              commands.bold, commands.italic,
              commands.divider,
              commands.quote, commands.code, commands.link,
              commands.divider,
              commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand,
            ]}
            extraCommands={headerLabel ? [{
              name: 'header-label',
              keyCommand: 'header-label',
              render: () => <>{headerLabel}</>,
            }] : []}
            textareaProps={{
              placeholder,
              onKeyDown: (e) => {
                // Let emoji autocomplete handle keys first when dropdown is open
                if (emoji.onKeyDown(e)) return;

                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  onSubmit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  const actions = actionsRef?.current;
                  if (actions) {
                    actions.focus();
                  } else {
                    (e.target as HTMLElement).blur();
                  }
                }
              },
              onPaste: undefined,
            }}
            height={height}
            className='md-editor-comment'
          />
          <EmojiAutocomplete
            isOpen={emoji.isOpen}
            results={emoji.results}
            selectedIndex={emoji.selectedIndex}
            position={emoji.position}
            onSelect={emoji.selectEmoji}
            onHover={emoji.setSelectedIndex}
          />
        </div>
      </AttachmentDropZone>

      {attachments.length > 0 && (
        <div className='flex gap-2 flex-wrap px-3 py-2 border-t border-border/50'>
          {attachments.map((att) => (
            <AttachmentThumbnail
              key={att.id}
              attachment={att}
              onRemove={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
            />
          ))}
          <span className='self-center text-[11px] text-muted-foreground'>
            {attachments.length} {attachments.length === 1 ? 'image' : 'images'}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}

export interface AttachButtonProps {
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
}

/**
 * The composer's file picker: the visible "Attach" affordance and the hidden
 * `<input type='file'>` it drives, kept together so neither half can drift.
 * Rendered by the parent so it can sit in the parent's own actions bar.
 */
export function AttachButton({ setAttachments }: AttachButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => fileInputRef.current?.click()}
        className='h-7 gap-1.5 text-xs'
      >
        <Paperclip className='h-3.5 w-3.5' />
        Attach
      </Button>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        multiple
        className='hidden'
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            Promise.all(files.map(processImageFile))
              .then(newAttachments => setAttachments(prev => [...prev, ...newAttachments]))
              .catch(err => console.error('Failed to attach image:', err));
          }
          e.target.value = '';
        }}
      />
    </>
  );
}
