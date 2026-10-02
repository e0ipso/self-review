import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseReviewXml } from './xml-parser';
import { publishReview, ReviewPublishError } from './review-publisher';
import { createReviewSession, readAttachment, recordResumedAttachments } from './review-handlers';
import type { ReviewSession } from './review-handlers';
import { MAX_IMAGE_BYTES } from './input-budgets';
import type { ReviewComment, ReviewState } from './types';

const PNG_A = Buffer.from('\x89PNG-bytes-of-image-a');
const PNG_B = Buffer.from('\x89PNG-bytes-of-image-b');

let tmp: string;
let docDir: string;
/** A directory that is neither the document's nor the output's, standing in for the launch cwd. */
let elsewhere: string;

function reviewXml(attachments: Array<{ path: string; reply?: boolean }>): string {
  const own = attachments
    .filter(a => !a.reply)
    .map(a => `      <attachment path="${a.path}" media-type="image/png" />`);
  const replies = attachments
    .filter(a => a.reply)
    .map(
      a =>
        `      <reply>\n        <body>see</body>\n        <attachment path="${a.path}" media-type="image/png" />\n      </reply>`
    );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<review xmlns="urn:self-review:v3" timestamp="2026-10-01T00:00:00.000Z" source-path="/src">',
    '  <file path="a.ts" change-type="added" viewed="false">',
    '    <comment>',
    '      <body>look</body>',
    '      <category>note</category>',
    ...own,
    ...replies,
    '    </comment>',
    '  </file>',
    '</review>',
    '',
  ].join('\n');
}

function writeDoc(dir: string, attachments: Array<{ path: string; reply?: boolean }>): string {
  const docPath = path.join(dir, 'review.xml');
  fs.writeFileSync(docPath, reviewXml(attachments));
  return docPath;
}

function writeAsset(dir: string, name: string, bytes: Buffer): string {
  const assetDir = path.join(dir, '.self-review-assets');
  fs.mkdirSync(assetDir, { recursive: true });
  const file = path.join(assetDir, name);
  fs.writeFileSync(file, bytes);
  return file;
}

/** Parse the document and record its attachments, as both hosts do at startup. */
function resume(docPath: string): { session: ReviewSession; diagnostics: string[] } {
  const session = createReviewSession();
  const parsed = parseReviewXml(docPath);
  session.resumeComments = parsed.comments;
  const diagnostics = recordResumedAttachments(session, parsed.comments, docPath);
  return { session, diagnostics };
}

function stateOf(comments: ReviewComment[]): ReviewState {
  return {
    timestamp: '2026-10-02T00:00:00.000Z',
    source: { type: 'directory', sourcePath: '/src' },
    files: [{ path: 'a.ts', changeType: 'added', viewed: false, comments }],
  };
}

function referencesIn(docPath: string): string[] {
  const parsed = parseReviewXml(docPath);
  return parsed.comments.flatMap(c => [
    ...(c.attachments ?? []).map(a => a.fileName),
    ...(c.replies ?? []).flatMap(r => (r.attachments ?? []).map(a => a.fileName)),
  ]);
}

function bytesOf(result: Awaited<ReturnType<typeof readAttachment>>): Buffer {
  if (!result.ok) throw new Error(`expected bytes, got ${result.reason}: ${result.message}`);
  return Buffer.from(result.data);
}

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-attachments-')));
  docDir = path.join(tmp, 'reviews', 'monday');
  elsewhere = path.join(tmp, 'launch-cwd');
  fs.mkdirSync(docDir, { recursive: true });
  fs.mkdirSync(elsewhere, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('resumed attachments resolve against the resumed document', () => {
  it('reads each attachment from the document directory, not the cwd or the output directory', async () => {
    writeAsset(docDir, 'a.png', PNG_A);
    writeAsset(docDir, 'b.png', PNG_B);
    // Same-named decoys in the launch cwd, which is also the output directory here.
    writeAsset(elsewhere, 'a.png', Buffer.from('WRONG-cwd'));
    writeAsset(elsewhere, 'b.png', Buffer.from('WRONG-cwd'));
    const docPath = writeDoc(docDir, [
      { path: '.self-review-assets/a.png' },
      { path: '.self-review-assets/b.png', reply: true },
    ]);

    const { session, diagnostics } = resume(docPath);
    session.outputPathInfo = {
      resolvedOutputPath: path.join(elsewhere, 'review.xml'),
      outputPathWritable: true,
    };

    expect(diagnostics).toEqual([]);
    // The renderer keeps seeing the relative reference the document wrote.
    expect(session.resumeComments[0].attachments?.[0].fileName).toBe('.self-review-assets/a.png');
    expect(bytesOf(await readAttachment(session, '.self-review-assets/a.png'))).toEqual(PNG_A);
    expect(bytesOf(await readAttachment(session, '.self-review-assets/b.png'))).toEqual(PNG_B);
  });

  it('falls back to the current output asset directory for a reference it did not import', async () => {
    writeAsset(elsewhere, 'fresh.png', PNG_B);
    const session = createReviewSession();
    session.outputPathInfo = {
      resolvedOutputPath: path.join(elsewhere, 'review.xml'),
      outputPathWritable: true,
    };
    expect(bytesOf(await readAttachment(session, '.self-review-assets/fresh.png'))).toEqual(PNG_B);
  });
});

describe('attachment reads are authorized', () => {
  it('refuses references outside the asset directory, at import and at read', async () => {
    fs.mkdirSync(path.join(tmp, 'outside'));
    fs.writeFileSync(path.join(tmp, 'outside', 'secret.txt'), 'SENTINEL');
    const outsideRelative = path.relative(docDir, path.join(tmp, 'outside', 'secret.txt'));
    const docPath = writeDoc(docDir, [
      { path: '/etc/passwd' },
      { path: outsideRelative },
      { path: '.self-review-assets/../../../outside/secret.txt' },
    ]);

    const { session, diagnostics } = resume(docPath);
    session.outputPathInfo = {
      resolvedOutputPath: path.join(docDir, 'review.xml'),
      outputPathWritable: true,
    };

    expect(diagnostics).toHaveLength(3);
    expect(diagnostics[0]).toContain('/etc/passwd');
    for (const reference of [
      '/etc/passwd',
      outsideRelative,
      '.self-review-assets/../../../outside/secret.txt',
      path.join(tmp, 'outside', 'secret.txt'),
      '.self-review-assets',
      '.self-review-assets/',
      '.self-review-assets/sub/x.png',
    ]) {
      const result = await readAttachment(session, reference);
      expect(result.ok, reference).toBe(false);
      if (!result.ok) expect(result.reason, reference).toBe('not-authorized');
    }
  });

  it('refuses every read when the session has neither an imported origin nor an output path', async () => {
    const result = await readAttachment(createReviewSession(), '.self-review-assets/a.png');
    expect(result).toMatchObject({ ok: false, reason: 'not-authorized' });
  });

  it('refuses a symlink at the attachment name', async () => {
    fs.mkdirSync(path.join(tmp, 'outside'));
    fs.writeFileSync(path.join(tmp, 'outside', 'secret.txt'), 'SENTINEL');
    fs.mkdirSync(path.join(docDir, '.self-review-assets'));
    fs.symlinkSync(
      path.join(tmp, 'outside', 'secret.txt'),
      path.join(docDir, '.self-review-assets', 'a.png')
    );
    const { session } = resume(writeDoc(docDir, [{ path: '.self-review-assets/a.png' }]));

    const result = await readAttachment(session, '.self-review-assets/a.png');
    expect(result).toMatchObject({ ok: false, reason: 'unsafe-link' });
  });

  it('refuses a symlinked asset directory', async () => {
    fs.mkdirSync(path.join(tmp, 'outside'));
    fs.writeFileSync(path.join(tmp, 'outside', 'a.png'), 'SENTINEL');
    fs.symlinkSync(path.join(tmp, 'outside'), path.join(docDir, '.self-review-assets'));
    const { session } = resume(writeDoc(docDir, [{ path: '.self-review-assets/a.png' }]));

    const result = await readAttachment(session, '.self-review-assets/a.png');
    expect(result).toMatchObject({ ok: false, reason: 'unsafe-link' });
  });

  it.skipIf(process.platform === 'win32')('refuses a FIFO without blocking on it', async () => {
    fs.mkdirSync(path.join(docDir, '.self-review-assets'));
    execFileSync('mkfifo', [path.join(docDir, '.self-review-assets', 'a.png')]);
    const { session } = resume(writeDoc(docDir, [{ path: '.self-review-assets/a.png' }]));

    const result = await readAttachment(session, '.self-review-assets/a.png');
    expect(result).toMatchObject({ ok: false, reason: 'not-regular' });
  });

  it('refuses an attachment over the image budget', async () => {
    const file = writeAsset(docDir, 'a.png', Buffer.alloc(0));
    fs.truncateSync(file, MAX_IMAGE_BYTES + 1);
    const { session } = resume(writeDoc(docDir, [{ path: '.self-review-assets/a.png' }]));

    const result = await readAttachment(session, '.self-review-assets/a.png');
    expect(result).toMatchObject({ ok: false, reason: 'too-large' });
  });

  it('reports a missing attachment as not found', async () => {
    const { session } = resume(writeDoc(docDir, [{ path: '.self-review-assets/a.png' }]));
    const result = await readAttachment(session, '.self-review-assets/a.png');
    expect(result).toMatchObject({ ok: false, reason: 'not-found' });
  });
});

describe('publishing resumed attachments', () => {
  it('copies the bytes into a new output directory so every reference resolves', async () => {
    writeAsset(docDir, 'a.png', PNG_A);
    writeAsset(docDir, 'b.png', PNG_B);
    const docPath = writeDoc(docDir, [
      { path: '.self-review-assets/a.png' },
      { path: '.self-review-assets/b.png', reply: true },
    ]);
    const { session } = resume(docPath);
    const outDir = path.join(tmp, 'published');
    fs.mkdirSync(outDir);
    // A stale file at the old name must not be what the published reference resolves to.
    writeAsset(outDir, 'a.png', Buffer.from('STALE'));
    const outPath = path.join(outDir, 'review.xml');

    await publishReview(stateOf(session.resumeComments), outPath, {
      outputOrigin: 'explicit',
      attachmentOrigins: session.attachmentOrigins,
    });

    const refs = referencesIn(outPath);
    expect(refs).toHaveLength(2);
    expect(refs).not.toContain('.self-review-assets/a.png');
    expect(fs.readFileSync(path.join(outDir, refs[0]))).toEqual(PNG_A);
    expect(fs.readFileSync(path.join(outDir, refs[1]))).toEqual(PNG_B);
    expect(fs.readFileSync(path.join(docDir, '.self-review-assets', 'a.png'))).toEqual(PNG_A);
  });

  it('keeps the existing references when saving back to the document directory', async () => {
    writeAsset(docDir, 'a.png', PNG_A);
    const docPath = writeDoc(docDir, [{ path: '.self-review-assets/a.png' }]);
    const { session } = resume(docPath);

    const result = await publishReview(stateOf(session.resumeComments), docPath, {
      outputOrigin: 'explicit',
      attachmentOrigins: session.attachmentOrigins,
    });

    expect(result.assetPaths).toEqual([]);
    expect(referencesIn(docPath)).toEqual(['.self-review-assets/a.png']);
    expect(fs.readdirSync(path.join(docDir, '.self-review-assets'))).toEqual(['a.png']);
  });

  it('refuses to publish a relocated reference whose bytes cannot be read, writing nothing', async () => {
    const docPath = writeDoc(docDir, [{ path: '.self-review-assets/gone.png' }]);
    const { session } = resume(docPath);
    const outDir = path.join(tmp, 'published');
    fs.mkdirSync(outDir);
    const outPath = path.join(outDir, 'review.xml');

    const error = await publishReview(stateOf(session.resumeComments), outPath, {
      outputOrigin: 'explicit',
      attachmentOrigins: session.attachmentOrigins,
    }).catch(e => e);

    expect(error).toBeInstanceOf(ReviewPublishError);
    expect((error as ReviewPublishError).code).toBe('attachment-unavailable');
    expect((error as ReviewPublishError).message).toContain('.self-review-assets/gone.png');
    expect(fs.readdirSync(outDir)).toEqual([]);
  });

  it('leaves an unimported reference as written rather than reading it', async () => {
    const outDir = path.join(tmp, 'published');
    fs.mkdirSync(outDir);
    const outPath = path.join(outDir, 'review.xml');
    const comment: ReviewComment = {
      id: 'c1',
      filePath: 'a.ts',
      lineRange: null,
      body: 'b',
      category: 'note',
      suggestion: null,
      attachments: [{ id: 'x', fileName: '/etc/passwd', mediaType: 'image/png' }],
    };

    await publishReview(stateOf([comment]), outPath, {
      outputOrigin: 'explicit',
      attachmentOrigins: new Map(),
    });

    expect(referencesIn(outPath)).toEqual(['/etc/passwd']);
    expect(fs.existsSync(path.join(outDir, '.self-review-assets'))).toBe(false);
  });
});
