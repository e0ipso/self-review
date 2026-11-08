import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gitSync } from './test-support/git-env';
import {
  describeGitDiffSides,
  resolveGitSourceIdentity,
  resolveLocalSourceIdentity,
  resolveReviewedPathPrefix,
  rootRelativeReviewedPath,
} from './source-identity';

// Pure half: the two snapshots an argv compares, one row per shape the CLI parsers produce.
describe('describeGitDiffSides', () => {
  const index = { kind: 'index' } as const;
  const workingTree = { kind: 'working-tree' } as const;
  const head = { kind: 'revision', rev: 'HEAD', implicit: true } as const;
  const rev = (name: string) => ({ kind: 'revision', rev: name, implicit: false }) as const;
  const mergeBase = (left: string, right: string) => ({ kind: 'merge-base', left, right }) as const;

  it.each([
    ['nothing', [], index, workingTree],
    ['--staged', ['--staged'], head, index],
    ['--cached', ['--cached'], head, index],
    ['--cached <rev>', ['--cached', 'main'], rev('main'), index],
    ['<rev>', ['main'], rev('main'), workingTree],
    ['<rev>..<rev>', ['main..feature'], rev('main'), rev('feature')],
    ['<rev> <rev>', ['main', 'feature'], rev('main'), rev('feature')],
    ['<rev>...<rev>', ['main...feature'], mergeBase('main', 'feature'), rev('feature')],
    ['...<rev> (implicit HEAD)', ['...feature'], mergeBase('HEAD', 'feature'), rev('feature')],
    ['<rev>.. (implicit HEAD)', ['main..'], rev('main'), head],
    ['--merge-base <rev>', ['--merge-base', 'main'], mergeBase('main', 'HEAD'), workingTree],
    ['-R <rev> (reversed)', ['-R', 'main'], workingTree, rev('main')],
    ['an option value spelled like a flag', ['-S', '--cached'], index, workingTree],
    ['a pathspec spelled like a flag', ['--', '--cached'], index, workingTree],
    ['a pathspec spelled like a revision', ['-U5', '--', 'main'], index, workingTree],
  ])('maps %s', (_label, argv, oldSide, newSide) => {
    expect(describeGitDiffSides(argv)).toEqual({ oldSide, newSide });
  });

  it('marks shapes it cannot vouch for as unknown rather than guessing', () => {
    for (const argv of [
      ['--no-index', 'a', 'b'],
      ['a', 'b', 'c'],
      ['--cached', 'a..b'],
    ]) {
      const sides = describeGitDiffSides(argv);
      expect(sides.oldSide.kind, argv.join(' ')).toBe('unknown');
      expect(sides.newSide.kind, argv.join(' ')).toBe('unknown');
    }
  });
});

// Resolving half, against a real repository: each revision becomes the SHA it named at load.
describe('resolveGitSourceIdentity', () => {
  let tmp: string;
  let repo: string;
  let unborn: string;
  let first: string;
  let second: string;
  let feature: string;

  beforeAll(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-identity-')));
    repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    const git = (...args: string[]) => gitSync(args, { cwd: repo }).trim();
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'first\n');
    git('add', '-A');
    git('commit', '-qm', 'first');
    first = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'second\n');
    git('commit', '-qam', 'second');
    second = git('rev-parse', 'HEAD');
    git('checkout', '-qb', 'feature', first);
    fs.writeFileSync(path.join(repo, 'b.txt'), 'feature\n');
    git('add', '-A');
    git('commit', '-qm', 'feature');
    feature = git('rev-parse', 'HEAD');
    git('checkout', '-q', 'main');

    unborn = path.join(tmp, 'unborn');
    fs.mkdirSync(unborn);
    gitSync(['init', '-q'], { cwd: unborn });
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('pins a staged review to the HEAD commit and the index', async () => {
    const identity = await resolveGitSourceIdentity({
      repository: repo,
      gitDiffArgv: ['--staged'],
      invocationCwd: '/launched/from',
    });

    expect(identity).toEqual({
      mode: 'git',
      sourceRoot: repo,
      invocationCwd: '/launched/from',
      gitDiffArgv: ['--staged'],
      pathPrefix: '',
      oldSide: { kind: 'commit', sha: second },
      newSide: { kind: 'index' },
    });
  });

  it('resolves a symmetric range to the merge base and the right-hand commit', async () => {
    const identity = await resolveGitSourceIdentity({
      repository: repo,
      gitDiffArgv: ['main...feature'],
    });

    expect(identity.oldSide).toEqual({ kind: 'commit', sha: first });
    expect(identity.newSide).toEqual({ kind: 'commit', sha: feature });
    expect(identity.invocationCwd).toBe(process.cwd());
  });

  it('keeps the side it could resolve when the other names no commit', async () => {
    const identity = await resolveGitSourceIdentity({
      repository: repo,
      gitDiffArgv: ['no-such-branch'],
    });

    expect(identity.oldSide.kind).toBe('unknown');
    expect(identity.newSide).toEqual({ kind: 'working-tree' });
  });

  it('treats an implicit HEAD on an unborn branch as the empty side', async () => {
    const identity = await resolveGitSourceIdentity({
      repository: unborn,
      gitDiffArgv: ['--cached'],
    });

    expect(identity.oldSide).toEqual({ kind: 'none' });
    expect(identity.newSide).toEqual({ kind: 'index' });
  });

  it('never throws for a directory that is not a repository', async () => {
    const identity = await resolveGitSourceIdentity({
      repository: path.join(tmp, 'missing'),
      gitDiffArgv: ['main..feature'],
    });

    expect(identity.sourceRoot).toBe(path.join(tmp, 'missing'));
    expect(identity.oldSide.kind).toBe('unknown');
    expect(identity.newSide.kind).toBe('unknown');
  });

  // Audit R07: the `--relative` prefix is resolved once and every reader restates paths through it.
  it('records what a --relative review launched from a subdirectory is relative to', async () => {
    fs.mkdirSync(path.join(repo, 'sub', 'deeper'), { recursive: true });

    const identity = await resolveGitSourceIdentity({
      repository: repo,
      gitDiffArgv: ['--relative', 'HEAD'],
      invocationCwd: path.join(repo, 'sub', 'deeper'),
    });

    expect(identity.pathPrefix).toBe('sub/deeper');
    expect(rootRelativeReviewedPath(identity, 'x.txt')).toBe('sub/deeper/x.txt');
  });
});

describe('resolveReviewedPathPrefix', () => {
  const root = '/repo';

  it('is empty for a root-relative review, whatever the launch directory', () => {
    expect(resolveReviewedPathPrefix(['HEAD'], root, '/repo/sub')).toBe('');
    expect(resolveReviewedPathPrefix(['--relative', '--no-relative'], root, '/repo/sub')).toBe('');
    // An option value spelled like the flag, and a pathspec after --, are not it.
    expect(resolveReviewedPathPrefix(['-S', '--relative'], root, '/repo/sub')).toBe('');
    expect(resolveReviewedPathPrefix(['--', '--relative'], root, '/repo/sub')).toBe('');
  });

  it('takes --relative=<dir> as written, minus trailing slashes', () => {
    expect(resolveReviewedPathPrefix(['--relative=sub/'], root, root)).toBe('sub');
    expect(resolveReviewedPathPrefix(['--relative=a/b'], root, '/elsewhere')).toBe('a/b');
    expect(resolveReviewedPathPrefix(['--relative', '--relative=sub'], root, '/repo/x')).toBe(
      'sub'
    );
  });

  it('is empty for a bare --relative launched at or outside the root, as git leaves such paths', () => {
    expect(resolveReviewedPathPrefix(['--relative'], root, root)).toBe('');
    expect(resolveReviewedPathPrefix(['--relative'], root, '/other')).toBe('');
  });

  it('restates a reviewed path from the root through the prefix', () => {
    expect(rootRelativeReviewedPath({ pathPrefix: '' }, 'a/b.txt')).toBe('a/b.txt');
    expect(rootRelativeReviewedPath({ pathPrefix: 'sub' }, 'a/b.txt')).toBe('sub/a/b.txt');
  });
});

describe('resolveLocalSourceIdentity', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-identity-local-')));
    fs.mkdirSync(path.join(tmp, 'real'));
    fs.writeFileSync(path.join(tmp, 'real', 'note.txt'), 'hello\n');
    fs.symlinkSync(path.join(tmp, 'real'), path.join(tmp, 'alias'));
    fs.symlinkSync(path.join(tmp, 'real', 'note.txt'), path.join(tmp, 'note-link.txt'));
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('roots a directory review at the physical directory, with nothing on the old side', () => {
    expect(
      resolveLocalSourceIdentity({
        type: 'directory',
        sourcePath: path.join(tmp, 'alias'),
        invocationCwd: '/elsewhere',
      })
    ).toEqual({
      mode: 'directory',
      sourceRoot: path.join(tmp, 'real'),
      invocationCwd: '/elsewhere',
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'none' },
      newSide: { kind: 'directory' },
    });
  });

  it('roots a file review at the parent and pins the one file it follows', () => {
    // scanFile follows a link the user named on purpose; the identity records
    // where that led once, so every later read opens the same file.
    expect(
      resolveLocalSourceIdentity({
        type: 'file',
        sourcePath: path.join(tmp, 'note-link.txt'),
        invocationCwd: '/elsewhere',
      })
    ).toEqual({
      mode: 'file',
      sourceRoot: tmp,
      invocationCwd: '/elsewhere',
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'none' },
      newSide: { kind: 'file', path: path.join(tmp, 'real', 'note.txt') },
    });
  });
});
