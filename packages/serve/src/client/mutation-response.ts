// A successful HTTP status alone cannot settle an on-disk mutation.
import type { SuggestionApplyOutcome, SuggestionApplyRequest } from '@self-review/core';
import { ServeRequestError } from './request-error';
import type { ReviewSubmitAck } from '../protocol';
import { isRecord } from './json-client';

export async function decodeApplyResponse(
  response: Response,
  request: SuggestionApplyRequest
): Promise<SuggestionApplyOutcome> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    value = null;
  }
  if (isRecord(value) && value.filePath === request.filePath) {
    if (
      value.status === 'applied' &&
      typeof value.replacedLines === 'number' &&
      Number.isSafeInteger(value.replacedLines) &&
      value.replacedLines >= 0
    ) {
      return value as unknown as SuggestionApplyOutcome;
    }
    if (
      value.status === 'refused' &&
      typeof value.reason === 'string' &&
      typeof value.detail === 'string'
    ) {
      return value as unknown as SuggestionApplyOutcome;
    }
  }
  throw new ServeRequestError(
    'The server did not return a valid Apply outcome for this file. Inspect the destination before continuing; do not apply again blindly.',
    { status: response.status, code: 'outcome-unknown', uncertain: true }
  );
}

// Preserve the publication acknowledgement contract used by existing peers.
export async function decodePublicationResponse(response: Response): Promise<void> {
  const ack = (await response.json()) as ReviewSubmitAck | null;
  if (!isRecord(ack) || ack.ok !== true) {
    throw new ServeRequestError(
      'The server answered without acknowledging the review as written. ' +
        'Check the terminal and output file before continuing; do not resend blindly.',
      { status: response.status, code: 'outcome-unknown', uncertain: true }
    );
  }
}
