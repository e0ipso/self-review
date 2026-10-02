// The startup decisions both front ends share, against real files: a real
// repository, real configuration files in a temporary home and project, and
// the audit's own probe (a committed .self-review.yaml that hands git
// --output) with a sentinel file to prove nothing was written.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gitSync } from './test-support/git-env';
import { loadConfigWithProvenance } from './config';
import { tokenizeGitDiffArgs } from './git-diff-args';
import { resolveStartupSource } from './startup-mode';
import { createReviewSession } from './review-handlers';
import { serializeReview } from './xml-serializer';
import type { ReviewState } from './types';
import {
  ConfiguredDiffArgsError,
  loadLocalReview,
  loadResumeDocument,
  publishOptionsFor,
  resolveOutputTarget,
  resolveStartupDiffArgs,
} from './startup';

let tmp: string;
let home: string;
let repo: string;
let plain: string;
const userConfigPath = () => path.join(home, '.config', 'self-review', 'config.yaml');
const projectConfigPath = (dir: string) => path.join(dir, '.self-review.yaml');

function writeUserConfig(yaml: string): void {
  fs.mkdirSync(path.dirname(userConfigPath()), { recursive: true });
  fs.writeFileSync(userConfigPath(), yaml);
}

function loadFrom(cwd: string) {
  return loadConfigWithProvenance({ cwd, homeDir: home });
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-startup-')));
  home = path.join(tmp, 'home');
  repo = path.join(tmp, 'repo');
  plain = path.join(tmp, 'plain');
  fs.mkdirSync(home);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.mkdirSync(path.join(plain, 'sub'), { recursive: true });
  const git = (...args: string[]) => gitSync(args, { cwd: repo });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  fs.writeFileSync(path.join(repo, 'src', 'x.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(repo, 'src', 'y.ts'), 'export const y = 1;\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  fs.writeFileSync(path.join(repo, 'src', 'x.ts'), 'export const x = 2; // a b\n');
  fs.writeFileSync(path.join(repo, 'src', 'y.ts'), 'export const y = 2;\n');
  fs.writeFileSync(path.join(plain, 'sub', 'note.txt'), 'hello\n');
});

afterAll(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(() => {
  fs.rmSync(path.join(home, '.config'), { recursive: true, force: true });
  fs.rmSync(projectConfigPath(repo), { force: true });
});

describe('resolveOutputTarget', () => {
  it('treats a command-line path as explicit, wherever it points', () => {
    expect(resolveOutputTarget('../elsewhere/out.xml', loadFrom(repo), repo)).toEqual({
      path: path.join(tmp, 'elsewhere', 'out.xml'),
      origin: 'explicit',
    });
  });

  it('contains the default under the launch directory', () => {
    expect(resolveOutputTarget(null, loadFrom(repo), repo)).toEqual({
      path: path.join(repo, 'review.xml'),
      origin: 'inherited',
      baseDir: repo,
    });
  });

  it('contains a project output-file: a committed file cannot redirect the save', () => {
    fs.writeFileSync(projectConfigPath(repo), 'output-file: ../outside/review.xml\n');

    const target = resolveOutputTarget(null, loadFrom(repo), repo);

    expect(target).toEqual({
      path: path.join(tmp, 'outside', 'review.xml'),
      origin: 'inherited',
      baseDir: repo,
    });
    expect(publishOptionsFor(target)).toEqual({
      outputOrigin: 'inherited',
      baseDir: repo,
      attachmentOrigins: undefined,
    });
  });

  it("treats the reviewer's own user-level output-file as explicit, so it may leave the repository", () => {
    writeUserConfig(`output-file: ${path.join(home, 'reviews', 'out.xml')}\n`);

    const target = resolveOutputTarget(null, loadFrom(repo), repo);

    expect(target).toEqual({ path: path.join(home, 'reviews', 'out.xml'), origin: 'explicit' });
    expect(publishOptionsFor(target)).toEqual({
      outputOrigin: 'explicit',
      attachmentOrigins: undefined,
    });
  });

  it('lets a project output-file override the user one, and contains it again', () => {
    writeUserConfig(`output-file: ${path.join(home, 'reviews', 'out.xml')}\n`);
    fs.writeFileSync(projectConfigPath(repo), 'output-file: out/review.xml\n');

    expect(resolveOutputTarget(null, loadFrom(repo), repo)).toEqual({
      path: path.join(repo, 'out', 'review.xml'),
      origin: 'inherited',
      baseDir: repo,
    });
  });
});

describe('resolveStartupDiffArgs', () => {
  it('uses the command line when it gave any arguments, without restriction', () => {
    fs.writeFileSync(projectConfigPath(repo), 'default-diff-args: "--staged"\n');

    const resolved = resolveStartupDiffArgs(['-S', 'a b', 'HEAD'], loadFrom(repo), repo);

    expect(resolved).toMatchObject({ gitDiffArgs: ['-S', 'a b', 'HEAD'], origin: 'cli' });
    // Not read as staged: the staged/untracked default follows the arguments run.
    expect(resolved.config.showUntracked).toBe(true);
  });

  it('splits configured arguments with shell quoting, so -S "a b" stays one argument', () => {
    fs.writeFileSync(projectConfigPath(repo), `default-diff-args: '-S "a b" --staged'\n`);

    const resolved = resolveStartupDiffArgs([], loadFrom(repo), repo);

    expect(resolved.gitDiffArgs).toEqual(['-S', 'a b', '--staged']);
    expect(resolved.origin).toBe('project');
    expect(resolved.config.showUntracked).toBe(false);
  });

  it('inserts -- before a configured path argument, resolved against the launch directory', () => {
    writeUserConfig('default-diff-args: "src/x.ts"\n');

    const resolved = resolveStartupDiffArgs([], loadFrom(repo), repo);

    expect(resolved.gitDiffArgs).toEqual(['--', 'src/x.ts']);
    expect(resolved.origin).toBe('user');
  });

  // Audit A5's probe: a committed .self-review.yaml hands git --output, and
  // starting a review overwrote a file outside the repository with diff text
  // before the window opened. Now the arguments are refused before any git
  // command runs, naming the option and the file it came from.
  it('refuses project default-diff-args that would make git write a file (audit A5 probe)', async () => {
    const sentinel = path.join(tmp, 'sentinel.txt');
    fs.writeFileSync(sentinel, 'untouched\n');
    fs.writeFileSync(projectConfigPath(repo), 'default-diff-args: "--output=../sentinel.txt"\n');

    let error: unknown;
    try {
      resolveStartupDiffArgs([], loadFrom(repo), repo);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ConfiguredDiffArgsError);
    expect((error as ConfiguredDiffArgsError).options).toEqual(['--output=../sentinel.txt']);
    expect((error as ConfiguredDiffArgsError).configPath).toBe(projectConfigPath(repo));
    expect((error as Error).message).toMatch(/--output=\.\.\/sentinel\.txt/);
    expect((error as Error).message).toContain(projectConfigPath(repo));
    expect(fs.readFileSync(sentinel, 'utf-8')).toBe('untouched\n');
  });

  it('refuses the external-program options from project config too, each as written', () => {
    fs.writeFileSync(
      projectConfigPath(repo),
      'default-diff-args: "--ext-diff -S --output --textconv --no-ext-diff"\n'
    );

    expect(() => resolveStartupDiffArgs([], loadFrom(repo), repo)).toThrow(
      expect.objectContaining({ options: ['--ext-diff', '--textconv'] })
    );
  });

  it("does not restrict the reviewer's own user-level default-diff-args", () => {
    writeUserConfig('default-diff-args: "--ext-diff"\n');

    expect(resolveStartupDiffArgs([], loadFrom(repo), repo)).toMatchObject({
      gitDiffArgs: ['--ext-diff'],
      origin: 'user',
    });
  });
});

describe('resolveStartupSource', () => {
  it("does not take an option's value for the file to review", () => {
    // `-S src/x.ts` searches for that text; the review is of the repository.
    expect(resolveStartupSource(['-S', 'src/x.ts'], repo)).toEqual({ mode: 'git' });
    expect(resolveStartupSource(['-S', 'sub'], plain)).toEqual({ mode: 'welcome' });
  });

  it('selects the first positional, after -- too, resolved against the launch directory', () => {
    expect(resolveStartupSource(['sub'], plain)).toEqual({
      mode: 'directory',
      sourcePath: path.join(plain, 'sub'),
    });
    expect(resolveStartupSource(['--', 'sub/note.txt'], plain)).toEqual({
      mode: 'file',
      sourcePath: path.join(plain, 'sub', 'note.txt'),
    });
  });
});

describe('loadLocalReview', () => {
  const log = () => {};

  it('records the git argv so a search value with a space round-trips through the document', async () => {
    fs.writeFileSync(projectConfigPath(repo), `default-diff-args: '-S "a b"'\n`);
    const { gitDiffArgs, config } = resolveStartupDiffArgs([], loadFrom(repo), repo);

    const { payload, identity } = await loadLocalReview(
      { mode: 'git' },
      gitDiffArgs,
      config,
      repo,
      log
    );

    expect(payload.source).toEqual({ type: 'git', gitDiffArgs: "-S 'a b'", repository: repo });
    expect(tokenizeGitDiffArgs((payload.source as { gitDiffArgs: string }).gitDiffArgs)).toEqual(
      gitDiffArgs
    );
    // Only x.ts contains "a b" on one side (the config file itself rides along untracked).
    expect(payload.files.filter(f => !f.isUntracked).map(f => f.newPath)).toEqual(['src/x.ts']);
    expect(identity).toMatchObject({ mode: 'git', sourceRoot: repo, gitDiffArgv: ['-S', 'a b'] });
  });

  it('applies the configured ignore patterns to a git review', async () => {
    fs.writeFileSync(projectConfigPath(repo), 'ignore:\n  - src/y.ts\n');
    const loaded = loadFrom(repo);

    const { payload } = await loadLocalReview({ mode: 'git' }, [], loaded.config, repo, log);

    expect(payload.files.filter(f => !f.isUntracked).map(f => f.newPath)).toEqual(['src/x.ts']);
  });

  it('scans a directory and a file with their own identities', async () => {
    const loaded = loadFrom(plain);
    const dir = await loadLocalReview(
      { mode: 'directory', sourcePath: path.join(plain, 'sub') },
      [],
      loaded.config,
      plain,
      log
    );
    expect(dir.payload.source).toEqual({ type: 'directory', sourcePath: path.join(plain, 'sub') });
    expect(dir.payload.files.map(f => f.newPath)).toEqual(['note.txt']);
    expect(dir.identity).toMatchObject({ mode: 'directory', sourceRoot: path.join(plain, 'sub') });

    const file = await loadLocalReview(
      { mode: 'file', sourcePath: path.join(plain, 'sub', 'note.txt') },
      [],
      loaded.config,
      plain,
      log
    );
    expect(file.payload.source).toEqual({
      type: 'file',
      sourcePath: path.join(plain, 'sub', 'note.txt'),
    });
    expect(file.identity).toMatchObject({ mode: 'file', sourceRoot: path.join(plain, 'sub') });
  });

  it('yields an empty payload with no identity for a welcome source', async () => {
    const { payload, identity } = await loadLocalReview(
      { mode: 'welcome' },
      [],
      loadFrom(plain).config,
      plain,
      log
    );
    expect(payload).toEqual({ files: [], source: { type: 'welcome' } });
    expect(identity).toBeNull();
  });
});

describe('loadResumeDocument', () => {
  it('puts the prior comments, viewed files and attachment origins on the session', async () => {
    const docDir = path.join(tmp, 'saved');
    fs.mkdirSync(docDir, { recursive: true });
    const prior: ReviewState = {
      timestamp: '2026-01-01T00:00:00.000Z',
      source: { type: 'git', gitDiffArgs: '', repository: repo },
      files: [
        {
          path: 'src/x.ts',
          changeType: 'modified',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/x.ts',
              lineRange: null,
              body: 'Left over.',
              category: 'question',
              suggestion: null,
              attachments: [
                { id: 'a1', fileName: '.self-review-assets/a.png', mediaType: 'image/png' },
              ],
            },
          ],
        },
      ],
    };
    const resumePath = path.join(docDir, 'prior.xml');
    fs.writeFileSync(resumePath, (await serializeReview(prior, resumePath)).xml + '\n');
    const session = createReviewSession();

    const parsed = loadResumeDocument(session, resumePath);

    expect(parsed.comments.map(c => c.body)).toEqual(['Left over.']);
    expect(session.resumeComments).toBe(parsed.comments);
    expect(session.resumeViewedFiles).toEqual(['src/x.ts']);
    expect(session.resumeImportDiagnostics).toEqual([]);
    expect(session.attachmentOrigins.get('.self-review-assets/a.png')).toBe(
      path.join(docDir, '.self-review-assets', 'a.png')
    );
  });

  it('throws for a document that cannot be read, leaving the session untouched', () => {
    const session = createReviewSession();

    expect(() => loadResumeDocument(session, path.join(tmp, 'missing.xml'))).toThrow();
    expect(session.resumeComments).toEqual([]);
  });
});
