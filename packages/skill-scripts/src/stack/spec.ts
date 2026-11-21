// The stack spec: a JSON file the skill writes, naming the diff and partitioning its paths
// into ordered steps. Loading checks its shape only; `build` checks it against the diff.

import { readFileSync } from 'fs';
import { StackError, gitValue } from './git';

export interface StackStep {
  slug: string;
  subject: string;
  description: string;
  files: string[];
}

export interface StackSpec {
  /** The `git diff` arguments naming the diff; required by `build` only. */
  diffArgs: string[];
  prefix: string;
  /** Lines appended to every commit message after a blank line; none by default. */
  trailers: string[];
  steps: StackStep[];
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function stepProblems(step: unknown, index: number): string[] {
  const where = `steps[${index}]`;
  if (!isObject(step)) return [`${where} must be an object`];
  const problems: string[] = [];
  if (!isNonEmptyString(step.slug)) problems.push(`${where}: "slug" must be a non-empty string`);
  if (!isNonEmptyString(step.subject) || step.subject.includes('\n')) {
    problems.push(`${where}: "subject" must be a non-empty single line`);
  }
  if (step.description !== undefined && typeof step.description !== 'string') {
    problems.push(`${where}: "description" must be a string`);
  }
  if (!isStringArray(step.files) || step.files.length === 0) {
    problems.push(`${where}: "files" must be a non-empty array of paths`);
  }
  return problems;
}

/** Every shape problem of a parsed spec; empty when it is usable. */
export function specProblems(spec: unknown, requireDiffArgs: boolean): string[] {
  if (!isObject(spec)) return ['the spec must be a JSON object'];
  const problems: string[] = [];
  if (requireDiffArgs || spec.diff_args !== undefined) {
    if (!isStringArray(spec.diff_args)) problems.push('"diff_args" must be an array of strings');
  }
  if (!isNonEmptyString(spec.prefix)) problems.push('"prefix" must be a non-empty string');
  if (spec.trailers !== undefined && !isStringArray(spec.trailers)) {
    problems.push('"trailers" must be an array of strings');
  }
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    problems.push('"steps" must be a non-empty array');
  } else {
    spec.steps.forEach((step, index) => problems.push(...stepProblems(step, index)));
  }
  return problems;
}

/** Read and shape-check a spec file; refuses with every problem listed. */
export function loadSpec(file: string, options: { requireDiffArgs: boolean }): StackSpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new StackError(`${file}: ${(error as Error).message}`);
  }
  const problems = specProblems(parsed, options.requireDiffArgs);
  if (problems.length > 0) throw new StackError(`${file}:\n  ${problems.join('\n  ')}`);
  const json = parsed as Json;
  return {
    diffArgs: (json.diff_args as string[] | undefined) ?? [],
    prefix: json.prefix as string,
    trailers: (json.trailers as string[] | undefined) ?? [],
    steps: (json.steps as Json[]).map(step => ({
      slug: step.slug as string,
      subject: step.subject as string,
      description: (step.description as string | undefined) ?? '',
      files: step.files as string[],
    })),
  };
}

/** `<prefix>/<slug>`, the step's branch name. */
export function branchName(spec: StackSpec, step: StackStep): string {
  return `${spec.prefix}/${step.slug}`;
}

/** The commit the built stack starts from: the parent of its first step. */
export function stackBase(spec: StackSpec): string {
  return gitValue(['rev-parse', '--verify', `refs/heads/${branchName(spec, spec.steps[0])}^`]);
}
