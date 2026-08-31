// src/main/serve/bootstrap.ts
// Serve-mode startup and session lifecycle.
//
// Startup order mirrors the Electron main process, and the order is the point:
// resolve configuration, validate the output path, resolve the diff, resolve
// the guide — and only then listen. A reviewer must never reach a rendered UI
// that cannot answer a request, and must never finish a review only to
// discover it cannot be saved.
//
// Guide discovery stays one-shot, resolved from the startup output path, as
// `../guide-loader` documents. Serve mode never re-discovers it: the output
// path is fixed at launch.
//
// Nothing here imports `electron`. The process this runs in happens to be the
// Electron binary, but serve mode never calls `app.whenReady()` and never
// opens a window.

import { accessSync, constants as fsConstants, statSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { CliArgs, ServeAddress } from '../cli';
import { normalizeGitDiffArgs } from '../cli';
import { loadConfig } from '../config';
import { createIgnoreFilter } from '../ignore-filter';
import { scanDirectory, scanFile } from '../directory-scanner';
import { loadGitDiffWithUntracked } from '../git-diff-loader';
import { loadGuide } from '../guide-loader';
import { computePayloadStats, countTotalLines } from '../payload-sizing';
import { applyStagedUntrackedDefault } from '../staged-untracked';
import { determineMode } from '../startup-mode';
import { parseReviewXml } from '../xml-parser';
import { createReviewSession, type ReviewSession } from '../review-handlers';
import type { AppConfig, DiffLoadPayload } from '../../shared/types';
import { resolveClientAssetsDir } from './client-assets';
import { createServeServer, listen, stopServer } from './server';
import { guardAgainstOrphaning } from './orphan-guard';

export interface OutputPathValidation {
  ok: boolean;
  /** Set only when `ok` is false: what is wrong, in the reviewer's terms. */
  message?: string;
}

/**
 * Establish that the review can be written *before* anything is served.
 *
 * Checks only — nothing is created. Nothing may be written to the output path
 * until the reviewer submits, which is what makes a closed browser tab cost
 * nothing.
 */
export function validateOutputPath(outputPath: string): OutputPathValidation {
  const dir = dirname(outputPath);

  let existing: ReturnType<typeof statSync> | null = null;
  try {
    existing = statSync(outputPath);
  } catch {
    existing = null;
  }

  if (existing?.isDirectory()) {
    return {
      ok: false,
      message: `--output path is a directory, not a file: ${outputPath}`,
    };
  }

  if (existing) {
    try {
      accessSync(outputPath, fsConstants.W_OK);
      return { ok: true };
    } catch {
      return { ok: false, message: `--output file is not writable: ${outputPath}` };
    }
  }

  try {
    statSync(dir);
  } catch {
    return {
      ok: false,
      message: `--output directory does not exist: ${dir}`,
    };
  }

  try {
    accessSync(dir, fsConstants.W_OK);
  } catch {
    return { ok: false, message: `--output directory is not writable: ${dir}` };
  }

  return { ok: true };
}

/** A serve session resolved and ready to be listened on. */
export interface ResolvedServeSession {
  session: ReviewSession;
  outputPath: string;
  config: AppConfig;
}

/** Raised for a startup condition serve mode cannot proceed from. */
export class ServeStartupError extends Error {}

/**
 * Resolve configuration, the diff, the guide and any resumed review into a
 * session — the same startup the Electron main process performs, minus every
 * interactive prompt, since serve mode has no dialogs to show.
 */
export async function resolveServeSession(cli: CliArgs): Promise<ResolvedServeSession> {
  let config = loadConfig();
  const outputPath = resolve(process.cwd(), cli.outputPath ?? config.outputFile);

  const validation = validateOutputPath(outputPath);
  if (!validation.ok) {
    throw new ServeStartupError(validation.message ?? `--output path is unusable: ${outputPath}`);
  }

  let gitDiffArgs = cli.gitDiffArgs;
  if (gitDiffArgs.length === 0 && config.defaultDiffArgs) {
    gitDiffArgs = config.defaultDiffArgs.split(' ').filter(arg => arg.length > 0);
  }
  gitDiffArgs = normalizeGitDiffArgs(gitDiffArgs);
  config = applyStagedUntrackedDefault(config, gitDiffArgs);

  if (cli.remoteUrl) {
    // Remote PR/MR review is about where the diff comes from; serve mode is
    // about where the UI runs. They compose in principle, but the welcome
    // screen that enters remote review is not part of serve mode v1.
    throw new ServeStartupError(
      'Serve mode does not support reviewing a remote PR/MR URL yet.'
    );
  }

  const mode = determineMode(gitDiffArgs);
  console.error('[serve] Startup mode:', mode);

  let diffData: DiffLoadPayload;
  if (mode === 'git') {
    const { files: allFiles, repository } = await loadGitDiffWithUntracked(gitDiffArgs);
    const shouldKeep = createIgnoreFilter(config.ignore);
    diffData = {
      files: allFiles.filter(f => shouldKeep(f.newPath || f.oldPath)),
      source: { type: 'git', gitDiffArgs: gitDiffArgs.join(' '), repository },
    };
  } else if (mode === 'file') {
    const fileArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
    const filePath = resolve(process.cwd(), fileArg);
    diffData = {
      files: await scanFile(filePath),
      source: { type: 'file', sourcePath: filePath },
    };
  } else if (mode === 'directory') {
    const dirArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
    const directoryPath = resolve(process.cwd(), dirArg);
    diffData = {
      files: await scanDirectory(directoryPath, config.ignore),
      source: { type: 'directory', sourcePath: directoryPath },
    };
  } else {
    // The desktop app answers this with a welcome screen. Serve mode v1 omits
    // it, so there is nothing to serve and saying so beats an empty UI.
    throw new ServeStartupError(
      'Serve mode needs something to review: run it inside a git repository, ' +
        'or pass a file or directory path.'
    );
  }

  console.error('[serve] Resolved', diffData.files.length, 'files');

  // Large payload guard. The desktop app asks; serve mode has no dialog and
  // nobody at the terminal, so it takes the lazy-loading path and says so.
  const stats = computePayloadStats(
    diffData.files.length,
    countTotalLines(diffData.files),
    config
  );
  if (stats.exceedsAny) {
    diffData.isLargePayload = true;
    console.error(
      `[serve] Large payload (${stats.fileCount} files, ${stats.totalLines} lines) — serving in large-payload mode`
    );
  }

  const session = createReviewSession();
  session.diffData = diffData;
  session.config = config;
  // Writable by construction: startup refuses to get this far otherwise, which
  // is the point of validating before the listener exists.
  session.outputPathInfo = { resolvedOutputPath: outputPath, outputPathWritable: true };

  if (cli.resumeFrom) {
    try {
      const parsed = parseReviewXml(cli.resumeFrom);
      session.resumeComments = parsed.comments;
      session.resumeViewedFiles = parsed.viewedFiles;
      console.error(
        '[serve] Resumed',
        parsed.comments.length,
        'comments and',
        parsed.viewedFiles.length,
        'viewed files'
      );
    } catch {
      throw new ServeStartupError(`Could not read the resume file: ${cli.resumeFrom}`);
    }
  }

  // One-shot guide discovery against the startup output path, before the
  // listener accepts anything: the guide rides with the diff response.
  session.guideData = await loadGuide(
    outputPath,
    config,
    diffData.files.map(f => f.newPath || f.oldPath)
  );
  if (session.guideData) {
    console.error('[serve] Walkthrough guide loaded:', session.guideData.groups.length, 'groups');
  }

  return { session, outputPath, config };
}

/** A listening serve-mode session, for tests and for the CLI entry point. */
export interface RunningServeSession {
  server: Server;
  url: string;
  address: AddressInfo;
  session: ReviewSession;
  outputPath: string;
}

/**
 * Resolve the session and start listening. Resolves once the server is
 * accepting connections; `onSessionEnd` fires after a submitted review has
 * been written and its response flushed.
 */
export async function startServeMode(
  cli: CliArgs,
  address: ServeAddress,
  onSessionEnd: () => void
): Promise<RunningServeSession> {
  const { session, outputPath } = await resolveServeSession(cli);

  const client = resolveClientAssetsDir();
  if (client.exists) {
    console.error('[serve] Serving client assets from', client.dir);
  } else {
    console.error(
      '[serve] No built client found — the API will answer but the UI will not load. Looked in:\n  ' +
        client.candidates.join('\n  ')
    );
  }

  const server = createServeServer({
    session,
    outputPath,
    clientDir: client.dir,
    onReviewComplete: onSessionEnd,
  });

  const bound = await listen(server, address.host, address.port);
  const host = bound.family === 'IPv6' ? `[${bound.address}]` : bound.address;
  const url = `http://${host}:${bound.port}/`;

  return { server, url, address: bound, session, outputPath };
}

/**
 * CLI entry point for `self-review serve`.
 *
 * Ends the process itself: the review is the session. A submitted review is
 * written, answered, and then the listener is stopped, which is what makes
 * `serve` a foreground command that finishes rather than a daemon.
 */
export async function runServeMode(cli: CliArgs, address: ServeAddress): Promise<void> {
  // Declared before the listener exists so the end-of-session callback can
  // never fire into an uninitialised binding.
  let server: Server | null = null;
  const endSession = async (): Promise<void> => {
    console.error('[serve] Review submitted — stopping the server');
    if (server) {
      await stopServer(server);
    }
    process.exit(0);
  };

  let running: RunningServeSession;
  try {
    running = await startServeMode(cli, address, () => {
      void endSession();
    });
    server = running.server;
  } catch (error) {
    if (error instanceof ServeStartupError) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(
        `[serve] Startup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    process.exit(1);
    return;
  }

  // Ctrl-C already works: the launcher keeps this child in its process group,
  // so a group signal reaches us. This covers the case that group signalling
  // cannot — the launcher dying without passing anything on (SIGKILL, OOM),
  // which would otherwise leave this process holding the port under init.
  guardAgainstOrphaning(() => {
    console.error(
      '[serve] The process that started serve mode is gone — shutting down'
    );
    if (server) {
      void stopServer(server).finally(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

  console.error(`[serve] Output path: ${running.outputPath} (fixed for this session)`);
  // The URL is the command's product, so it goes to stdout; everything else is
  // progress logging and stays on stderr.
  process.stdout.write(`${running.url}\n`);
}
