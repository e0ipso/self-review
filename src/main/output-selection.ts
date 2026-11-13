import { resolve } from 'path';
import { IPC } from '../shared/ipc-channels';
import type { OutputPathInfo } from '../shared/types';
import { inspectDesktopOutput } from './desktop-session';
import { noArgument, type createIpcBoundary } from './ipc-boundary';
import type { LifecycleSession, LifecyclePresentation } from './lifecycle-handlers';
import type { QuitController } from './quit-controller';

/** Native selection changes the target only while the requesting review remains active. */
export function registerOutputSelection(
  desktop: LifecycleSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  controller: Pick<QuitController, 'phase'>,
  presentation: Pick<LifecyclePresentation, 'pickOutputPath'>
): void {
  let generation = 0;
  boundary.handleCommand(IPC.OUTPUT_PATH_CHANGE, noArgument, event =>
    desktop.operations.read(async signal => {
      const selection = ++generation;
      const source = desktop.review.diffData;
      const previousOutput = desktop.output;
      const current = boundary.capture(event);
      const stillCurrent = () => {
        current();
        signal.throwIfAborted();
        return (
          selection === generation &&
          desktop.review.diffData === source &&
          desktop.output === previousOutput &&
          controller.phase === 'reviewing'
        );
      };
      const filePath = await presentation.pickOutputPath(
        boundary.assertPeer(event),
        desktop.output.path
      );
      if (!filePath) return null;
      if (!stillCurrent()) return null;
      const candidate = { path: resolve(filePath), origin: 'explicit' as const };
      const problem = await inspectDesktopOutput(candidate, signal);
      if (!stillCurrent()) return null;
      if (problem) console.error(`[main] Output path check (${problem.code}): ${problem.message}`);
      const info: OutputPathInfo = {
        resolvedOutputPath: candidate.path,
        outputPathWritable: problem === null,
      };
      desktop.output = candidate;
      desktop.review.outputPathInfo = info;
      boundary.assertPeer(event).webContents.send(IPC.OUTPUT_PATH_CHANGED, info);
      return info;
    }, 10 * 60_000)
  );
}
