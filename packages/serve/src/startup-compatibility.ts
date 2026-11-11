// Compatibility for @self-review/core 2.0.4, without asynchronous source detection.
// Remove the synchronous fallback when serve's published minimum core includes
// resolveStartupSourceAsync. The old probe blocks and cannot honour cancellation.
import * as core from '@self-review/core';
import type { GitExecutionOptions } from '@self-review/core';

type Source = ReturnType<typeof core.resolveStartupSource>;
interface StartupEngine {
  resolveStartupSource: typeof core.resolveStartupSource;
  resolveStartupSourceAsync?: (
    args: string[],
    cwd?: string,
    options?: GitExecutionOptions
  ) => Promise<Source>;
}
export function startupSourceFor(engine: StartupEngine) {
  return async (args: string[], cwd: string, options: GitExecutionOptions): Promise<Source> => {
    if (options.signal?.aborted) throw options.signal.reason;
    return engine.resolveStartupSourceAsync
      ? engine.resolveStartupSourceAsync(args, cwd, options)
      : engine.resolveStartupSource(args, cwd);
  };
}
export const resolveCompatibleStartupSource = startupSourceFor(core);
