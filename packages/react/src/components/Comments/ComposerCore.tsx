import { useLocalization, type MessageKey } from '../../localization/LocalizationContext';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor';
import type { Attachment } from '@self-review/types';
import { useAppearance } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Paperclip } from 'lucide-react';
import EmojiAutocomplete from './EmojiAutocomplete';
import AttachmentThumbnail from './AttachmentThumbnail';
import { useEmojiAutocomplete } from '../../hooks/useEmojiAutocomplete';
import { useImageAttachments } from '../../hooks/useImageAttachments';
import {
  AttachmentProcessingContext,
  AttachmentProcessingStatus,
  useAttachmentProcessing,
} from './AttachmentProcessing';
import { AttachmentDropZone } from './AttachmentDropZone';

// Preserve native execute, shortcuts and selection behavior while localizing presentation.
const EDITOR_COMMANDS: ReadonlyArray<readonly [ICommand, MessageKey?]> = [
  [commands.bold, 'Add bold text (ctrl + b)'],
  [commands.italic, 'Add italic text (ctrl + i)'],
  [commands.divider],
  [commands.quote, 'Insert a quote (ctrl + q)'],
  [commands.code, 'Insert code (ctrl + j)'],
  [commands.link, 'Add a link (ctrl + l)'],
  [commands.divider],
  [commands.unorderedListCommand, 'Add unordered list (ctrl + shift + u)'],
  [commands.orderedListCommand, 'Add ordered list (ctrl + shift + o)'],
  [commands.checkedListCommand, 'Add checked list (ctrl + shift + c)'],
];

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
  attachmentOwner?: string;
  onProcessingChange?: (pending: boolean) => void;
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
  attachmentOwner,
  onProcessingChange,
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
  const { t } = useLocalization();
  const editorCommands = useMemo(
    () =>
      EDITOR_COMMANDS.map(([command, label]) => ({
        ...command,
        buttonProps: label
          ? { ...command.buttonProps, 'aria-label': t(label), title: t(label) }
          : command.buttonProps,
        // Toolbar buttons carry names; decorative SVGs must not announce as images.
        icon: command.icon
          ? React.cloneElement(command.icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
              'aria-hidden': true,
              focusable: false,
            })
          : undefined,
      })),
    [t]
  );
  const config = useAppearance();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const emoji = useEmojiAutocomplete(body, onBodyChange, editorContainerRef);

  const handleAttach = useCallback(
    (newAttachments: Attachment[]) => {
      setAttachments(prev => [...prev, ...newAttachments]);
    },
    [setAttachments]
  );

  const ingestion = useImageAttachments({
    onAttach: handleAttach,
    attachments,
    owner: attachmentOwner,
    onProcessingChange,
  });

  useEffect(() => {
    // Auto-focus the editor textarea when the composer mounts
    const textarea =
      editorContainerRef.current?.querySelector<HTMLTextAreaElement>('.w-md-editor-text-input');
    textarea?.focus();
  }, []);

  const resolveIsDark = () => {
    if (config.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return config.theme === 'dark';
  };

  return (
    <AttachmentProcessingContext.Provider value={ingestion}>
      <div
        className={`rounded-lg border bg-card shadow-sm overflow-hidden relative ${isDragging ? 'border-primary border-2' : 'border-foreground/15'}`}
        data-testid={testId}
      >
        <AttachmentDropZone
          onAttach={handleAttach}
          isDragging={isDragging}
          onDragChange={setIsDragging}
        >
          <div
            className='p-1 relative'
            data-color-mode={resolveIsDark() ? 'dark' : 'light'}
            ref={editorContainerRef}
          >
            <MDEditor
              value={body}
              onChange={val => onBodyChange(val || '')}
              preview='edit'
              highlightEnable={false}
              commands={editorCommands}
              extraCommands={
                headerLabel
                  ? [
                      {
                        name: 'header-label',
                        keyCommand: 'header-label',
                        render: () => <>{headerLabel}</>,
                      },
                    ]
                  : []
              }
              textareaProps={{
                ...emoji.textareaProps,
                placeholder,
                'aria-label': placeholder,
                onKeyDown: e => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  // Let emoji autocomplete handle keys first when dropdown is open
                  if (emoji.onKeyDown(e)) return;

                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (!ingestion.pending) onSubmit();
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
              popupId={emoji.popupId}
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
            {attachments.map(att => (
              <AttachmentThumbnail
                key={att.id}
                attachment={att}
                onRemove={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
              />
            ))}
            <span className='self-center text-[11px] text-muted-foreground'>
              {t('images', { count: attachments.length })}
            </span>
          </div>
        )}

        <AttachmentProcessingStatus ingestion={ingestion} />
        {children}
      </div>
    </AttachmentProcessingContext.Provider>
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
  const { t } = useLocalization();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shared = useAttachmentProcessing();
  const local = useImageAttachments({
    onAttach: images => setAttachments(previous => [...previous, ...images]),
  });
  const ingestion = shared ?? local;

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
        {t('Attach')}
      </Button>
      {!shared && <AttachmentProcessingStatus ingestion={local} />}
      <input
        ref={fileInputRef}
        type='file'
        aria-label={t('Attach')}
        hidden
        accept='image/*'
        multiple
        className='hidden'
        onChange={e => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            ingestion.enqueue(files);
          }
          e.target.value = '';
        }}
      />
    </>
  );
}
