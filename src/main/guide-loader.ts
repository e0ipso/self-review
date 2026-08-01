// src/main/guide-loader.ts
// Discovery + tolerant loading of the walkthrough guide sidecar.
//
// The guide is orientation garnish on a deterministic tool (see
// docs/intent/llm-review-guide.md): a missing file is a silent no-op, and
// an unreadable or invalid one produces exactly one stderr warning and no
// guide. Nothing in this module may throw out of it — every failure mode
// resolves to null.
//
// Note on startup cost: loadGuide IS awaited before window creation
// (main.ts Phase 5b), deliberately — `guide:load` piggybacks on the
// DIFF_REQUEST handler, so the payload must be cached via setGuideData
// before the renderer's first request arrives. When a guide exists, the
// xmllint-wasm init and validation delay window paint by a few hundred ms;
// when none exists the cost is a single failed stat.
//
// Discovery is one-shot: the guide is resolved from the startup output
// path. Changing the output path at runtime does not re-discover.

import { readFile } from 'fs/promises';
import { extname, resolve } from 'path';
import {
  parseGuideXml,
  reconcileGuide,
} from '../../packages/core/src/guide-parser';
import { AppConfig, GuideLoadPayload } from '../shared/types';

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
  config: Pick<AppConfig, 'guideFile'>
): string {
  if (config.guideFile) {
    return resolve(process.cwd(), config.guideFile);
  }
  return deriveGuidePath(outputPath);
}

/**
 * Discover, read, parse, validate, and reconcile the guide sidecar.
 *
 * Returns the display-ready payload, or null when there is no usable
 * guide. Missing file: silent. Unreadable or invalid file: exactly one
 * `console.error()` line (guide path + reason class). Never throws.
 */
export async function loadGuide(
  outputPath: string,
  config: Pick<AppConfig, 'guideFile'>,
  diffFilePaths: string[]
): Promise<GuideLoadPayload | null> {
  let guidePath: string;
  try {
    guidePath = resolveGuidePath(outputPath, config);
  } catch {
    return null;
  }

  try {
    let content: string;
    try {
      content = await readFile(guidePath, 'utf-8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // No sidecar next to the output path — the normal case.
        return null;
      }
      console.error(
        `[guide] Ignoring guide at ${guidePath}: unreadable (${code ?? 'unknown error'})`
      );
      return null;
    }

    const result = await parseGuideXml(content);
    // Explicit comparison: with strictNullChecks off (see tsconfig),
    // truthiness alone does not narrow the discriminated union.
    if (result.ok === false) {
      console.error(
        `[guide] Ignoring guide at ${guidePath}: invalid (${result.reason})`
      );
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
    // Belt and braces: no failure mode of the guide loader may escape.
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[guide] Ignoring guide at ${guidePath}: invalid (${message})`
    );
    return null;
  }
}
