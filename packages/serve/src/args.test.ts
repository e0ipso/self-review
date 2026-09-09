import { describe, it, expect } from 'vitest';
import { parseServeArgs } from './args';

describe('parseServeArgs', () => {
  it('passes everything it does not recognize through to git diff', () => {
    expect(
      parseServeArgs(['--staged', 'main..feature', '--', 'src/a.ts']).gitDiffArgs
    ).toEqual(['--staged', 'main..feature', '--', 'src/a.ts']);
  });

  it('takes the output path from --output and keeps it out of the git arguments', () => {
    const args = parseServeArgs(['--output', 'out/review.xml', '--staged']);
    expect(args.outputPath).toBe('out/review.xml');
    expect(args.gitDiffArgs).toEqual(['--staged']);
  });

  it('accepts -o and the --output=<path> form', () => {
    expect(parseServeArgs(['-o', 'a.xml']).outputPath).toBe('a.xml');
    expect(parseServeArgs(['--output=b.xml']).outputPath).toBe('b.xml');
    expect(parseServeArgs(['--output=b.xml']).gitDiffArgs).toEqual([]);
  });

  it('leaves the output path unset so the configured output-file decides', () => {
    expect(parseServeArgs([]).outputPath).toBeNull();
  });

  it('takes the resume path from --resume-from and keeps it out of the git arguments', () => {
    const args = parseServeArgs(['--resume-from', 'review.xml', 'HEAD~1']);
    expect(args.resumeFrom).toBe('review.xml');
    expect(args.gitDiffArgs).toEqual(['HEAD~1']);
  });

  it('rejects a value-taking flag with no value, rather than handing the flag to git', () => {
    expect(() => parseServeArgs(['--output'])).toThrow(/--output requires/);
    expect(() => parseServeArgs(['--staged', '--resume-from'])).toThrow(
      /--resume-from requires/
    );
  });

  it('recognizes the early-exit flags', () => {
    expect(parseServeArgs(['--help']).help).toBe(true);
    expect(parseServeArgs(['-h']).help).toBe(true);
    expect(parseServeArgs(['--version']).version).toBe(true);
    expect(parseServeArgs(['-v']).version).toBe(true);
    expect(parseServeArgs(['--staged']).help).toBe(false);
  });

  // An empty value is a mistake, not a request for the default. `--output=`
  // used to resolve to the working directory, which passes the writability
  // check, so the review looked saveable and the write failed with EISDIR at
  // submit — after the state had left the session, losing the review.
  it('rejects a value flag given an empty value', () => {
    expect(() => parseServeArgs(['--output='])).toThrow(/requires a file path/);
    expect(() => parseServeArgs(['-o', ''])).toThrow(/requires a file path/);
    expect(() => parseServeArgs(['--resume-from='])).toThrow(/requires a file path/);
  });

  it('still accepts a value flag given a real value in either form', () => {
    expect(parseServeArgs(['--output=out.xml']).outputPath).toBe('out.xml');
    expect(parseServeArgs(['-o', 'out.xml']).outputPath).toBe('out.xml');
  });
});
