// packages/core/src/synthetic-diff.ts
// Generates synthetic unified diffs for files that aren't tracked by git.
// Reusable by both git untracked file handling and directory-based scanning.
//
// Reads are bounded first (input-budgets.ts). A file over budget is still listed, with no
// content and an `omittedReason`, and named in the diagnostics.

import { createSourceAccounting, type EmittedSource } from './synthetic-accounting';
import { createFilesEmitter, createPatchEmitter } from './synthetic-emitter';
import { projectText } from './synthetic-text';
import { createSeparatorDiagnostics } from './synthetic-diagnostics';
export { quoteGitPath } from './git-path-quote';
import { realpathSync } from 'fs';
import { join, resolve } from 'path';
import type { DiffFile } from './types';
import { readSyntheticSource, readSyntheticSourceAsync } from './synthetic-source';
import { captureSourceReads, recordSourceCapture, RELOAD_REVIEW } from './loaded-snapshot';
import { nodeScanFsLayer } from './node-scan-fs';
import type { SyntheticSource } from './synthetic-source';
import type { SourceReadFsLayer } from './scan-fs';
import { checkLoadingCancelled, loadingCheckpoint } from './local-loading-lifetime';
export { readSyntheticSource } from './synthetic-source';
export type { SyntheticSource } from './synthetic-source';
import {
  resolveSourceBudgets,
  RepresentationLimitError,
  type SourceBudgets,
  type ResolvedSourceBudgets,
} from './input-budgets';

export interface SyntheticDiffOptions {
  /**
   * Only for a path the reviewer named explicitly (single-file review); enumerated paths never
   * follow links.
   */
  followSymlinks?: boolean;
  budgets?: Partial<SourceBudgets>;
}

export interface SyntheticDiffResult {
  diff: string;
  /**
   * Files listed without content, by literal relative path, with the sentence the viewer shows
   * instead.
   */
  omitted: Map<string, string>;
  diagnostics: string[];
}

/**
 * Generate synthetic unified diffs for a list of file paths so they can be
 * parsed by the existing diff parser. Each file is treated as a new addition.
 *
 * @param paths - Literal relative file paths (e.g. "src/foo.ts"), resolved
 *   against rootDir and never git-quoted on the way in
 * @param rootDir - Absolute path to the root directory the paths are relative to
 * @returns The diff text, the files listed without content, and diagnostics
 */
export function generateSyntheticDiffs(
  paths: string[],
  rootDir: string,
  options: SyntheticDiffOptions = {}
): SyntheticDiffResult {
  const { diff, omitted, diagnostics } = projectSources(paths, rootDir, options, 'patch');
  return { diff, omitted, diagnostics };
}

function projectSources(
  paths: string[],
  rootDir: string,
  options: SyntheticDiffOptions,
  output: 'patch' | 'files'
) {
  const budgets = resolveSourceBudgets(options.budgets);
  const sourceRoot = syntheticRoot(rootDir);
  const projection = createProjection(budgets, output);
  for (const filePath of paths) {
    if (!projection.beginFile()) break;
    const steps = projection.add(
      filePath,
      projection.exhausted()
        ? null
        : readSyntheticSource(join(sourceRoot, filePath), {
            sourceRoot,
            followSymlinks: options.followSymlinks,
            maxFileBytes: budgets.maxFileBytes,
            remainingBytes: projection.remaining(),
          })
    );
    while (!steps.next().done) {
      /* Synchronous compatibility consumer. */
    }
  }
  return projection.finish();
}

export interface AsyncSyntheticDiffOptions extends SyntheticDiffOptions {
  /** Used for root resolution and every source inspection/read. */
  readFs?: SourceReadFsLayer;
  signal?: AbortSignal;
}

/** Async counterpart with the same ordering, budgets and projection as generateSyntheticDiffs. */
export async function generateSyntheticDiffsAsync(
  paths: string[],
  rootDir: string,
  options: AsyncSyntheticDiffOptions = {}
): Promise<SyntheticDiffResult> {
  const { diff, omitted, diagnostics } = await projectSourcesAsync(
    paths,
    rootDir,
    options,
    'patch'
  );
  return { diff, omitted, diagnostics };
}

async function projectSourcesAsync(
  paths: string[],
  rootDir: string,
  options: AsyncSyntheticDiffOptions,
  output: 'patch' | 'files'
) {
  checkLoadingCancelled(options.signal);
  const budgets = resolveSourceBudgets(options.budgets);
  const sourceRoot = options.readFs
    ? await options.readFs.realpath(rootDir).catch(() => {
        checkLoadingCancelled(options.signal);
        // Preserve per-path read diagnostics without consulting the host filesystem.
        return resolve(rootDir);
      })
    : syntheticRoot(rootDir);
  checkLoadingCancelled(options.signal);
  const originalFs = options.readFs ?? nodeScanFsLayer;
  const capture = captureSourceReads(originalFs, options.signal, 'record');
  const readFs: SourceReadFsLayer = {
    ...capture.readFs,
    readlink: target => originalFs.readlink(target),
  };
  const projection = createProjection(budgets, output);
  for (const filePath of paths) {
    await loadingCheckpoint(options.signal);
    if (!projection.beginFile()) break;
    const source = projection.exhausted()
      ? null
      : await readSyntheticSourceAsync(join(sourceRoot, filePath), {
          sourceRoot,
          readFs,
          followSymlinks: options.followSymlinks,
          maxFileBytes: budgets.maxFileBytes,
          remainingBytes: projection.remaining(),
          signal: options.signal,
        });
    checkLoadingCancelled(options.signal);
    // Preserve existing omission diagnostics when growth already exceeded a source budget.
    if (
      source &&
      (source.kind === 'text' || source.kind === 'binary') &&
      capture.drifted.has(resolve(sourceRoot, filePath))
    )
      throw new Error(RELOAD_REVIEW);
    const steps = projection.add(filePath, source);
    try {
      while (!steps.next().done) await loadingCheckpoint(options.signal);
    } finally {
      steps.return(undefined);
    }
  }
  await loadingCheckpoint(options.signal);
  const result = projection.finish();
  for (const file of result.files) {
    recordSourceCapture(
      file,
      capture.captures.get(resolve(sourceRoot, file.newPath || file.oldPath))
    );
  }
  return result;
}

function syntheticRoot(rootDir: string): string {
  try {
    return realpathSync(rootDir);
  } catch {
    // Preserve per-path disappearance diagnostics when a root vanishes before the read.
    return resolve(rootDir);
  }
}

/** Coordinate shared accounting and one output emitter, without source I/O. */
function createProjection(budgets: ResolvedSourceBudgets, output: 'patch' | 'files') {
  const accounting = createSourceAccounting(budgets);
  const emitter = output === 'files' ? createFilesEmitter() : createPatchEmitter();
  const separators = createSeparatorDiagnostics(budgets.maxDiagnostics);

  function* emit(filePath: string, source?: EmittedSource, mode?: string): Generator<void> {
    const text =
      source && source.kind !== 'binary'
        ? yield* projectText(source.content, accounting.representation)
        : undefined;
    if (text) accounting.representation.addHunk();
    separators.next(filePath, text?.lineCount);
    yield* emitter.emit(filePath, source, text, mode);
  }

  function* add(filePath: string, source: SyntheticSource | null): Generator<void> {
    try {
      const admission = accounting.admit(filePath, source);
      if (admission.emit) yield* emit(filePath, admission.source);
    } catch (error) {
      if (!(error instanceof RepresentationLimitError)) throw error;
      accounting.omitRepresentation(filePath, error);
      yield* emit(filePath, undefined, source?.kind === 'symlink' ? '120000' : '100644');
    }
  }

  return {
    beginFile: accounting.beginFile,
    add,
    remaining: accounting.remaining,
    exhausted: accounting.exhausted,
    finish() {
      const result = emitter.finish();
      for (const file of result.files) {
        const reason = accounting.omitted.get(file.newPath);
        if (reason !== undefined) file.omittedReason = reason;
      }
      const diagnostics = accounting.diagnostics();
      return {
        ...result,
        omitted: accounting.omitted,
        diagnostics: output === 'files' ? [...diagnostics, ...separators.diagnostics] : diagnostics,
      };
    },
  };
}

/** Build structured additions directly, with the same projection and budgets as patch output. */
export function loadSyntheticFiles(
  paths: string[],
  rootDir: string,
  options: SyntheticDiffOptions = {}
): { files: DiffFile[]; diagnostics: string[] } {
  const { files, diagnostics } = projectSources(paths, rootDir, options, 'files');
  return { files, diagnostics };
}

/** Async build; cancellation never returns a partial set of files. */
export async function loadSyntheticFilesAsync(
  paths: string[],
  rootDir: string,
  options: AsyncSyntheticDiffOptions = {}
): Promise<{ files: DiffFile[]; diagnostics: string[] }> {
  const { files, diagnostics } = await projectSourcesAsync(paths, rootDir, options, 'files');
  return { files, diagnostics };
}
