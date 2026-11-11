/** A request the server refused, or one this adapter refused to send. */
export class ServeRequestError extends Error {
  /** Null when no HTTP response was received, including local refusals. */
  readonly status: number | null;
  /** Publisher, local budget or transport failure code, otherwise null. */
  readonly code: string | null;
  readonly details: readonly string[];
  readonly uncertain: boolean;

  constructor(
    message: string,
    options: {
      status: number | null;
      code?: string | null;
      details?: readonly string[];
      uncertain?: boolean;
    }
  ) {
    super(message);
    this.name = 'ServeRequestError';
    this.status = options.status;
    this.code = options.code ?? null;
    this.details = options.details ?? [];
    this.uncertain = options.uncertain ?? false;
  }
}
