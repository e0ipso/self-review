import { expect, expectTypeOf, it } from 'vitest';
import { resolveAttachmentOriginsAtDirectory } from './operations';
import { resolveAttachmentOrigins } from './attachment-origins';
import { recordResumedAttachments } from './review-content';
import { createReviewSession } from './review-session';
import { adoptResumeDocument, loadResumeDocument } from './startup';
import { parseReviewXmlString } from './xml-parser';

const xml = `<review><file path="x.ts"><comment><body>look</body>
<attachment path=".self-review-assets/a.png" media-type="image/png"/>
<reply><body>reply</body><attachment path=".self-review-assets/b.png" media-type="image/png"/></reply>
<attachment path="../bad.png" media-type="image/png"/>
</comment></file></review>`;
const parsed = () => parseReviewXmlString(xml);
const location = { documentDirectory: '/virtual/physical/reviews' };
const documentPath = '/virtual/linked/prior.xml';
const expected = new Map([
  ['.self-review-assets/a.png', '/virtual/physical/reviews/.self-review-assets/a.png'],
  ['.self-review-assets/b.png', '/virtual/physical/reviews/.self-review-assets/b.png'],
]);

it('uses the supplied resolved directory for root and reply attachments', () => {
  const { origins, diagnostics } = resolveAttachmentOrigins(
    parsed().comments,
    documentPath,
    location
  );
  expect(origins).toEqual(expected);
  expect(
    resolveAttachmentOriginsAtDirectory(parsed().comments, location.documentDirectory)
  ).toEqual({ origins, diagnostics });
  expect(diagnostics).toHaveLength(1);
  const session = createReviewSession();
  const prior = session.attachmentOrigins;
  expect(recordResumedAttachments(session, parsed().comments, documentPath, location)).toEqual(
    diagnostics
  );
  expect(session.attachmentOrigins).toEqual(expected);
  expect(session.attachmentOrigins).not.toBe(prior);
});

it('adopts a virtual parsed document without resolving a native path', () => {
  const session = createReviewSession();
  const document = parsed();
  expect(adoptResumeDocument(session, document, documentPath, location)).toBe(document);
  expect(session.attachmentOrigins).toEqual(expected);
  expect(session.resumeComments).toBe(document.comments);
  expect(session.resumeViewedFiles).toBe(document.viewedFiles);
});

it('loads a virtual document with an authoritative reader and resolved location', () => {
  const reader = {
    read(target: string) {
      expect(this).toBe(reader);
      expect(target).toBe(documentPath);
      return { kind: 'ok' as const, content: Buffer.from(xml) };
    },
  };
  const session = createReviewSession();
  loadResumeDocument(session, documentPath, { ...location, reader });
  expect(session.attachmentOrigins).toEqual(expected);
});

it('preserves original reflected call forms and runtime arities', () => {
  expectTypeOf<Parameters<typeof resolveAttachmentOrigins>>().toEqualTypeOf<
    [readonly import('./types').ReviewComment[], string]
  >();
  expectTypeOf<Parameters<typeof recordResumedAttachments>>().toEqualTypeOf<
    [
      Pick<import('./review-session').ReviewSession, 'attachmentOrigins'>,
      readonly import('./types').ReviewComment[],
      string,
    ]
  >();
  expectTypeOf<Parameters<typeof adoptResumeDocument>>().toEqualTypeOf<
    [import('./review-session').ReviewSession, import('./xml-parser').ParsedReview, string]
  >();
  expectTypeOf<Parameters<typeof loadResumeDocument>>().toEqualTypeOf<
    [import('./review-session').ReviewSession, string]
  >();
  expect(resolveAttachmentOrigins).toHaveLength(2);
  expect(recordResumedAttachments).toHaveLength(3);
  expect(adoptResumeDocument).toHaveLength(3);
  expect(loadResumeDocument).toHaveLength(2);
});

it('rejects an unresolved directory without replacing session state', () => {
  const session = createReviewSession();
  const before = { ...session };
  expect(() =>
    adoptResumeDocument(session, parsed(), documentPath, { documentDirectory: 'relative' })
  ).toThrow(TypeError);
  expect(session).toEqual(before);
  expect(session.attachmentOrigins).toBe(before.attachmentOrigins);
});

it('propagates supplied location failure without native recovery or partial adoption', () => {
  const session = createReviewSession();
  const prior = session.attachmentOrigins;
  const error = new Error('location failed');
  expect(() =>
    adoptResumeDocument(session, parsed(), documentPath, {
      get documentDirectory(): string {
        throw error;
      },
    })
  ).toThrow(error);
  expect(session.attachmentOrigins).toBe(prior);
  expect(session.resumeComments).toEqual([]);
});

it('preserves reader failures as the existing typed read error', () => {
  const session = createReviewSession();
  const failure = new Error('virtual read failed');
  try {
    loadResumeDocument(session, documentPath, {
      ...location,
      reader: {
        read() {
          throw failure;
        },
      },
    });
    expect.fail('read must fail');
  } catch (error) {
    expect(error).toMatchObject({ name: 'ReviewXmlError', code: 'read-failed', cause: failure });
  }
  expect(session.resumeComments).toEqual([]);
});

it.each([false, true])('keeps cancellation identity when the reader throws: %s', failRead => {
  const session = createReviewSession();
  const controller = new AbortController();
  const reason = new Error('cancel');
  expect(() =>
    loadResumeDocument(session, documentPath, {
      ...location,
      signal: controller.signal,
      reader: {
        read() {
          controller.abort(reason);
          if (failRead) throw new Error('read also failed');
          return { kind: 'ok', content: Buffer.from(xml) };
        },
      },
    })
  ).toThrow(reason);
  expect(session.resumeComments).toEqual([]);
  expect(session.attachmentOrigins.size).toBe(0);
});
