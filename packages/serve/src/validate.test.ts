import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { containPath, parseExpandContextBody, MAX_CONTEXT_LINES } from './validate';

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
    expect(parseExpandContextBody({ filePath: 'a', contextLines: MAX_CONTEXT_LINES }).ok).toBe(true);
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
