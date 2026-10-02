import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  expandContext,
  getDiffLoad,
  getResumeLoad,
  serializeReview,
  tokenizeGitDiffArgs,
} from '@self-review/core';
import type { ReviewState } from '@self-review/core';
import { parseServeArgs } from './args';
import { resolveSession } from './startup';

// A real repository on disk, because every meaningful thing this module does
// — mode detection, the diff, the repository root the server contains paths
// against — is decided by the working directory it runs in.
let tmp: string;
let repo: string;
let plain: string;
let home: string;
const originalCwd = process.cwd();
const originalHome = process.env.HOME;

const GUIDE_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<guide xmlns="urn:self-review-guide:v1">',
  '  <overview>Adds retry logic; start with the wrapper.</overview>',
  '  <group name="Core change">',
  '    <rationale>The retry wrapper everything else calls.</rationale>',
  '    <file path="src/retry.ts"><description>Adds the retry wrapper.</description></file>',
  '  </group>',
  '</guide>',
].join('\n');

function git(...args: string[]): void {
  execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
}

beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'serve-startup-')));

  repo = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  fs.writeFileSync(path.join(repo, 'src', 'retry.ts'), 'export const retries = 1;\n');
  git('add', '-A');
  git('commit', '-qm', 'initial');
  // An unstaged change, so a bare `git diff` has something to show.
  fs.writeFileSync(path.join(repo, 'src', 'retry.ts'), 'export const retries = 3;\n');
  fs.writeFileSync(path.join(repo, 'review.guide.xml'), GUIDE_XML);

  // A directory that is not a repository, for the non-git modes.
  plain = path.join(tmp, 'plain');
  fs.mkdirSync(path.join(plain, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(plain, 'sub', 'note.txt'), 'hello\n');

  // A home of its own, so the reviewer's real user-level config never
  // reaches these sessions and the user-config cases can write one.
  home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  process.env.HOME = home;
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(path.join(home, '.config'), { recursive: true, force: true });
  fs.rmSync(path.join(repo, '.self-review.yaml'), { force: true });
});

afterAll(() => {
  process.chdir(originalCwd);
  process.env.HOME = originalHome;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeUserConfig(yaml: string): void {
  const dir = path.join(home, '.config', 'self-review');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), yaml);
}

describe('resolveSession', () => {
  it('resolves a git session and records the identity the routes authorize against', async () => {
    process.chdir(repo);

    const { session, output } = await resolveSession(parseServeArgs([]));

    expect(session.diffData?.source).toMatchObject({ type: 'git', repository: repo });
    expect(session.diffData?.files.map(f => f.newPath)).toContain('src/retry.ts');
    // There is no separate containment root: the routes ask core, and core
    // authorizes against the identity it reads from — here, an unstaged
    // review compares the index with the working tree at the repository.
    expect(session.sourceIdentity).toEqual({
      mode: 'git',
      sourceRoot: repo,
      invocationCwd: repo,
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'index' },
      newSide: { kind: 'working-tree' },
    });
    // Nothing named the path, so it is inherited: the publisher keeps it
    // inside the launch directory, which a committed config cannot escape.
    expect(output).toEqual({
      path: path.join(repo, 'review.xml'),
      origin: 'inherited',
      baseDir: repo,
    });
    expect(session.config).not.toBeNull();
    expect(session.outputPathInfo?.resolvedOutputPath).toBe(output.path);
  });

  it('populates the guide before returning, so the first diff response carries it', async () => {
    process.chdir(repo);

    const { session } = await resolveSession(parseServeArgs([]));

    // Asserted through the route's own accessor: this is what GET /api/diff
    // answers with, and it is null unless startup populated the session
    // before the listener opened.
    const load = getDiffLoad(session);
    expect(load?.guide?.overview).toBe('Adds retry logic; start with the wrapper.');
    expect(load?.guide?.groups[0].name).toBe('Core change');
  });

  it('looks for the guide next to the output path the argument fixed', async () => {
    process.chdir(repo);
    fs.mkdirSync(path.join(repo, 'out'), { recursive: true });

    const { session, output } = await resolveSession(
      parseServeArgs(['--output', 'out/custom.xml'])
    );

    // The reviewer named it, so it is explicit: it may point anywhere.
    expect(output).toEqual({ path: path.join(repo, 'out', 'custom.xml'), origin: 'explicit' });
    // review.guide.xml is not custom.guide.xml, so no guide is discovered.
    expect(session.guideData).toBeNull();
  });

  // The desktop reaches the same disabled Finish button but offers a native
  // save dialog as the way out. `changeOutputPath` is deliberately absent from
  // the serve adapter, so the browser has no such control: a reviewer who
  // started here would have no exit, having already done the work.
  it('refuses to serve a review it could never save', async () => {
    process.chdir(repo);
    const readOnly = path.join(repo, 'readonly');
    fs.mkdirSync(readOnly, { recursive: true });
    fs.chmodSync(readOnly, 0o500);

    try {
      await expect(
        resolveSession(parseServeArgs(['--output', path.join(readOnly, 'review.xml')]))
      ).rejects.toThrow(/not writable/i);
    } finally {
      fs.chmodSync(readOnly, 0o700);
    }
  });

  it('loads a prior review when --resume-from is given', async () => {
    process.chdir(repo);
    const priorPath = path.join(repo, 'prior.xml');
    const prior: ReviewState = {
      timestamp: '2026-01-01T00:00:00.000Z',
      source: { type: 'git', gitDiffArgs: '', repository: repo },
      files: [
        {
          path: 'src/retry.ts',
          changeType: 'modified',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/retry.ts',
              lineRange: null,
              body: 'Left over from the last pass.',
              category: 'question',
              suggestion: null,
            },
          ],
        },
      ],
    };
    fs.writeFileSync(priorPath, (await serializeReview(prior, priorPath)).xml + '\n');

    const { session } = await resolveSession(parseServeArgs(['--resume-from', 'prior.xml']));

    expect(getResumeLoad(session)?.comments.map(c => c.body)).toEqual([
      'Left over from the last pass.',
    ]);
    expect(getResumeLoad(session)?.viewedFiles).toEqual(['src/retry.ts']);
  });

  it('roots a directory review at the reviewed directory, not the launch directory', async () => {
    process.chdir(plain);

    const { session } = await resolveSession(parseServeArgs(['sub']));

    expect(session.diffData?.source).toMatchObject({
      type: 'directory',
      sourcePath: path.join(plain, 'sub'),
    });
    // Audit A6: the launch directory used to be the containment root while
    // core read under the reviewed one. The identity names the reviewed one.
    expect(session.sourceIdentity).toMatchObject({
      mode: 'directory',
      sourceRoot: path.join(plain, 'sub'),
      invocationCwd: plain,
      oldSide: { kind: 'none' },
      newSide: { kind: 'directory' },
    });
  });

  // Configuration provenance (audit A5). The three sources of an output path
  // and of default diff arguments are trusted differently, and this is the
  // same core decision the desktop makes.
  describe('configuration provenance', () => {
    it("treats the reviewer's user-level output-file as explicit, so it may point outside the launch directory", async () => {
      const elsewhere = path.join(tmp, 'my-reviews');
      fs.mkdirSync(elsewhere, { recursive: true });
      writeUserConfig(`output-file: ${path.join(elsewhere, 'out.xml')}\n`);
      process.chdir(repo);

      const { output, session } = await resolveSession(parseServeArgs([]));

      // Used to be inherited and refused by the publisher's containment at
      // save time; a reviewer's own configuration is their explicit choice.
      expect(output).toEqual({ path: path.join(elsewhere, 'out.xml'), origin: 'explicit' });
      expect(session.outputPathInfo?.resolvedOutputPath).toBe(path.join(elsewhere, 'out.xml'));
    });

    it('contains a project output-file under the launch directory and refuses one that escapes it', async () => {
      fs.writeFileSync(path.join(repo, '.self-review.yaml'), 'output-file: ../escaped.xml\n');
      process.chdir(repo);

      // Inherited and outside the launch directory: the publisher's check
      // refuses it at startup, before a review is served that could never save.
      await expect(resolveSession(parseServeArgs([]))).rejects.toThrow(/not writable.*outside/s);
    });

    it('refuses project default-diff-args that would make git write a file, before any git runs (audit A5 probe)', async () => {
      const sentinel = path.join(tmp, 'sentinel.txt');
      fs.writeFileSync(sentinel, 'untouched\n');
      fs.writeFileSync(
        path.join(repo, '.self-review.yaml'),
        'default-diff-args: "--output=../sentinel.txt"\n'
      );
      process.chdir(repo);

      await expect(resolveSession(parseServeArgs([]))).rejects.toThrow(
        /Refusing default-diff-args from .*\.self-review\.yaml: --output=\.\.\/sentinel\.txt/
      );
      expect(fs.readFileSync(sentinel, 'utf-8')).toBe('untouched\n');
    });

    it('runs configured default-diff-args with shell quoting, through startup, expansion and the recorded argv', async () => {
      fs.writeFileSync(
        path.join(repo, '.self-review.yaml'),
        `default-diff-args: '-S "retries = 3"'\n`
      );
      process.chdir(repo);

      const { session } = await resolveSession(parseServeArgs([]));

      // One argument, and the diff it selects.
      expect(session.sourceIdentity?.gitDiffArgv).toEqual(['-S', 'retries = 3']);
      expect(session.diffData?.files.filter(f => !f.isUntracked).map(f => f.newPath)).toEqual([
        'src/retry.ts',
      ]);
      // The recorded argv (what the document's git-diff-args carries) round-trips.
      const recorded = (session.diffData?.source as { gitDiffArgs: string }).gitDiffArgs;
      expect(recorded).toBe("-S 'retries = 3'");
      expect(tokenizeGitDiffArgs(recorded)).toEqual(['-S', 'retries = 3']);
      // Expansion re-runs the same comparison with the boundary intact.
      const expanded = await expandContext(session, { filePath: 'src/retry.ts', contextLines: 3 });
      expect(expanded?.hunks.length).toBeGreaterThan(0);
    });

    it("does not treat a command-line option's value as the path to review", async () => {
      process.chdir(plain);

      // `-S sub` searches for text; outside a repository with no positional
      // there is nothing to review, rather than a directory review of sub/.
      await expect(resolveSession(parseServeArgs(['-S', 'sub']))).rejects.toThrow(/git repository/);
    });
  });

  it('refuses to serve when there is no repository and no path to review', async () => {
    process.chdir(plain);

    await expect(resolveSession(parseServeArgs([]))).rejects.toThrow(/git repository/);
  });
});
