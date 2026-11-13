// Read-only discovery for metadata capture. Preserve Git's pathspec and rename interpretation.
import { executeGit, PARSER_COMPATIBLE_GIT_CONFIG, withParserCompatibleDiffArgs } from './git';
import type { LoadGitDiffOptions } from './git-diff-loader';
import { parseGitDiffArgs } from './git-argument-policy';
import { resolveSourceBudgets } from './input-budgets';
import { loadingCheckpoint } from './local-loading-lifetime';

export async function comparisonPaths(
  args: string[],
  cwd: string,
  options: LoadGitDiffOptions
): Promise<Set<string>> {
  const normalized = withParserCompatibleDiffArgs(args);
  const boundary = parseGitDiffArgs(normalized).separatorIndex ?? normalized.length;
  const text = await executeGit(
    [
      '--no-optional-locks',
      ...PARSER_COMPATIBLE_GIT_CONFIG,
      'diff',
      ...normalized.slice(0, boundary),
      '--name-status',
      '-z',
      '--no-relative',
      ...normalized.slice(boundary),
    ],
    cwd,
    { ...options, timeoutMs: options.timeoutMs ?? 30_000 },
    resolveSourceBudgets(options.budgets).maxGitDiffOutputBytes
  );
  const fields = text === '' ? [] : text.split('\0');
  if (fields.length && fields.pop() !== '') throw new Error('Invalid comparison path list');
  const paths = new Set<string>();
  for (let index = 0; index < fields.length; ) {
    await loadingCheckpoint(options.signal);
    const status = fields[index++];
    if (!/^[ACDMRTUXB][0-9]*$/.test(status)) throw new Error('Invalid comparison path status');
    const count = status.startsWith('R') || status.startsWith('C') ? 2 : 1;
    for (let part = 0; part < count; part++) {
      const filePath = fields[index++];
      if (!filePath) throw new Error('Missing comparison path');
      paths.add(filePath);
    }
  }
  return paths;
}
