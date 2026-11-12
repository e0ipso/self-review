// packages/core/src/guide-loader.ts
// Discovery + tolerant loading of the walkthrough guide sidecar.
//
// The guide is orientation garnish on a deterministic tool (see
// docs/intent/llm-review-guide.md): a missing file is a silent no-op, and
// an unreadable or invalid one produces exactly one stderr warning and no
// guide. Ordinary guide failures resolve to null; cancellation through an
// explicitly supplied startup signal propagates to its owner.
//
// Note on startup cost: loadGuide IS awaited before window creation
// (main.ts Phase 5b), deliberately — `guide:load` piggybacks on the
// DIFF_REQUEST handler, so the payload must be cached via setGuideData
// before the renderer's first request arrives. When a guide exists, the
// xmllint-wasm init and validation delay window paint by a few hundred ms;
// when none exists the cost is a single failed open.
//
// Discovery is one-shot: the guide is resolved from the startup output
// path. Changing the output path at runtime does not re-discover.

import { extname, resolve } from 'path';
import { readFileWithinBudget } from './bounded-read';
import type { AsyncBoundedReadOptions, BoundedReadResult } from './bounded-read';
import { parseGuideXml, reconcileGuide } from './guide-parser';
import { formatBytes, MAX_GUIDE_BYTES } from './input-budgets';
import { AppConfig, GuideLoadPayload } from './types';
import type { DiagnosticReporter } from './diagnostics';
import { isolatedReporter } from './effect-diagnostics';

/**
 * Derive the guide sidecar path from the resolved output path: strip the
 * last extension and append `.guide.xml` (`review.xml` →
 * `review.guide.xml`). An output filename with no extension gets
 * `.guide.xml` appended verbatim.
 */
export function deriveGuidePath(outputPath: string): string {
  const ext = extname(outputPath);
  const base = ext ? outputPath.slice(0, -ext.length) : outputPath;
  return `${base}.guide.xml`;
}

/**
 * Resolve where to look for the guide: the `guide-file` config override
 * (resolved against cwd, like `output-file`) when set, otherwise the path
 * derived from the resolved output path.
 */
export function resolveGuidePath(
  outputPath: string,
  config: Pick<AppConfig, 'guideFile'>,
  cwd?: string
): string {
  if (config.guideFile) {
    return resolve(cwd ?? process.cwd(), config.guideFile);
  }
  return deriveGuidePath(outputPath);
}

/**
 * Owns bounded guide reads, including regular-file checks, growth detection and handle cleanup.
 * Must reject filesystem errors with Node-style errno codes and settle after cleanup on abort.
 * Methods retain their receiver. A supplied reader is authoritative; native I/O is never retried.
 */
export interface BoundedGuideReader {
  read(
    path: string,
    maxBytes: number,
    options?: AsyncBoundedReadOptions
  ): Promise<BoundedReadResult>;
}

const nativeGuideReader: BoundedGuideReader = { read: readFileWithinBudget };

export interface LoadGuideOptions {
  /** Defaults to the native bounded reader. The caller owns the reader; it owns opened handles. */
  reader?: BoundedGuideReader;
  /** Resolution directory for a relative guide-file. Defaults to process.cwd(). */
  cwd?: string;
  /** Defaults to stderr; missing guides are always silent. */
  reportDiagnostic?: DiagnosticReporter;
  /** Cancels bounded reading and refuses obsolete validation; shared validation is not preempted. */
  signal?: AbortSignal;
}

/**
 * Discover, read, parse, validate, and reconcile the guide sidecar.
 *
 * Returns the display-ready payload, or null when there is no usable
 * guide. Missing file: silent. Unreadable or invalid file: exactly one
 * `reportDiagnostic()` line (guide path + reason class). An explicitly supplied
 * startup signal propagates cancellation; ordinary guide failures never throw.
 */
export async function loadGuide(
  outputPath: string,
  config: Pick<AppConfig, 'guideFile'>,
  diffFilePaths: string[],
  options: LoadGuideOptions = {}
): Promise<GuideLoadPayload | null> {
  const reportDiagnostic = isolatedReporter(options.reportDiagnostic);
  options.signal?.throwIfAborted();
  let guidePath: string;
  try {
    guidePath = resolveGuidePath(outputPath, config, options.cwd);
  } catch {
    options.signal?.throwIfAborted();
    return null;
  }

  try {
    // Refused on fstat size / non-regular file before any read, so a FIFO cannot block.
    let content: string;
    try {
      const reader = options.reader ?? nativeGuideReader;
      let read = await (options.signal
        ? reader.read(guidePath, MAX_GUIDE_BYTES, { signal: options.signal })
        : reader.read(guidePath, MAX_GUIDE_BYTES));
      options.signal?.throwIfAborted();
      // Enforce the parse budget even if a supplied reader under-enforces its allocation contract.
      if (read.kind === 'ok' && read.content.length > MAX_GUIDE_BYTES) {
        read = { kind: 'too-large', size: read.content.length };
      }
      if (read.kind === 'too-large') {
        reportDiagnostic(
          `[guide] Ignoring guide at ${guidePath}: too large (${formatBytes(read.size)}, ` +
            `over the ${formatBytes(MAX_GUIDE_BYTES)} guide budget)`
        );
        return null;
      }
      if (read.kind === 'not-regular') {
        reportDiagnostic(`[guide] Ignoring guide at ${guidePath}: unreadable (not a regular file)`);
        return null;
      }
      content = read.content.toString('utf-8');
    } catch (error) {
      options.signal?.throwIfAborted();
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // No sidecar next to the output path — the normal case.
        return null;
      }
      reportDiagnostic(
        `[guide] Ignoring guide at ${guidePath}: unreadable (${code ?? 'unknown error'})`
      );
      return null;
    }

    const result = await parseGuideXml(content);
    options.signal?.throwIfAborted();
    // Explicit comparison: with strictNullChecks off (see tsconfig),
    // truthiness alone does not narrow the discriminated union.
    if (result.ok === false) {
      reportDiagnostic(`[guide] Ignoring guide at ${guidePath}: invalid (${result.reason})`);
      return null;
    }

    const payload: GuideLoadPayload = {
      groups: reconcileGuide(result.guide, diffFilePaths),
    };
    if (result.guide.overview !== undefined) {
      payload.overview = result.guide.overview;
    }
    return payload;
  } catch (error) {
    options.signal?.throwIfAborted();
    // Optional-guide failures remain nonfatal; cancellation belongs to startup.
    const message = error instanceof Error ? error.message : String(error);
    reportDiagnostic(`[guide] Ignoring guide at ${guidePath}: invalid (${message})`);
    return null;
  }
}
