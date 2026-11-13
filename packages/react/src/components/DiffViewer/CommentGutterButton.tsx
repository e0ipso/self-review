import React from 'react';
import { Button, type ButtonProps } from '../ui/button';

interface CommentGutterButtonProps extends Omit<ButtonProps, 'onMouseDown' | 'onClick'> {
  label: string;
  onStartDrag?: () => void;
  onActivate: () => void;
}

/** Pointer drag and keyboard activation are distinct, so a mouse click never submits twice. */
export function CommentGutterButton({
  label,
  onStartDrag,
  onActivate,
  className,
  onKeyDown,
  ...props
}: CommentGutterButtonProps) {
  return (
    <Button
      {...props}
      type='button'
      variant='ghost'
      size='icon'
      aria-label={label}
      data-comment-gutter
      className={`h-[22px] w-7 p-0 text-blue-600 dark:text-blue-400 focus-visible:opacity-100 ${className ?? ''}`}
      onMouseDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        (onStartDrag ?? onActivate)();
      }}
      onClick={event => {
        event.stopPropagation();
        if (event.detail === 0) onActivate();
      }}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented || props.disabled) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        onActivate();
      }}
      children={null}
    />
  );
}
