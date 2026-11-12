/** Only exact application messages enter the catalog. Forge/command text stays plain text,
 * including braces and markup, and is bounded before display. No wire format is inferred. */
const applicationMessages = new Set([
  'Not a recognized PR/MR URL. Expected a GitHub pull request (…/pull/N) or GitLab merge request (…/-/merge_requests/N) URL.',
  'Failed to open remote PR/MR',
  'Review cancelled.',
  'Opening the PR/MR was cancelled.',
  'Enter a GitHub PR or GitLab MR URL.',
  'The desktop operation timed out.',
  'opening the PR/MR took longer than 10 minutes',
  'the review window closed',
  'The review window closed.',
  'The review window was replaced.',
  'A remote review is already open or closing.',
  'A review is already open.',
  'A review is already being opened.',
  'The review session has changed.',
  'The review is finishing.',
  'Review content exceeds desktop delivery limits.',
]);
const cancellation = 'Opening the PR/MR was cancelled: ';

export function remoteOpenFailure(message: string, t: (source: string) => string): string {
  if (applicationMessages.has(message)) return t(message);
  if (message.startsWith(cancellation)) {
    const reason = message.slice(cancellation.length);
    return `${t('Opening the PR/MR was cancelled.')} ${applicationMessages.has(reason) ? t(reason) : externalDiagnostic(reason)}`;
  }
  return externalDiagnostic(message);
}

function externalDiagnostic(message: string): string {
  // Preserve useful external diagnostics without displaying URL credentials or common token
  // assignments. They never pass through the message formatter or an HTML/Markdown renderer.
  return message
    .slice(0, 2048)
    .replace(/(https?:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, '$1[redacted]@')
    .replace(
      /((?:access_token|private_token|token|authorization)[=:]\s*)(?:bearer\s+)?[^\s&]+/gi,
      '$1[redacted]'
    )
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:gh[pousr]_[a-z\d_]+|github_pat_[a-z\d_]+|glpat-[a-z\d_-]+)/gi, '[redacted]');
}
