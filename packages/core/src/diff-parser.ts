// Synchronous, browser-safe compatibility entry points.
import type { DiffFile } from './types';
import { parseDiffSteps, type DiffParseResult, type DiffParseOptions } from './diff-parser-core';
export type { DiffParseResult, DiffParseOptions } from './diff-parser-core';

/** Parse a unified diff, discarding diagnostics; representation limits throw RangeError. Prefer {@link parseDiffWithDiagnostics}. */
export function parseDiff(rawDiff: string, options: DiffParseOptions = {}): DiffFile[] {
  // This legacy result has nowhere to carry an aggregate stop diagnostic. Refuse visibly
  // instead of returning a shorter review whose caller cannot know it is incomplete.
  return consume(
    parseDiffSteps(rawDiff, options, message => {
      throw new RangeError(message);
    })
  ).files;
}

/** Parse the complete patch synchronously, retaining malformed-input diagnostics. */
export function parseDiffWithDiagnostics(
  rawDiff: string,
  options: DiffParseOptions = {}
): DiffParseResult {
  return consume(parseDiffSteps(rawDiff, options));
}

function consume(parser: Generator<void, DiffParseResult>): DiffParseResult {
  let step = parser.next();
  while (!step.done) step = parser.next();
  return step.value;
}
