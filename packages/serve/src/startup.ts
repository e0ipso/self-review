// Compatibility entry: defaults belong at the host composition edge.
import type { GitExecutionOptions } from '@self-review/core';
import type { ServeArgs } from './args';
import { createStartupHost } from './startup-composition';
import { resolveSessionWithHost, type StartupHost } from './startup-resolver';
export type { ServeStartup, StartupHost, StartupOperations } from './startup-resolver';

export function resolveSession(
  args: ServeArgs,
  options: GitExecutionOptions = {},
  host: StartupHost = createStartupHost()
) {
  return resolveSessionWithHost(args, options, host);
}
