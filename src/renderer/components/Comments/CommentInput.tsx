import React, { useState, useEffect, useRef } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import type {
  Attachment,
  LineRange,
  ReviewComment,
  Suggestion,
} from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Code2, Paperclip, X } from 'lucide-react';
import CategorySelector from './CategorySelector';

async function resizeImageIfNeeded(blob: Blob, maxDimension = 1920): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width <= maxDimension && img.height <= maxDimension) {
        resolve(blob);
        return;
      }
      const scale = Math.min(maxDimension / img.width, maxDimension / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((resized) => resolve(resized || blob), blob.type);
    };
    img.src = url;
  });
}

async function processImageFile(file: File | Blob): Promise<Attachment> {
  const resized = await resizeImageIfNeeded(file);
  const arrayBuffer = await resized.arrayBuffer();
  const mediaType = file.type || 'image/png';
  const ext = mediaType.split('/')[1] || 'png';
  return {
    id: crypto.randomUUID(),
    fileName: `image.${ext}`,
    mediaType,
    data: arrayBuffer,
  };
}

export interface CommentInputProps {
  filePath: string;
  lineRange: LineRange | null;
  onCancel: () => void;
  onSubmit?: () => void;
  existingComment?: ReviewComment;
  originalCode?: string;
}

export default function CommentInput({
  filePath,
  lineRange,
  onCancel,
  onSubmit,
  existingComment,
  originalCode,
}: CommentInputProps) {
  const { addComment, editComment } = useReview();
  const { config } = useConfig();
  const defaultCategory = config.categories?.[0]?.name ?? '';
  const [body, setBody] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [proposedCode, setProposedCode] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingComment) {
      setBody(existingComment.body);
      setCategory(existingComment.category || defaultCategory);
      if (existingComment.suggestion) {
        setShowSuggestion(true);
        setProposedCode(existingComment.suggestion.proposedCode);
      }
      if (existingComment.attachments) {
        setAttachments(existingComment.attachments);
      }
    }
  }, [existingComment]);

  const isValid = body.trim().length > 0 && category.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;

    const suggestion: Suggestion | null =
      showSuggestion && originalCode
        ? {
            originalCode,
            proposedCode,
          }
        : null;

    if (existingComment) {
      editComment(existingComment.id, {
        body,
        category,
        suggestion,
        ...(attachments.length ? { attachments } : {}),
      });
    } else {
      addComment(filePath, lineRange, body, category, suggestion, attachments.length ? attachments : undefined);
    }

    setBody('');
    setCategory(defaultCategory);
    setShowSuggestion(false);
    setProposedCode('');
    setAttachments([]);
    onSubmit?.();
  };

  const handleCancel = () => {
    setBody('');
    setCategory(defaultCategory);
    setShowSuggestion(false);
    setProposedCode('');
    setAttachments([]);
    onCancel();
  };

  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div
      className='rounded-lg border border-border bg-card shadow-sm overflow-hidden'
      data-testid='comment-input'
    >
      <div className='p-1' data-color-mode={isDark ? 'dark' : 'light'}>
        <MDEditor
          value={body}
          onChange={(val) => setBody(val || '')}
          preview='edit'
          highlightEnable={false}
          commands={[
            commands.bold, commands.italic,
            commands.divider,
            commands.quote, commands.code, commands.link,
            commands.divider,
            commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand,
          ]}
          extraCommands={lineRange ? [{
            name: 'line-range',
            keyCommand: 'line-range',
            render: () => (
              <span className='text-xs font-medium text-muted-foreground whitespace-nowrap'>
                {lineRange.start === lineRange.end
                  ? `Comment on line ${lineRange.start}`
                  : `Comment on lines ${lineRange.start} to ${lineRange.end}`}
              </span>
            ),
          }] : []}
          textareaProps={{
            placeholder: 'Add your review comment...',
            onKeyDown: (e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            },
            onPaste: (e: React.ClipboardEvent) => {
              const items = Array.from(e.clipboardData.items);
              const imageItem = items.find(item => item.type.startsWith('image/'));
              if (imageItem) {
                e.preventDefault();
                const file = imageItem.getAsFile();
                if (file) {
                  processImageFile(file).then(attachment => {
                    setAttachments(prev => [...prev, attachment]);
                  });
                }
              }
            },
          }}
          height={240}
          className='md-editor-comment'
        />
      </div>

      {attachments.length > 0 && (
        <div className='flex gap-2 flex-wrap px-3 py-2'>
          {attachments.map((att) => (
            <div key={att.id} className='relative group'>
              <img
                src={att.data ? URL.createObjectURL(new Blob([att.data])) : ''}
                alt='Attachment preview'
                className='h-16 w-16 object-cover rounded border'
              />
              <Button
                variant='ghost'
                size='icon'
                className='absolute -top-2 -right-2 h-5 w-5 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100'
                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
              >
                <X className='h-3 w-3' />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showSuggestion && originalCode && (
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
                onChange={e => setProposedCode(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder='Enter your suggested code...'
                className='font-mono text-xs resize-y'
                rows={3}
              />
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Actions bar */}
      <div className='flex items-center justify-between px-3 py-2 bg-muted/10'>
        <div className='flex items-center gap-2'>
          <CategorySelector value={category} onChange={setCategory} />
          {originalCode && (
            <Button
              type='button'
              variant={showSuggestion ? 'secondary' : 'ghost'}
              size='sm'
              data-testid='add-suggestion-btn'
              onClick={() => setShowSuggestion(!showSuggestion)}
              className='h-7 gap-1.5 text-xs'
            >
              <Code2 className='h-3.5 w-3.5' />
              {showSuggestion ? 'Remove suggestion' : 'Suggest'}
            </Button>
          )}
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
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              const newAttachments = await Promise.all(files.map(processImageFile));
              setAttachments(prev => [...prev, ...newAttachments]);
              e.target.value = '';
            }}
          />
        </div>

        <div className='flex items-center gap-1.5'>
          <Button
            data-testid='cancel-comment-btn'
            variant='ghost'
            size='sm'
            onClick={handleCancel}
            className='h-7 text-xs'
          >
            Cancel
          </Button>
          <Button
            data-testid='add-comment-btn'
            size='sm'
            onClick={handleSubmit}
            disabled={!isValid}
            className='h-7 text-xs gap-1.5'
          >
            {existingComment ? 'Update' : 'Comment'}
            <kbd className='pointer-events-none inline-flex items-center rounded border border-current/20 px-1 font-mono text-[10px] font-medium opacity-60'>
              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}
              {'\u21B5'}
            </kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
