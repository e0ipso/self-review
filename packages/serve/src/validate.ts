// Request validation for the serve package.
//
// Every route validates its input here before calling into @self-review/core.
// The core handlers were written for an in-process caller the TypeScript
// compiler had already checked; over HTTP the body is whatever the socket
// delivered, and types do not exist at runtime. Issue #145 (repository-
// controlled strings reaching `git` through a shell) is the standing evidence
// that this boundary is not hypothetical in this repository.
//
// This module deliberately starts no subprocess and touches no shell.

import * as fs from 'fs';
import * as path from 'path';
import type { ExpandContextRequest } from '@self-review/core';

/**
 * Resolve symlinks in `absolute` even when the final path does not exist
 * (a deleted or renamed file in the diff): realpath the deepest existing
 * ancestor and re-append the missing tail. Returns `null` only when nothing
 * on the path can be resolved.
 */
function realpathDeepestExisting(absolute: string): string | null {
  const missing: string[] = [];
  let current = absolute;
  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return missing.length === 0 ? real : path.join(real, ...missing);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Resolve `candidate` against `root` and return the resolved absolute path
 * when it is the root itself or sits strictly beneath it; otherwise `null`.
 *
 * Performs NO decoding. Callers pass an already-decoded value: the server
 * reads paths via `searchParams.get()`, which has decoded exactly once. A
 * second decode would turn an encoded traversal sequence inside a legitimate
 * filename (`%2E%2E%2F`) into a real one. Never decode here.
 */
export function containPath(root: string, candidate: string): string | null {
  let resolvedRoot: string;
  try {
    resolvedRoot = fs.realpathSync(root);
  } catch {
    return null;
  }

  // Resolve both sides to real paths so a symlink inside the repository
  // cannot point outside it.
  const resolved = realpathDeepestExisting(path.resolve(resolvedRoot, candidate));
  if (resolved === null) {
    return null;
  }

  if (resolved === resolvedRoot) {
    return resolved;
  }
  // Compare against the root plus a separator, not a bare string prefix:
  // `/repo-evil` must not be accepted as being under `/repo`.
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolved.startsWith(rootWithSep) ? resolved : null;
}

/**
 * Upper bound for `contextLines` on the expand-context route.
 *
 * The value reaches `git diff` as `-U${contextLines}`, so it must be a bounded
 * integer, never a raw `number`. 99_999 is exactly what the shipped React
 * client sends to expand a whole file (`useExpandContext.ts`, `MAX_CONTEXT`),
 * so the bound admits every value the real client produces and nothing larger.
 * It is also far below the point where a JavaScript number stringifies in
 * exponent notation (1e21), which would hand git an argument like `-U1e+21`.
 * Keep this in step with the client constant if either ever changes.
 */
export const MAX_CONTEXT_LINES = 99_999;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EXPAND_CONTEXT_KEYS: ReadonlySet<string> = new Set(['filePath', 'contextLines']);

/**
 * Validate the JSON body of `POST /api/expand-context`.
 *
 * Accepts exactly `{ filePath: string, contextLines: integer in [0, MAX] }`.
 * Any other key is rejected rather than ignored, so a field that some future
 * handler might read can never ride along unchecked. `filePath` is only
 * type-checked here; the route contains it under the repository root with
 * `containPath` before it reaches git.
 */
export function parseExpandContextBody(body: unknown): ParseResult<ExpandContextRequest> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!EXPAND_CONTEXT_KEYS.has(key)) {
      return { ok: false, error: `unknown field: ${key}` };
    }
  }

  const { filePath, contextLines } = record;
  if (typeof filePath !== 'string') {
    return { ok: false, error: 'filePath must be a string' };
  }
  if (
    typeof contextLines !== 'number' ||
    !Number.isInteger(contextLines) ||
    contextLines < 0 ||
    contextLines > MAX_CONTEXT_LINES
  ) {
    return {
      ok: false,
      error: `contextLines must be an integer between 0 and ${MAX_CONTEXT_LINES}`,
    };
  }

  return { ok: true, value: { filePath, contextLines } };
}
