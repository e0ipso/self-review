import { SERVER_BUSY_ERROR } from '../protocol';

/** Old servers had no machine code. Only their exact supported 503 body is safe. */
export function isLegacyBusyResponse(status: number, body: Record<string, unknown>): boolean {
  return status === 503 && !('code' in body) && body.error === SERVER_BUSY_ERROR;
}
