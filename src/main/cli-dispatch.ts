// src/main/cli-dispatch.ts
//
// CLI dispatch, run from src/index.ts before anything imports the Electron
// main process.
//
// `fetch-comments` writes a review file and exits. No window, nothing else
// UI-bound. Two things have to hold for it to work on a machine with no
// display, and importing main.ts breaks both.
//
//   1. Nothing may load main.ts. Window creation, IPC registration, menu
//      setup and the update check are all irrelevant to writing a review file.
//   2. Chromium must not try to reach a display server. The command is async,
//      so the main script returns while the fetch is still in flight and
//      Electron carries on initializing its toolkit. On Linux the default
//      Ozone platform aborts the browser process when $DISPLAY is unset
//      (https://github.com/e0ipso/self-review/issues/143).
//
// For (2) this file selects the headless Ozone platform on the command line
// and re-execs once, the same shape relaunch-guard.ts uses for the macOS
// bundle path. Chromium reads the real argv at process start, so a switch
// placed there takes effect no matter when the main script runs relative to
// toolkit initialization. That timing is the part nobody can pin down from
// outside a packaged build.

import { spawnSync } from 'child_process';
import { checkEarlyExit, parseCliArgs } from './cli';
import type { CliArgs, EarlyExitInfo } from './cli';
import {
  reexecFromRealPathIfNeeded,
  resolveReexecExit,
} from './relaunch-guard';
import { runFetchComments } from '../../packages/core/src/fetch-comments';

/** Set on the re-execed child so the headless launch never loops. */
export const HEADLESS_GUARD_ENV = 'SELF_REVIEW_HEADLESS';

/** The one Ozone platform that needs no display server. */
export const HEADLESS_OZONE_SWITCH = '--ozone-platform=headless';

/**
 * Decide whether a headless run has to re-exec with the headless Ozone
 * platform selected.
 *
 * Ozone is a Linux/ChromeOS concern, so macOS and Windows launches skip the
 * second process. An explicit `--ozone-platform=` on the command line wins
 * over this default, because the person who typed it knows their display
 * setup better than this file does.
 *
 * @param platform `process.platform`
 * @param argv     `process.argv`
 * @param env      the process environment (for the re-exec guard)
 */
export function needsHeadlessReexec(
  platform: NodeJS.Platform,
  argv: string[],
  env: NodeJS.ProcessEnv
): boolean {
  if (platform !== 'linux') return false;
  if (env[HEADLESS_GUARD_ENV] === '1') return false;
  return !argv.some(arg => arg.startsWith('--ozone-platform'));
}

/**
 * Re-exec this binary with the headless Ozone platform prepended, forward the
 * child's stdio, and exit with its status. Never returns.
 *
 * The switch goes in front of the original arguments. Chromium reads it
 * there, and `parseCliArgs` drops the leading run of Electron switches before
 * it looks for a subcommand, so the child still finds `fetch-comments`.
 */
export function reexecHeadless(): void {
  const result = spawnSync(
    process.execPath,
    [HEADLESS_OZONE_SWITCH, ...process.argv.slice(1)],
    {
      stdio: 'inherit',
      env: { ...process.env, [HEADLESS_GUARD_ENV]: '1' },
    }
  );

  if (result.error) {
    // resolveReexecExit turns this into a non-zero code. Say why, or the
    // command looks like it failed for no reason at all.
    console.error(
      `[fetch-comments] Could not start a headless run: ${result.error.message}`
    );
  }

  const { signal, code } = resolveReexecExit(result);
  if (signal) {
    // Re-raise so the parent's exit reflects the signal (e.g. Ctrl+C). Fall
    // through to exit() if a handler swallowed it.
    process.kill(process.pid, signal);
  }
  process.exit(code);
}

/**
 * Run the macOS symlink-launch guard.
 *
 * The guard does nothing on any other platform, and `app.isPackaged` is the
 * only thing it needs from Electron. Asking for it behind the platform check
 * leaves the Linux headless path free of the Electron module, so
 * `fetch-comments` runs as ordinary Node code.
 */
function guardBundlePath(): void {
  if (process.platform !== 'darwin') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  reexecFromRealPathIfNeeded(app.isPackaged);
}

/** Injectable seams. Defaults touch the real process; tests replace them. */
export interface CliDispatchDeps {
  earlyExit: () => EarlyExitInfo;
  guardBundlePath: () => void;
  parseArgs: () => CliArgs;
  needsReexec: () => boolean;
  reexec: () => void;
  fetchComments: (
    url: string,
    options: { includeResolved: boolean }
  ) => Promise<void>;
  logError: (message: string) => void;
  exit: (code: number) => void;
}

export const defaultCliDispatchDeps: CliDispatchDeps = {
  earlyExit: checkEarlyExit,
  guardBundlePath,
  parseArgs: parseCliArgs,
  needsReexec: () =>
    needsHeadlessReexec(process.platform, process.argv, process.env),
  reexec: reexecHeadless,
  fetchComments: runFetchComments,
  logError: message => console.error(message),
  exit: code => process.exit(code),
};

/**
 * Dispatch the invocation.
 *
 * @returns `true` when the invocation was handled without a window, `false`
 *          when the caller should load the desktop main process.
 */
export function dispatchCli(
  deps: CliDispatchDeps = defaultCliDispatchDeps
): boolean {
  // --help / --version, before Electron initializes anything.
  const early = deps.earlyExit();
  if (early.shouldExit) {
    deps.exit(early.exitCode);
    return true;
  }

  // Runs ahead of the subcommand because the headless path spawns child
  // processes too, and on a symlinked macOS launch those are exactly what
  // dies without the re-exec.
  deps.guardBundlePath();

  const args = deps.parseArgs();
  if (args.subcommand !== 'fetch-comments') return false;

  if (deps.needsReexec()) {
    deps.reexec();
    return true;
  }

  // parseCliArgs exits itself on a missing URL, so remoteUrl is set here.
  deps
    .fetchComments(args.remoteUrl as string, {
      includeResolved: args.allThreads,
    })
    .then(() => deps.exit(0))
    .catch(error => {
      deps.logError(
        `[fetch-comments] ${error instanceof Error ? error.message : String(error)}`
      );
      deps.exit(1);
    });
  return true;
}
