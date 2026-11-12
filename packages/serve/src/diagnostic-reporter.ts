import { format } from 'node:util';

/** Reporter failures never change publication, transport responses or cleanup. */
export function nonThrowingReporter(report?: (message: string) => void) {
  return (message: string, ...details: unknown[]): void => {
    try {
      const result = report
        ? report(format(message, ...details))
        : console.error(message, ...details);
      void Promise.resolve(result).catch(() => {});
    } catch {
      // Diagnostics are observational, including asynchronously rejecting hosts.
    }
  };
}
