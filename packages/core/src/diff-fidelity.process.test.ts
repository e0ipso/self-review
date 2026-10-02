import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseDiffWithDiagnostics } from './diff-parser';
import { runGitDiffAsync, withParserCompatibleDiffArgs } from './git';
import { gitSync } from './test-support/git-env';

// R06: fixtures are real `git diff` output from a disposable repository, one per shape the parser
// used to misread.

const PNG_V1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
  'hex'
);
const PNG_V2 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000020000000208060000007f1d2b83',
  'hex'
);

async function load(args: string[], cwd: string) {
  return parseDiffWithDiagnostics(await runGitDiffAsync(args, cwd));
}

describe('git diff output reaches the parser in contract shape', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-fidelity-')));
    gitSync(['init', '-q', '-b', 'main', root]);
    gitSync(['-C', root, 'config', 'user.email', 'test@example.com']);
    gitSync(['-C', root, 'config', 'user.name', 'Test']);
    writeFileSync(join(root, 'one.txt'), 'old\n');
    writeFileSync(join(root, 'image.png'), PNG_V1);
    gitSync(['-C', root, 'add', '-A']);
    gitSync(['-C', root, 'commit', '-qm', 'init']);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('does not read the trailing newline of a 1/1 hunk as a phantom context line', async () => {
    writeFileSync(join(root, 'one.txt'), 'new\n');

    const { files, diagnostics } = await load([], root);

    expect(diagnostics).toEqual([]);
    expect(files).toHaveLength(1);
    expect(files[0].hunks[0].header).toBe('@@ -1 +1 @@');
    expect(files[0].hunks[0].lines).toEqual([
      { type: 'deletion', oldLineNumber: 1, newLineNumber: null, content: 'old' },
      { type: 'addition', oldLineNumber: null, newLineNumber: 1, content: 'new' },
    ]);
  });

  it('reports a binary modification reviewed with --binary as binary', async () => {
    writeFileSync(join(root, 'image.png'), PNG_V2);

    const { files, diagnostics } = await load(['--binary'], root);

    expect(diagnostics).toEqual([]);
    expect(files).toEqual([
      expect.objectContaining({
        newPath: 'image.png',
        isBinary: true,
        changeType: 'modified',
        hunks: [],
      }),
    ]);
  });

  it('reports exact and edited copies found with -C --find-copies-harder as copied', async () => {
    writeFileSync(join(root, 'exact-copy.txt'), 'old\n');
    writeFileSync(join(root, 'src.txt'), 'alpha\nbeta\ngamma\ndelta\nepsilon\n');
    gitSync(['-C', root, 'add', '-A']);
    gitSync(['-C', root, 'commit', '-qm', 'source for edited copy']);
    writeFileSync(join(root, 'edited-copy.txt'), 'alpha\nbeta\ngamma\ndelta\nEPSILON\n');
    gitSync(['-C', root, 'add', '-A']);

    const { files, diagnostics } = await load(['--cached', '-C', '--find-copies-harder'], root);

    expect(diagnostics).toEqual([]);
    const byPath = Object.fromEntries(files.map(file => [file.newPath, file]));
    expect(byPath['edited-copy.txt']).toMatchObject({
      changeType: 'copied',
      oldPath: 'src.txt',
    });
    expect(byPath['edited-copy.txt'].hunks).toHaveLength(1);
  });

  it('reports an exact copy as copied with no hunks', async () => {
    writeFileSync(join(root, 'exact-copy.txt'), 'old\n');
    gitSync(['-C', root, 'add', '-A']);

    const { files, diagnostics } = await load(['--cached', '-C', '--find-copies-harder'], root);

    expect(diagnostics).toEqual([]);
    expect(files).toEqual([
      expect.objectContaining({
        changeType: 'copied',
        oldPath: 'one.txt',
        newPath: 'exact-copy.txt',
        hunks: [],
      }),
    ]);
  });

  it('reports a merge conflict as unsupported instead of dropping it or an adjacent file', async () => {
    gitSync(['-C', root, 'checkout', '-q', '-b', 'theirs']);
    writeFileSync(join(root, 'one.txt'), 'theirs\n');
    gitSync(['-C', root, 'commit', '-qam', 'theirs']);
    gitSync(['-C', root, 'checkout', '-q', 'main']);
    writeFileSync(join(root, 'one.txt'), 'ours\n');
    gitSync(['-C', root, 'commit', '-qam', 'ours']);
    let merged = true;
    try {
      gitSync(['-C', root, 'merge', '-q', 'theirs']);
    } catch {
      merged = false;
    }
    expect(merged).toBe(false);
    // An ordinary unstaged change next to the conflict must still be reviewed.
    writeFileSync(join(root, 'plain.txt'), 'plain\n');
    gitSync(['-C', root, 'add', '--intent-to-add', 'plain.txt']);

    const { files, diagnostics } = await load([], root);

    expect(diagnostics).toEqual([
      'one.txt: combined (merge conflict) diff output is not supported',
    ]);
    expect(files.map(file => file.newPath)).toEqual(['plain.txt']);
  });

  it('parses correctly when color.ui=always is configured', async () => {
    gitSync(['-C', root, 'config', 'color.ui', 'always']);
    gitSync(['-C', root, 'config', 'color.diff', 'always']);
    writeFileSync(join(root, 'one.txt'), 'new\n');

    const { files, diagnostics } = await load([], root);

    expect(diagnostics).toEqual([]);
    expect(files).toHaveLength(1);
    expect(files[0].newPath).toBe('one.txt');
    expect(files[0].hunks[0].lines.map(line => line.content)).toEqual(['old', 'new']);
  });

  it('parses correctly when diff.noprefix=true is configured', async () => {
    gitSync(['-C', root, 'config', 'diff.noprefix', 'true']);
    writeFileSync(join(root, 'image.png'), PNG_V2);
    writeFileSync(join(root, 'one.txt'), 'new\n');

    const { files, diagnostics } = await load([], root);

    expect(diagnostics).toEqual([]);
    expect(files.map(file => [file.newPath, file.isBinary])).toEqual([
      ['image.png', true],
      ['one.txt', false],
    ]);
  });

  it('parses correctly when diff.mnemonicPrefix and an external diff driver are configured', async () => {
    gitSync(['-C', root, 'config', 'diff.mnemonicPrefix', 'true']);
    gitSync(['-C', root, 'config', 'diff.external', 'false']);
    writeFileSync(join(root, 'one.txt'), 'new\n');

    const { files, diagnostics } = await load([], root);

    expect(diagnostics).toEqual([]);
    expect(files.map(file => file.newPath)).toEqual(['one.txt']);
  });
});

describe('withParserCompatibleDiffArgs', () => {
  it('appends the normalizing flags after the user options so they win', () => {
    expect(withParserCompatibleDiffArgs(['--staged', '--color=always'])).toEqual([
      '--staged',
      '--color=always',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--src-prefix=a/',
      '--dst-prefix=b/',
    ]);
  });

  it('keeps the flags before the pathspec separator', () => {
    const args = withParserCompatibleDiffArgs(['HEAD~1', '--', 'src/']);

    expect(args.slice(0, 1)).toEqual(['HEAD~1']);
    expect(args.slice(-2)).toEqual(['--', 'src/']);
    expect(args).toContain('--no-color');
  });
});
