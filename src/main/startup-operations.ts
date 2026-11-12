// Environment and engine selection for desktop startup, bound by main.
import { parseCliArgs } from './cli';
import { loadConfigWithProvenance } from '../../packages/core/src/config';
import { resolveStartupSourceAsync } from '../../packages/core/src/startup-mode';
import {
  loadLocalReview,
  loadResumeDocument,
  resolveOutputTarget,
  resolveStartupDiffArgs,
} from '../../packages/core/src/startup';
import { bootstrapRemoteDiff } from '../../packages/core/src/remote-mode';
import { loadGuide } from '../../packages/core/src/guide-loader';

async function prepare(cwd: string, signal: AbortSignal) {
  const cli = parseCliArgs();
  const loadedConfig = loadConfigWithProvenance({ cwd });
  const output = resolveOutputTarget(null, loadedConfig, cwd);
  const { config, gitDiffArgs } = resolveStartupDiffArgs(cli.gitDiffArgs, loadedConfig, cwd);
  const source = cli.remoteUrl
    ? { mode: 'remote' as const }
    : await resolveStartupSourceAsync(gitDiffArgs, cwd, { signal, timeoutMs: 30_000 });
  return {
    config,
    gitDiffArgs,
    source,
    output,
    remoteUrl: cli.remoteUrl,
    resumeFrom: cli.resumeFrom,
  };
}
export type StartupPlan = Awaited<ReturnType<typeof prepare>>;
export interface StartupOperations {
  prepare: typeof prepare;
  loadLocal: (
    plan: StartupPlan,
    cwd: string,
    signal: AbortSignal
  ) => ReturnType<typeof loadLocalReview>;
  loadRemote: (
    url: string,
    cwd: string,
    ignore: string[],
    signal: AbortSignal
  ) => ReturnType<typeof bootstrapRemoteDiff>;
  /** Awaitable binding for async resume implementations. The current core parser is synchronous. */
  resume: (
    session: Parameters<typeof loadResumeDocument>[0],
    path: string,
    signal?: AbortSignal
  ) => ReturnType<typeof loadResumeDocument> | Promise<ReturnType<typeof loadResumeDocument>>;
  guide: typeof loadGuide;
  reportDiagnostic: (message: string) => void;
}
export const defaultStartupOperations: StartupOperations = {
  prepare,
  loadLocal: (plan, cwd, signal) => {
    if (plan.source.mode === 'remote')
      throw new Error('Remote startup requires its lifetime owner.');
    return loadLocalReview(
      plan.source,
      plan.gitDiffArgs,
      plan.config,
      cwd,
      message => console.error(`[main] ${message}`),
      { signal, timeoutMs: 30_000 }
    );
  },
  loadRemote: (url, cwd, ignore, signal) => bootstrapRemoteDiff(url, cwd, ignore, {}, { signal }),
  resume: loadResumeDocument,
  guide: loadGuide,
  reportDiagnostic: message => console.error(message),
};
