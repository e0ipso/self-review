import type { MessageKey } from './LocalizationContext';

/** Translate structured summaries only. Original host diagnostics remain visible verbatim. */
const SUMMARIES: Readonly<Record<string, MessageKey>> = {
  'no-anchor': 'A line range is required to apply this suggestion.',
  'old-side-anchor': 'Deleted lines cannot be applied to the working file.',
  'invalid-anchor': 'The suggestion has an invalid line range.',
  'destination-not-absolute': 'The destination must be an absolute path.',
  'destination-missing': 'The destination does not exist.',
  'path-escapes-destination': 'The file path is outside the destination.',
  'control-file': 'Git control files cannot be changed.',
  'unsafe-target': 'The destination file cannot be replaced safely.',
  'unsupported-target': 'Replacing the file would change its owner.',
  'file-missing': 'The file is missing from the destination.',
  'file-unreadable': 'The destination file could not be read.',
  'file-not-utf8': 'The destination file is not valid UTF-8.',
  'anchor-out-of-range': 'The line range is outside the destination file.',
  'context-mismatch': 'The original code no longer matches the destination.',
  'file-changed': 'The file changed while the suggestion was being applied.',
  'write-failed': 'The suggestion could not be written.',
  'destination-required': 'Choose a destination before applying this suggestion.',
  'no-destination': 'This review has no writable destination.',
  'not-reviewed': 'This file is not in the reviewed diff.',
  'destination-not-a-directory': 'The destination must be a directory.',
  'destination-inside-temporary-clone': 'Choose a destination outside the temporary clone.',
  'request-rejected': 'The host rejected the request before applying the proposal.',
  'host-unavailable': 'The destination could not be chosen.',
};

export function applyRefusalSummary(reason: string): MessageKey | undefined {
  return Object.prototype.hasOwnProperty.call(SUMMARIES, reason) ? SUMMARIES[reason] : undefined;
}
