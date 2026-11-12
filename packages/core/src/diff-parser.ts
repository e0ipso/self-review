// Synchronous, browser-safe compatibility entry points.
import type { DiffFile } from './types';
import { parseDiffSteps, type DiffParseResult } from './diff-parser-core';
export type { DiffParseResult } from './diff-parser-core';

/** Parse a unified diff, discarding diagnostics. Prefer {@link parseDiffWithDiagnostics}. */
export function parseDiff(rawDiff: string): DiffFile[] {
  return parseDiffWithDiagnostics(rawDiff).files;
}

/** Parse the complete patch synchronously, retaining malformed-input diagnostics. */
export function parseDiffWithDiagnostics(rawDiff: string): DiffParseResult {
  const parser = parseDiffSteps(rawDiff);
  let step = parser.next();
  while (!step.done) step = parser.next();
  return step.value;
}
