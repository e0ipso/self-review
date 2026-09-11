import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getDiffLoad, getResumeLoad, serializeReview } from '@self-review/core';
import type { ReviewState } from '@self-review/core';
import { parseServeArgs } from './args';
import { resolveSession } from './startup';

// A real repository on disk, because every meaningful thing this module does
// — mode detection, the diff, the repository root the server contains paths
// against — is decided by the working directory it runs in.
let tmp: string;
let repo: string;
let plain: string;
const originalCwd = process.cwd();

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
});

afterEach(() => {
  process.chdir(originalCwd);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('resolveSession', () => {
  it('resolves a git session and roots containment at the repository the diff came from', async () => {
    process.chdir(repo);

    const { session, repositoryRoot, outputPath } = await resolveSession(parseServeArgs([]));

    expect(session.diffData?.source).toMatchObject({ type: 'git', repository: repo });
    expect(session.diffData?.files.map(f => f.newPath)).toContain('src/retry.ts');
    // The root handed to the server must be the same value core resolves
    // against, or containment guarantees nothing.
    expect(repositoryRoot).toBe(
      session.diffData?.source.type === 'git' ? session.diffData.source.repository : null
    );
    expect(outputPath).toBe(path.join(repo, 'review.xml'));
    expect(session.config).not.toBeNull();
    expect(session.outputPathInfo?.resolvedOutputPath).toBe(outputPath);
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

    const { session, outputPath } = await resolveSession(
      parseServeArgs(['--output', 'out/custom.xml'])
    );

    expect(outputPath).toBe(path.join(repo, 'out', 'custom.xml'));
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
    fs.writeFileSync(priorPath, (await serializeReview(prior, priorPath)) + '\n');

    const { session } = await resolveSession(parseServeArgs(['--resume-from', 'prior.xml']));

    expect(getResumeLoad(session)?.comments.map(c => c.body)).toEqual([
      'Left over from the last pass.',
    ]);
    expect(getResumeLoad(session)?.viewedFiles).toEqual(['src/retry.ts']);
  });

  it('roots containment at the working directory for a directory review, matching core', async () => {
    process.chdir(plain);

    const { session, repositoryRoot } = await resolveSession(parseServeArgs(['sub']));

    expect(session.diffData?.source).toMatchObject({
      type: 'directory',
      sourcePath: path.join(plain, 'sub'),
    });
    expect(repositoryRoot).toBe(plain);
  });

  it('refuses to serve when there is no repository and no path to review', async () => {
    process.chdir(plain);

    await expect(resolveSession(parseServeArgs([]))).rejects.toThrow(/git repository/);
  });
});
