// Presentation must not replace an operation's result or interrupt mandatory cleanup.
import { stderrReporter, type DiagnosticReporter } from './diagnostics';

export function isolatedReporter(report: DiagnosticReporter = stderrReporter): DiagnosticReporter {
  return (message, detail) => {
    try {
      const result = detail === undefined ? report(message) : report(message, detail);
      void Promise.resolve(result).catch(() => {});
    } catch {
      /* The operation owns its outcome independently of diagnostic presentation. */
    }
  };
}
