import { parseDiffSteps, type DiffParseResult } from './diff-parser-core';
import { loadingCheckpoint, checkLoadingCancelled } from './local-loading-lifetime';

/**
 * Parse captured patch output cooperatively. Rejects with CommandCancelledError on abort and
 * never exposes partial files. Input and the resulting AST remain in memory. Individual string
 * operations and one line's parsing cannot be preempted; checkpoints bound scanning and groups
 * of lines, not the CPU time of a pathological header or a single very long line.
 */
export async function parseDiffWithDiagnosticsAsync(
  rawDiff: string,
  options: { signal?: AbortSignal } = {}
): Promise<DiffParseResult> {
  checkLoadingCancelled(options.signal);
  const parser = parseDiffSteps(rawDiff);
  try {
    let step = parser.next();
    while (!step.done) {
      await loadingCheckpoint(options.signal);
      step = parser.next();
    }
    checkLoadingCancelled(options.signal);
    return step.value;
  } finally {
    parser.return({ files: [], diagnostics: [] });
  }
}
