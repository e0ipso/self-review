// Presentation must not replace an operation's result or interrupt mandatory cleanup.
import { stderrReporter, type DiagnosticReporter } from './diagnostics';

export function isolatedReporter(report: DiagnosticReporter = stderrReporter): DiagnosticReporter {
  return (message, detail) => {
    try {
      if (detail === undefined) report(message);
      else report(message, detail);
    } catch {
      /* The operation owns its outcome independently of diagnostic presentation. */
    }
  };
}
