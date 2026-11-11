/** Per-call diagnostic output. A second string preserves the submitted-state summary's call form. */
export type DiagnosticReporter = (message: string, detail?: string) => void;

/** Compatibility default for hosts that have not supplied their own diagnostic presentation. */
export const stderrReporter: DiagnosticReporter = (message, detail) => {
  if (detail === undefined) console.error(message);
  else console.error(message, detail);
};
