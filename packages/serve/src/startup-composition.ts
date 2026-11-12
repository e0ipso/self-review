// Environment and installed-engine choices for the CLI and legacy programmatic defaults.
import { resolve } from 'node:path';
import * as core from '@self-review/core';
import { resolveCompatibleStartupSource } from './startup-compatibility';
import type { StartupHost } from './startup';

export function createStartupHost(
  cwd = process.cwd(),
  reportDiagnostic: (message: string) => void = message => console.error(message)
): StartupHost {
  return {
    cwd,
    reportDiagnostic,
    operations: {
      loadConfigWithProvenance: core.loadConfigWithProvenance,
      inspectOutput: output => core.inspectOutputPath(output.path, core.publishOptionsFor(output)),
      resolveSource: resolveCompatibleStartupSource,
      loadLocalReview: core.loadLocalReview,
      loadResumeDocument: core.loadResumeDocument,
      loadGuide: (output, config, files, options) =>
        // Core 2.0.4 ignores the fourth argument. Resolve the configured path here
        // as well, so that peer still reads the host's guide without changing cwd.
        core.loadGuide(
          output,
          config.guideFile
            ? { ...config, guideFile: resolve(options?.cwd ?? cwd, config.guideFile) }
            : config,
          files,
          options
        ),
    },
  };
}
