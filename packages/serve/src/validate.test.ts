import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  containPath,
  parseExpandContextBody,
  parseReviewStateBody,
  MAX_CONTEXT_LINES,
} from './validate';

// A real directory layout so containment is checked against real paths, not
// string arithmetic:
//
//   <tmp>/
//     outside/secret.txt
//     repo-evil/            <- shares a prefix with the root
//     repo/
//       src/index.ts
//       link-out  -> ../outside      (symlink escaping the root)
//       link-in   -> src             (symlink staying inside the root)
//     repo-alias  -> repo            (symlink TO the root)
let tmp: string;
let root: string;

beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'serve-validate-')));
  root = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export {};\n');
  fs.mkdirSync(path.join(tmp, 'outside'));
  fs.writeFileSync(path.join(tmp, 'outside', 'secret.txt'), 'secret\n');
  fs.mkdirSync(path.join(tmp, 'repo-evil'));
  fs.symlinkSync(path.join(tmp, 'outside'), path.join(root, 'link-out'));
  fs.symlinkSync(path.join(root, 'src'), path.join(root, 'link-in'));
  fs.symlinkSync(root, path.join(tmp, 'repo-alias'));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('containPath', () => {
  it('accepts the root itself', () => {
    expect(containPath(root, '.')).toBe(root);
    expect(containPath(root, root)).toBe(root);
  });

  it('accepts a path strictly beneath the root', () => {
    expect(containPath(root, 'src/index.ts')).toBe(path.join(root, 'src', 'index.ts'));
  });

  it('rejects ../ traversal out of the root', () => {
    expect(containPath(root, '../outside/secret.txt')).toBeNull();
    expect(containPath(root, 'src/../../outside/secret.txt')).toBeNull();
  });

  it('treats a whole-path-encoded %2E%2E%2F as a literal filename, never decoding it', () => {
    // searchParams.get() already decoded once. If this string reaches us, it
    // is the filename `%2E%2E%2F`, not a traversal: a second decode would turn
    // an encoded sequence inside a legitimate filename into a real escape.
    expect(containPath(root, '%2E%2E%2F')).toBe(path.join(root, '%2E%2E%2F'));
    expect(containPath(root, '%2E%2E%2Foutside%2Fsecret.txt')).toBe(
      path.join(root, '%2E%2E%2Foutside%2Fsecret.txt')
    );
  });

  it('treats a double-encoded %252E%252E%252F as a literal filename', () => {
    expect(containPath(root, '%252E%252E%252F')).toBe(path.join(root, '%252E%252E%252F'));
  });

  it('rejects an absolute path outside the root', () => {
    expect(containPath(root, path.join(tmp, 'outside', 'secret.txt'))).toBeNull();
    expect(containPath(root, '/etc/passwd')).toBeNull();
  });

  it('rejects a symlink inside the root that points outside it', () => {
    expect(containPath(root, 'link-out')).toBeNull();
    expect(containPath(root, 'link-out/secret.txt')).toBeNull();
  });

  it('accepts a symlink inside the root that stays inside it, returning the real path', () => {
    expect(containPath(root, 'link-in/index.ts')).toBe(path.join(root, 'src', 'index.ts'));
  });

  it('accepts a path beneath the root that does not exist yet (deleted or renamed file)', () => {
    expect(containPath(root, 'src/gone.ts')).toBe(path.join(root, 'src', 'gone.ts'));
    expect(containPath(root, 'link-in/gone.ts')).toBe(path.join(root, 'src', 'gone.ts'));
  });

  it('rejects a missing path whose existing ancestor is a symlink out of the root', () => {
    expect(containPath(root, 'link-out/missing.txt')).toBeNull();
  });

  it('does not fall into the prefix trap: /repo-evil is not under /repo', () => {
    expect(containPath(root, '../repo-evil')).toBeNull();
    expect(containPath(root, path.join(tmp, 'repo-evil', 'x.txt'))).toBeNull();
  });

  it('resolves a root that is itself a symlink and returns real paths', () => {
    const alias = path.join(tmp, 'repo-alias');
    expect(containPath(alias, '.')).toBe(root);
    expect(containPath(alias, 'src/index.ts')).toBe(path.join(root, 'src', 'index.ts'));
  });

  it('returns null when the root does not exist', () => {
    expect(containPath(path.join(tmp, 'no-such-root'), 'x')).toBeNull();
  });
});

describe('parseExpandContextBody', () => {
  it('accepts a well-formed body and returns a typed request', () => {
    expect(parseExpandContextBody({ filePath: 'src/index.ts', contextLines: 20 })).toEqual({
      ok: true,
      value: { filePath: 'src/index.ts', contextLines: 20 },
    });
  });

  it('accepts the bounds themselves: 0 and MAX_CONTEXT_LINES', () => {
    expect(parseExpandContextBody({ filePath: 'a', contextLines: 0 }).ok).toBe(true);
    expect(parseExpandContextBody({ filePath: 'a', contextLines: MAX_CONTEXT_LINES }).ok).toBe(
      true
    );
  });

  it('admits the value the shipped React client sends for "expand whole file"', () => {
    // useExpandContext.ts sends MAX_CONTEXT = 99999 to expand an entire file.
    expect(MAX_CONTEXT_LINES).toBeGreaterThanOrEqual(99999);
  });

  it('rejects contextLines one past the upper bound', () => {
    const result = parseExpandContextBody({ filePath: 'a', contextLines: MAX_CONTEXT_LINES + 1 });
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('error', expect.stringContaining('contextLines'));
  });

  it('rejects a negative contextLines', () => {
    expect(parseExpandContextBody({ filePath: 'a', contextLines: -1 }).ok).toBe(false);
  });

  it('rejects a non-integer contextLines', () => {
    expect(parseExpandContextBody({ filePath: 'a', contextLines: 1.5 }).ok).toBe(false);
    expect(parseExpandContextBody({ filePath: 'a', contextLines: '20' }).ok).toBe(false);
    expect(parseExpandContextBody({ filePath: 'a', contextLines: NaN }).ok).toBe(false);
    expect(parseExpandContextBody({ filePath: 'a', contextLines: Infinity }).ok).toBe(false);
  });

  it('rejects a non-string filePath', () => {
    expect(parseExpandContextBody({ filePath: 42, contextLines: 3 }).ok).toBe(false);
    expect(parseExpandContextBody({ filePath: ['a'], contextLines: 3 }).ok).toBe(false);
    expect(parseExpandContextBody({ filePath: null, contextLines: 3 }).ok).toBe(false);
  });

  it('rejects a missing field', () => {
    const noFile = parseExpandContextBody({ contextLines: 3 });
    expect(noFile.ok).toBe(false);
    expect(noFile).toHaveProperty('error', expect.stringContaining('filePath'));
    const noLines = parseExpandContextBody({ filePath: 'a' });
    expect(noLines.ok).toBe(false);
    expect(noLines).toHaveProperty('error', expect.stringContaining('contextLines'));
  });

  it('rejects an unknown extra field rather than ignoring it', () => {
    const result = parseExpandContextBody({ filePath: 'a', contextLines: 3, cwd: '/' });
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('error', expect.stringContaining('cwd'));
  });

  it('rejects bodies that are not plain objects', () => {
    expect(parseExpandContextBody(null).ok).toBe(false);
    expect(parseExpandContextBody(undefined).ok).toBe(false);
    expect(parseExpandContextBody('{}').ok).toBe(false);
    expect(parseExpandContextBody(['a', 3]).ok).toBe(false);
  });
});

describe('parseReviewStateBody', () => {
  const valid = {
    timestamp: '2026-09-09T00:00:00.000Z',
    source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
    files: [],
  };

  it('accepts exactly what the review panel submits: timestamp, source and files', () => {
    const result = parseReviewStateBody(valid);
    expect(result).toEqual({ ok: true, value: valid });
  });

  it('rejects a body whose files is not an array', () => {
    const result = parseReviewStateBody({ ...valid, files: {} });
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('error', expect.stringContaining('files'));
  });

  it('rejects a body whose timestamp is not a string', () => {
    expect(parseReviewStateBody({ ...valid, timestamp: 1 }).ok).toBe(false);
  });

  it('rejects a body whose source is not an object', () => {
    expect(parseReviewStateBody({ ...valid, source: 'git' }).ok).toBe(false);
    expect(parseReviewStateBody({ ...valid, source: null }).ok).toBe(false);
  });

  it('rejects a missing field', () => {
    const { files: _files, ...noFiles } = valid;
    expect(parseReviewStateBody(noFiles).ok).toBe(false);
  });

  it('rejects an unknown extra field rather than forwarding it', () => {
    // Remote provenance is injected server-side, never accepted from the
    // client — the same split the desktop keeps between renderer and main.
    const result = parseReviewStateBody({ ...valid, remoteUrl: 'https://x/pull/1' });
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('error', expect.stringContaining('remoteUrl'));
  });

  it('rejects bodies that are not plain objects', () => {
    expect(parseReviewStateBody(null).ok).toBe(false);
    expect(parseReviewStateBody('{}').ok).toBe(false);
    expect(parseReviewStateBody([valid]).ok).toBe(false);
  });
});

describe('parseReviewStateBody attachment blobs', () => {
  // A PNG signature: eight bytes that are unmistakably not zeros.
  const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const BASE64 = Buffer.from(BYTES).toString('base64');

  function bodyWith(attachment: unknown, replyAttachment?: unknown) {
    return {
      timestamp: '2026-09-09T00:00:00.000Z',
      source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
      files: [
        {
          path: 'src/index.ts',
          changeType: 'modified',
          viewed: false,
          comments: [
            {
              id: 'c1',
              filePath: 'src/index.ts',
              lineRange: null,
              body: 'see this',
              category: 'bug',
              suggestion: null,
              attachments: [attachment],
              ...(replyAttachment
                ? { replies: [{ id: 'r1', body: 'and this', attachments: [replyAttachment] }] }
                : {}),
            },
          ],
        },
      ],
    };
  }

  function attachmentsOf(result: ReturnType<typeof parseReviewStateBody>) {
    if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
    return result.value.files[0].comments[0];
  }

  it('decodes dataBase64 into the ArrayBuffer the serializer writes to disk', () => {
    const comment = attachmentsOf(
      parseReviewStateBody(
        bodyWith({ id: 'a1', fileName: 'shot.png', mediaType: 'image/png', dataBase64: BASE64 })
      )
    );
    const attachment = comment.attachments![0];
    expect(attachment.data).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(attachment.data!)).toEqual(BYTES);
    // The wire field never survives into the state core is handed.
    expect(attachment).not.toHaveProperty('dataBase64');
    expect(attachment.fileName).toBe('shot.png');
  });

  it('decodes a reply attachment as well as a comment attachment', () => {
    const comment = attachmentsOf(
      parseReviewStateBody(
        bodyWith(
          { id: 'a1', fileName: 'shot.png', mediaType: 'image/png', dataBase64: BASE64 },
          { id: 'a2', fileName: 'reply.png', mediaType: 'image/png', dataBase64: BASE64 }
        )
      )
    );
    expect(new Uint8Array(comment.replies![0].attachments![0].data!)).toEqual(BYTES);
  });

  it('hands over only the attachment bytes, not the Buffer pool behind them', () => {
    // `Buffer.from(x, 'base64')` for a small payload is a view into a shared
    // 8 KB pool. Passing `.buffer` straight through would write the pool —
    // the file on disk would be kilobytes of unrelated memory.
    const comment = attachmentsOf(
      parseReviewStateBody(
        bodyWith({ id: 'a1', fileName: 'shot.png', mediaType: 'image/png', dataBase64: BASE64 })
      )
    );
    expect(comment.attachments![0].data!.byteLength).toBe(BYTES.length);
  });

  it('rejects an attachment carrying data instead of dataBase64', () => {
    // `JSON.stringify(arrayBuffer)` is `{}`. Accepting that would write an
    // empty file with a 200 and no error anywhere, so it must be loud.
    const result = parseReviewStateBody(
      bodyWith({ id: 'a1', fileName: 'shot.png', mediaType: 'image/png', data: {} })
    );
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('error', expect.stringContaining('dataBase64'));
  });

  it('rejects a dataBase64 that is not base64', () => {
    const result = parseReviewStateBody(
      bodyWith({
        id: 'a1',
        fileName: 'shot.png',
        mediaType: 'image/png',
        dataBase64: 'not base64!',
      })
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an empty dataBase64 rather than writing a zero-byte file', () => {
    const result = parseReviewStateBody(
      bodyWith({ id: 'a1', fileName: 'shot.png', mediaType: 'image/png', dataBase64: '' })
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a dataBase64 that is not a string', () => {
    const result = parseReviewStateBody(
      bodyWith({ id: 'a1', fileName: 'shot.png', mediaType: 'image/png', dataBase64: 42 })
    );
    expect(result.ok).toBe(false);
  });

  it('leaves a resumed attachment — one with no blob — untouched', () => {
    // Resumed attachments carry only a path; their bytes are read back
    // through GET /api/attachment, never resubmitted.
    const attachment = {
      id: 'a1',
      fileName: '.self-review-assets/c1-0.png',
      mediaType: 'image/png',
    };
    const comment = attachmentsOf(parseReviewStateBody(bodyWith(attachment)));
    expect(comment.attachments![0]).toEqual(attachment);
  });
});
