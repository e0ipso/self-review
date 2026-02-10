import React from 'react';
import type { LineRange } from '../../../shared/types';

export interface CommentInputProps {
  filePath: string;
  lineRange: LineRange | null;
  onCancel: () => void;
  onSubmit?: () => void;
}

export default function CommentInput({ onCancel }: CommentInputProps) {
  return (
    <div data-testid="comment-input">
      <p>CommentInput placeholder</p>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
