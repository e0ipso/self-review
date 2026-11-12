import { createDesktopLocalization } from '../shared/localization';
import { ReviewPublishError } from '../../packages/core/src/review-publisher';
import type { ReviewPublishErrorCode } from '../../packages/core/src/review-publisher';

export type SaveFailureCode = ReviewPublishErrorCode | 'no-review-state';

export interface SaveFailure {
  code: SaveFailureCode;
  message: string;
  detail: string;
}

const NEXT_STEP: Record<SaveFailureCode, string> = {
  'validation-failed': 'The review was not written. Fix the problems listed above and save again.',
  'xml-illegal-character':
    'The review was not written. Remove the character named above from that comment and save again.',
  'output-is-directory':
    'Click Change... in the file tree to pick another output path, then save again.',
  'permission-denied':
    'Click Change... in the file tree to pick another output path, then save again.',
  'no-space': 'Free some disk space, or click Change... in the file tree to save elsewhere.',
  'unsafe-link': 'Click Change... in the file tree to pick another output path, then save again.',
  'unsupported-target':
    'Click Change... in the file tree to pick another output path, then save again.',
  'attachment-unavailable':
    'Click Change... to save next to the resumed review, or remove that attachment, then save again.',
  'io-error': 'The review is still open. Try saving again, or click Change... to save elsewhere.',
  'no-review-state': 'The review is still open. Try saving again.',
};

/** `outputPath` names the file when the error carries no path of its own. */
export function describeSaveFailure(
  error: unknown,
  outputPath: string | null,
  messages = createDesktopLocalization()
): SaveFailure {
  if (error instanceof ReviewPublishError) {
    const lines = [`Code: ${error.code}`, `Path: ${error.path}`];
    if (error.details.length > 0) lines.push('', ...error.details);
    lines.push('', messages.t(NEXT_STEP[error.code]));
    return { code: error.code, message: error.message, detail: lines.join('\n') };
  }
  const message = error instanceof Error ? error.message : String(error);
  const lines = ['Code: io-error'];
  if (outputPath) lines.push(`Path: ${outputPath}`);
  lines.push('', messages.t(NEXT_STEP['io-error']));
  return {
    code: 'io-error',
    message: messages.t('Could not save the review: {message}', { message }),
    detail: lines.join('\n'),
  };
}
