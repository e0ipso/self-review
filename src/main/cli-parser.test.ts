import { expect, it } from 'vitest';
import { extractDesktopArgs, parseAppArgs, parseEarlyExit } from './cli-parser';
const url = 'https://github.com/o/r/pull/42';
it('parses supplied argv through Finder, Chromium and development launch forms', () => {
  const argv = [
    'electron',
    '--no-sandbox',
    '/app/main.js',
    '-psn_123',
    '--headless',
    '--resume-from=x.xml',
    url,
  ];
  const args = extractDesktopArgs(argv, true);
  expect(args).toEqual(['--resume-from=x.xml', url]);
  expect(parseAppArgs(args)).toEqual({
    args: {
      resumeFrom: 'x.xml',
      gitDiffArgs: [],
      subcommand: null,
      remoteUrl: url,
      allThreads: false,
    },
    diagnostics: [],
    exitCode: null,
  });
  expect(argv).toHaveLength(7);
  expect(extractDesktopArgs(['app', '--no-sandbox', '--', '--headless'], false)).toEqual([
    '--',
    '--headless',
  ]);
});
it('preserves ignored extra fetch operands and unknown flags', () => {
  expect(
    parseAppArgs(['fetch-comments', '--unknown', url, 'ignored', '--all-threads']).args
  ).toEqual({
    resumeFrom: null,
    gitDiffArgs: [],
    subcommand: 'fetch-comments',
    remoteUrl: url,
    allThreads: true,
  });
  expect(parseAppArgs(['fetch-comments', '--unknown']).diagnostics).toEqual([
    'Error: fetch-comments requires a pull/merge request URL argument',
  ]);
});
it('keeps option values and operands after -- out of remote classification', () => {
  for (const args of [
    ['-S', url],
    ['--', url],
    ['HEAD', url],
  ]) {
    expect(parseAppArgs(args).args.gitDiffArgs).toEqual(args);
    expect(parseAppArgs(args).args.remoteUrl).toBeNull();
  }
  expect(parseAppArgs(['--staged', url]).args.remoteUrl).toBe(url);
  expect(parseAppArgs(['--', 'fetch-comments']).diagnostics).toEqual([]);
});
it('returns diagnostics and early-exit intent without process effects', () => {
  expect(parseAppArgs(['--resume-from']).exitCode).toBe(1);
  const result = parseAppArgs(['--staged', 'fetch-comments', url]);
  expect(result.exitCode).toBe(1);
  expect(result.diagnostics).toHaveLength(2);
  expect(result.args.gitDiffArgs).toEqual(['--staged', 'fetch-comments', url]);
  expect(parseEarlyExit(['--resume-from', '--help'])).toBeNull();
  expect(parseEarlyExit(['--version', '--help'])).toBe('help');
  expect(parseEarlyExit(['--', '--help'])).toBeNull();
});
