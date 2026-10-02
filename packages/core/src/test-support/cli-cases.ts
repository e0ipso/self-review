/**
 * Test-only. Cases both command lines must read identically (audit R15), run by
 * src/main/cli.test.ts and packages/serve/src/args.test.ts.
 */
export interface SharedCliCase {
  name: string;
  argv: string[];
  gitDiffArgs: string[];
  resumeFrom: string | null;
}

export const SHARED_CLI_CASES: SharedCliCase[] = [
  {
    name: 'keeps a search value with a space as one git argument',
    argv: ['-S', 'a b', 'HEAD~1'],
    gitDiffArgs: ['-S', 'a b', 'HEAD~1'],
    resumeFrom: null,
  },
  {
    name: 'passes an option value that looks like a path or URL to git, never as a source',
    argv: ['-S', 'src/x.ts', '-G', 'https://github.com/o/r/pull/42'],
    gitDiffArgs: ['-S', 'src/x.ts', '-G', 'https://github.com/o/r/pull/42'],
    resumeFrom: null,
  },
  {
    name: 'stops reading its own flags at --, which git gets along with what follows',
    argv: ['HEAD~1', '--', '--resume-from', 'x.xml', '--help'],
    gitDiffArgs: ['HEAD~1', '--', '--resume-from', 'x.xml', '--help'],
    resumeFrom: null,
  },
  {
    name: 'accepts --resume-from in the separated form',
    argv: ['--staged', '--resume-from', 'prior.xml'],
    gitDiffArgs: ['--staged'],
    resumeFrom: 'prior.xml',
  },
  {
    name: 'accepts --resume-from in the equals form',
    argv: ['--resume-from=prior.xml', 'main..feature'],
    gitDiffArgs: ['main..feature'],
    resumeFrom: 'prior.xml',
  },
  {
    name: "leaves a git option's separate value alone even when spelled like a flag",
    argv: ['-S', '--resume-from', '--src-prefix', '-h'],
    gitDiffArgs: ['-S', '--resume-from', '--src-prefix', '-h'],
    resumeFrom: null,
  },
];
