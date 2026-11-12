// Execute the installed historical package, not a projection of today's exports.
// The small emitted host bundles pure policies exactly as serve does; Core stays external.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as currentCore from '@self-review/core';
import { createPublicationOperations, createReviewOperations } from './review-operations';
import { installedServeEngine } from './engine-contract';
import { validateCompatibleReviewState } from './core-compatibility';
import { ReviewSubmission } from './review-submission';
import { createRequestValidation } from './validate';
import type { ReviewState } from '@self-review/core';
import { createBoundReviewServer, listenLoopback } from './bound-server';
import { REQUEST_SHUTDOWN } from './request-admission';

type Host = {
  core: typeof currentCore;
  createPublicationOperations: typeof createPublicationOperations;
  createReviewOperations: typeof createReviewOperations;
  installedServeEngine: typeof installedServeEngine;
  validateCompatibleReviewState: typeof validateCompatibleReviewState;
  ReviewSubmission: typeof ReviewSubmission;
  createRequestValidation: typeof createRequestValidation;
  createBoundReviewServer: typeof createBoundReviewServer;
  listenLoopback: typeof listenLoopback;
  REQUEST_SHUTDOWN: typeof REQUEST_SHUTDOWN;
};
let directory: string;
let previous: Host;
const current: Host = {
  core: currentCore,
  createPublicationOperations,
  createReviewOperations,
  installedServeEngine,
  validateCompatibleReviewState,
  ReviewSubmission,
  createRequestValidation,
  createBoundReviewServer,
  listenLoopback,
  REQUEST_SHUTDOWN,
};

beforeAll(async () => {
  const stateDir = join(
    process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'),
    'self-review-tests'
  );
  fs.mkdirSync(stateDir, { recursive: true });
  directory = fs.mkdtempSync(join(stateDir, 'published-core-'));
  const output = join(directory, 'host.mjs');
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const historical = fileURLToPath(import.meta.resolve('published-core-2-0-4'));
  const manifest = JSON.parse(
    fs.readFileSync(join(dirname(historical), '..', 'package.json'), 'utf8')
  );
  expect(manifest.name).toBe('@self-review/core');
  expect(manifest.version).toBe('2.0.4');
  await build({
    stdin: {
      contents: `
        export * as core from '@self-review/core';
        export { createPublicationOperations, createReviewOperations } from './review-operations';
        export { installedServeEngine } from './engine-contract';
        export { validateCompatibleReviewState } from './core-compatibility';
        export { ReviewSubmission } from './review-submission';
        export { createRequestValidation } from './validate';
        export { createBoundReviewServer, listenLoopback } from './bound-server';
        export { REQUEST_SHUTDOWN } from './request-admission';
      `,
      resolveDir: sourceDir,
    },
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    plugins: [
      {
        name: 'installed-core-with-bundled-validation',
        setup(plugin) {
          plugin.onResolve({ filter: /^@self-review\/core$/ }, () => ({
            path: historical,
            external: true,
          }));
          plugin.onResolve({ filter: /^@self-review\/core\/validation$/ }, () => ({
            path: join(sourceDir, '../../core/src/validation.ts'),
          }));
        },
      },
    ],
  });
  previous = await import(/* @vite-ignore */ pathToFileURL(output).href);
}, 10_000);
afterAll(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});

for (const peer of ['published 2.0.4', 'current source'] as const) {
  describe(peer, () => {
    function fixture() {
      const host = peer === 'published 2.0.4' ? previous : current;
      const root = fs.mkdtempSync(join(directory, 'review-'));
      fs.writeFileSync(join(root, 'a.txt'), 'old\n');
      const session = host.core.createReviewSession();
      const source = { type: 'directory' as const, sourcePath: root };
      const identity = host.core.resolveLocalSourceIdentity({ ...source, invocationCwd: root });
      const payload = {
        source,
        files: [
          {
            oldPath: 'a.txt',
            newPath: 'a.txt',
            changeType: 'modified' as const,
            isBinary: false,
            hunks: [],
          },
        ],
      };
      host.core.commitDiffData(session, payload, identity);
      const output = { path: join(root, 'review.xml'), origin: 'explicit' as const };
      const state: ReviewState = { timestamp: '2026-01-01T00:00:00Z', source, files: [] };
      return { host, root, session, source, identity, payload, output, state };
    }

    it('uses that peer for strict route parsing and typed fallback validation', () => {
      const { host, state } = fixture();
      const parse = host.createRequestValidation(host.installedServeEngine);
      expect(parse.parseReviewStateBody({ ...state, extension: true })).toEqual({
        ok: false,
        error: 'unknown field: extension',
      });
      expect(parse.parseReviewStateBody({ ...state, files: [null] })).toMatchObject({ ok: false });
      expect(
        parse.parseSuggestionApplyBody({
          filePath: 'a.txt',
          lineRange: null,
          suggestion: { originalCode: 'a', proposedCode: 'b' },
        })
      ).toMatchObject({ ok: true });
      expect(parse.parseExpandContextBody({ filePath: 'a.txt', contextLines: 100_000 })).toEqual({
        ok: false,
        error: 'contextLines must be an integer between 0 and 99999',
      });
    });

    it('keeps installed error identity for validation and ownership refusals before writes', async () => {
      const { host, root, session, output, state } = fixture();
      if (peer === 'published 2.0.4') {
        expect(host.core).not.toHaveProperty('validateReviewState');
        expect(host.core).not.toHaveProperty('applySuggestionForSessionAsync');
        expect(host.core.ReviewPublishError).not.toBe(currentCore.ReviewPublishError);
      }
      expect(() => host.validateCompatibleReviewState({ ...state, files: null })).toThrow(
        host.core.ReviewXmlError
      );
      const operations = host.createPublicationOperations(session, output);
      const submission = new host.ReviewSubmission({ publication: operations }, () => {});
      expect(submission.begin()).toBe(true);
      const refusal = await submission.publish({
        ...state,
        source: { ...state.source, sourcePath: '/foreign' } as ReviewState['source'],
      });
      expect(refusal).toMatchObject({ ok: false, code: 'validation-failed' });
      expect(submission.completed).toBe(false);
      expect(fs.readdirSync(root)).toEqual(['a.txt']);
      session.diffData = null;
      expect(() => operations.publishReview(state)).toThrow(host.core.ReviewPublishError);
    });

    it('rejects inconsistent comment ownership with the installed error class before publication', async () => {
      const { host, root, session, output, state } = fixture();
      const malformed: ReviewState = {
        ...state,
        files: [
          {
            path: 'a.txt',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: 'c',
                filePath: 'b.txt',
                body: 'feedback',
                category: 'bug',
                lineRange: null,
                suggestion: null,
              },
            ],
          },
        ],
      };
      expect(() => host.validateCompatibleReviewState(malformed)).toThrow(host.core.ReviewXmlError);
      expect(() => host.validateCompatibleReviewState(malformed)).toThrowError(
        expect.objectContaining({ code: 'invalid-state' })
      );
      expect(
        host.createRequestValidation(host.installedServeEngine).parseReviewStateBody(malformed)
      ).toEqual({
        ok: false,
        error:
          'Invalid review state: review.files[0].comments[0].filePath must match its containing file path',
      });
      const operations = host.createPublicationOperations(session, output);
      const publish = vi.spyOn(operations, 'publishReview');
      const server = host.createBoundReviewServer({
        operations,
        publication: operations,
        capability: 'key',
      });
      try {
        const { url } = await host.listenLoopback(server);
        const response = await fetch(url + 'api/review', {
          method: 'POST',
          headers: { authorization: 'Bearer key', 'content-type': 'application/json' },
          body: JSON.stringify(malformed),
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error:
            'Invalid review state: review.files[0].comments[0].filePath must match its containing file path',
        });
        expect(publish).not.toHaveBeenCalled();
      } finally {
        const drain = server[host.REQUEST_SHUTDOWN]();
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        await drain;
      }
      expect(session.reviewState).toBeNull();
      expect(fs.readdirSync(root)).toEqual(['a.txt']);
      expect(malformed.files[0].comments[0].filePath).toBe('b.txt');
    });

    it('preserves source aliases, real Apply outcomes, publication and resumed attachment origins', async () => {
      const { host, root, session, payload, identity, output, state } = fixture();
      expect(session.diffData).toBe(payload);
      expect(session.sourceIdentity).toBe(identity);
      const operations = host.createPublicationOperations(session, output);
      expect(operations.authorizeReviewedPath('a.txt').ok).toBe(true);
      expect(operations.authorizeReviewedPath('../outside').ok).toBe(false);
      const applied = await operations.applySuggestionForSession({
        filePath: 'a.txt',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'old', proposedCode: 'new' },
      });
      expect(applied).toMatchObject({ status: 'applied', filePath: 'a.txt' });
      expect(fs.readFileSync(join(root, 'a.txt'), 'utf8')).toBe('new\n');
      const refused = await operations.applySuggestionForSession({
        filePath: 'a.txt',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'old', proposedCode: 'another' },
      });
      expect(refused.status).toBe('refused');
      const review: ReviewState = {
        ...state,
        remoteUrl: 'spoof',
        remoteHeadSha: 'spoof',
        files: [
          {
            path: 'a.txt',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'c',
                filePath: 'a.txt',
                lineRange: null,
                suggestion: null,
                body: 'keep this',
                category: 'note',
                attachments: [
                  {
                    id: 'image',
                    fileName: 'pic.png',
                    mediaType: 'image/png',
                    data: new Uint8Array([1, 2, 3]).buffer,
                  },
                ],
              },
            ],
          },
        ],
      };
      const submission = new host.ReviewSubmission({ publication: operations }, () => {});
      expect(submission.begin()).toBe(true);
      expect(await submission.publish(review)).toEqual({ ok: true, outputPath: output.path });
      expect(submission.completed).toBe(true);
      expect(submission.begin()).toBe(false);
      const xml = fs.readFileSync(output.path, 'utf8');
      expect(xml).not.toContain('remote-');
      expect(xml).toContain('keep this');
      const resumed = host.core.createReviewSession();
      const parsed = host.core.loadResumeDocument(resumed, output.path);
      expect(host.core.getResumeLoad(resumed)).toMatchObject({
        viewedFiles: ['a.txt'],
        comments: [{ body: 'keep this' }],
      });
      const asset = parsed.comments[0].attachments![0].fileName;
      expect(resumed.attachmentOrigins.has(asset)).toBe(true);
      const adopted = host.core.createReviewSession();
      host.installedServeEngine.adoptResume(adopted, parsed, output.path);
      expect(adopted.attachmentOrigins.has(asset)).toBe(true);
      fs.mkdirSync(join(root, 'relocated'));
      const nextOutput = { path: join(root, 'relocated', 'next.xml'), origin: 'explicit' as const };
      host.core.commitDiffData(adopted, payload, identity);
      const legacy = new host.ReviewSubmission(
        host.createReviewOperations(adopted, nextOutput),
        () => {}
      );
      expect(legacy.begin()).toBe(true);
      expect(
        await legacy.publish({
          ...review,
          files: [{ ...review.files[0], comments: parsed.comments }],
        })
      ).toEqual({ ok: true, outputPath: nextOutput.path });
      expect(adopted.reviewState?.files[0].comments[0].body).toBe('keep this');
      expect(fs.readFileSync(nextOutput.path, 'utf8')).toContain('keep this');
      const relocatedAsset = host.core.parseReviewXml(nextOutput.path).comments[0].attachments![0]
        .fileName;
      expect(fs.readFileSync(join(dirname(nextOutput.path), relocatedAsset))).toEqual(
        Buffer.from([1, 2, 3])
      );
    });

    it.each(['capture', 'throw', 'reject'] as const)(
      'keeps actual publication committed with a %s diagnostic reporter',
      async behavior => {
        const { host, session, output, state } = fixture();
        const report = vi.fn(() => {
          if (behavior === 'throw') throw new Error('report failed');
          if (behavior === 'reject') return Promise.reject(new Error('report failed'));
        });
        const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          const operations = host.createPublicationOperations(session, output, undefined, report);
          const result = await operations.publishReview({
            ...state,
            files: [
              {
                path: 'a.txt',
                changeType: 'modified',
                viewed: true,
                comments: [
                  {
                    id: 'c',
                    filePath: 'a.txt',
                    lineRange: null,
                    suggestion: null,
                    body: 'retained',
                    category: 'note',
                    attachments: [
                      {
                        id: 'a',
                        fileName: 'a.png',
                        mediaType: 'image/png',
                        data: new Uint8Array([1, 2]).buffer,
                      },
                    ],
                  },
                ],
              },
            ],
          });
          expect(result.outputPath).toBe(output.path);
          const parsed = host.core.parseReviewXml(output.path);
          expect(parsed.comments[0].body).toBe('retained');
          expect(
            fs.readFileSync(join(dirname(output.path), parsed.comments[0].attachments![0].fileName))
          ).toEqual(Buffer.from([1, 2]));
          expect(session.reviewState).toBeNull();
          if (peer === 'current source') {
            expect(report).toHaveBeenCalledWith(
              expect.stringContaining('Wrote 1 attachment file(s)')
            );
            expect(stderr).not.toHaveBeenCalled();
          } else {
            // 2.0.4 ignores per-publication reporters; keep that engine's stderr behavior.
            expect(stderr).toHaveBeenCalledWith(
              expect.stringContaining('Wrote 1 attachment file(s)')
            );
          }
        } finally {
          stderr.mockRestore();
        }
      }
    );

    it('replaces every supplied remote value using owned session metadata', async () => {
      const { host, session, state, output } = fixture();
      session.diffData!.remote = {
        remoteUrl: 'https://github.com/o/r/pull/1',
        remoteForge: 'github',
        remoteBaseSha: 'aaa',
        remoteHeadSha: 'bbb',
        temporaryClone: false,
        threadSyncAvailable: true,
      };
      await host.createPublicationOperations(session, output).publishReview({
        ...state,
        remoteUrl: 'spoof',
        remoteForge: 'gitlab',
        remoteBaseSha: 'spoof',
        remoteHeadSha: 'spoof',
      });
      const xml = fs.readFileSync(output.path, 'utf8');
      expect(xml).toContain('remote-url="https://github.com/o/r/pull/1"');
      expect(xml).toContain('remote-forge="github"');
      expect(xml).toContain('remote-base-sha="aaa"');
      expect(xml).toContain('remote-head-sha="bbb"');
      expect(xml).not.toContain('spoof');
    });
  });
}
