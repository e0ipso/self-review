// `check-imports`: an optional JS/TS heuristic over a built stack. At every step it reports
// imports of files that do not exist yet and named imports a changed file does not export
// yet, the ordering mistakes that leave an intermediate step broken. It reads source text
// with regular expressions, so it can miss imports and can be silenced with --ignore; it is
// a hint for the skill, not a type checker.

import * as path from 'path';
import { StackError, git, nulSplit } from './git';
import { changedPaths } from './resolve';
import { branchName, loadSpec, stackBase } from './spec';

export interface Alias {
  prefix: string;
  directory: string;
}

export interface CheckImportsOptions {
  specFile: string;
  aliases: Alias[];
  ignores: string[];
}

// Svelte and Vue single-file components hold JS/TS imports too.
const SOURCE = /\.(?:[cm]?[jt]sx?|svelte|vue)$/;
// \p{L}\p{N}_ is Python's Unicode \w, which the original heuristic used.
const FROM =
  /\b(?:import|export)\s+(?:type\s+)?([\p{L}\p{N}_$*{}\s,]*?)\s*from\s*(['"])([^'"\n]+)\2/gu;
const BARE = /\bimport\s*(?:\(\s*)?(['"])([^'"\n]+)\1/g;
const DECLARED =
  /\bexport\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function\*?|class|type|interface|enum|namespace)\s+([\p{L}\p{N}_$]+)/gu;
const LISTED = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g;
const STAR = /\bexport\s+\*\s+from\b/;
const EMITTED_JS = /\.[cm]?js$/;
const CANDIDATES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.svelte',
  '.vue',
  '.d.ts',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.svelte',
];

/** The names in an import or export clause's braces: `side` 0 the imported, -1 the local. */
export function bracedNames(clause: string, side: 0 | -1): string[] {
  const match = /\{([^}]*)\}/.exec(clause);
  if (!match) return [];
  const names: string[] = [];
  for (let item of match[1].split(',')) {
    item = item.trim();
    if (item.startsWith('type ')) item = item.slice(5).trim();
    if (item === '') continue;
    const parts = item.split(' as ');
    names.push(parts[side === 0 ? 0 : parts.length - 1].trim());
  }
  return names;
}

/** The names a module's text exports, and whether it re-exports another module wholesale. */
export function exportedNames(text: string): { names: Set<string>; hasStar: boolean } {
  const names = new Set<string>();
  for (const match of text.matchAll(DECLARED)) names.add(match[1]);
  for (const match of text.matchAll(LISTED)) {
    for (const name of bracedNames(`{${match[1]}}`, -1)) names.add(name);
  }
  return { names, hasStar: STAR.test(text) };
}

/** posixpath.normpath: `..` and `.` folded, no trailing slash. */
function normalize(file: string): string {
  const normal = path.posix.normalize(file);
  return normal.length > 1 && normal.endsWith('/') ? normal.slice(0, -1) : normal;
}

/**
 * The repository path an import names, if any file of `tree` answers it. `target` is null
 * for a package import (found, nothing to check); `found` is false when no file exists.
 */
export function resolveImport(
  source: string,
  importer: string,
  aliases: readonly Alias[],
  tree: ReadonlySet<string>
): { target: string | null; found: boolean } {
  let target: string;
  if (source.startsWith('.')) {
    target = normalize(path.posix.join(path.posix.dirname(importer), source));
  } else {
    const alias = aliases.find(candidate => source.startsWith(candidate.prefix));
    if (!alias) return { target: null, found: true };
    // An empty directory is the repository root.
    const directory = alias.directory.replace(/\/+$/, '');
    const rest = source.slice(alias.prefix.length);
    target = normalize(directory === '' ? rest : `${directory}/${rest}`);
  }
  const stems = [target];
  // TypeScript ESM imports name the emitted .js file.
  if (EMITTED_JS.test(target)) stems.push(target.replace(EMITTED_JS, ''));
  for (const stem of stems) {
    for (const suffix of CANDIDATES) {
      if (tree.has(stem + suffix)) return { target: stem + suffix, found: true };
    }
  }
  return { target, found: false };
}

function compileIgnores(patterns: readonly string[]): RegExp[] {
  return patterns.map(pattern => {
    try {
      return new RegExp(pattern);
    } catch (error) {
      throw new StackError(`--ignore ${pattern}: ${(error as Error).message}`);
    }
  });
}

/** The imports in a file's text: the clause (empty for a bare import) and the specifier. */
function importsOf(text: string): Array<{ clause: string; source: string }> {
  return [
    ...[...text.matchAll(FROM)].map(match => ({ clause: match[1], source: match[3] })),
    ...[...text.matchAll(BARE)].map(match => ({ clause: '', source: match[2] })),
  ];
}

function show(ref: string, file: string): string {
  return git(['show', `${ref}:${file}`]);
}

/** The problems of one changed source file at one step, one line each. */
function fileProblems(
  ref: string,
  file: string,
  tree: ReadonlySet<string>,
  changed: ReadonlySet<string>,
  aliases: readonly Alias[],
  ignores: readonly RegExp[]
): string[] {
  const problems: string[] = [];
  for (const { clause, source } of importsOf(show(ref, file))) {
    if (ignores.some(pattern => pattern.test(source))) continue;
    const { target, found } = resolveImport(source, file, aliases, tree);
    if (!found) {
      problems.push(`${ref}: ${file} imports ${source}, which does not exist at this step`);
      continue;
    }
    // Only a changed file can lack a name at one step; a Svelte component's exports are
    // not read from its text.
    if (target === null || !changed.has(target) || target.endsWith('.svelte')) continue;
    const wanted = bracedNames(clause, 0);
    if (wanted.length === 0) continue;
    const { names, hasStar } = exportedNames(show(ref, target));
    if (hasStar) continue;
    for (const name of wanted) {
      if (!names.has(name)) {
        problems.push(
          `${ref}: ${file} imports ${name} from ${source}, which ${target} does not export at this step`
        );
      }
    }
  }
  return problems;
}

/** `check-imports <spec>`: 1 when any problem was reported, else 0. */
export function cmdCheckImports({ specFile, aliases, ignores }: CheckImportsOptions): number {
  const patterns = compileIgnores(ignores);
  const spec = loadSpec(specFile, { requireDiffArgs: false });
  const base = stackBase(spec);
  const top = branchName(spec, spec.steps[spec.steps.length - 1]);
  const changed = new Set(changedPaths(base, top, []).map(change => change.path));
  let problems = 0;
  for (const step of spec.steps) {
    const ref = branchName(spec, step);
    const tree = new Set(nulSplit(git(['ls-tree', '-r', '--full-tree', '--name-only', '-z', ref])));
    const files = [...changed].filter(file => tree.has(file) && SOURCE.test(file)).sort();
    for (const file of files) {
      for (const line of fileProblems(ref, file, tree, changed, aliases, patterns)) {
        process.stdout.write(`${line}\n`);
        problems += 1;
      }
    }
  }
  process.stdout.write(`${problems} problem(s)\n`);
  return problems > 0 ? 1 : 0;
}
