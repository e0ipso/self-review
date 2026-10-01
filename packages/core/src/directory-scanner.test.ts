// src/main/directory-scanner.test.ts
// Unit tests for directory-scanner module

import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, symlink, opendir } from 'fs/promises';
import { mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, sep } from 'path';
import { tmpdir } from 'os';
import { scanDirectory, scanFile } from './directory-scanner';

// Pass-through spy: the scanner walks the real filesystem, and the test can
// see every directory it opened.
vi.mock('fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, opendir: vi.fn(actual.opendir) };
});

describe('scanDirectory', () => {
  const tempDirs: string[] = [];

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'dir-scanner-test-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('scans a directory with text files', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'hello.ts'), 'export const x = 1;\n');
    await writeFile(join(dir, 'readme.txt'), 'Hello world\n');

    const { files: result } = await scanDirectory(dir);

    expect(result).toHaveLength(2);
    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['hello.ts', 'readme.txt']);
  });

  it('marks all files as added', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'a.ts'), 'const a = 1;\n');
    await writeFile(join(dir, 'b.ts'), 'const b = 2;\n');

    const { files: result } = await scanDirectory(dir);

    for (const file of result) {
      expect(file.changeType).toBe('added');
    }
  });

  it('returns relative file paths', async () => {
    const dir = await createTempDir();
    await mkdir(join(dir, 'src', 'utils'), { recursive: true });
    await writeFile(join(dir, 'src', 'utils', 'helper.ts'), 'export {};\n');
    await writeFile(join(dir, 'src', 'index.ts'), 'import "./utils/helper";\n');

    const { files: result } = await scanDirectory(dir);

    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['src/index.ts', 'src/utils/helper.ts']);
    // Ensure no absolute paths leaked through
    for (const file of result) {
      expect(file.newPath).not.toContain(dir);
    }
  });

  it('handles binary files', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'text.ts'), 'const x = 1;\n');
    // Create a binary file with null bytes
    const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
    await writeFile(join(dir, 'image.png'), binaryContent);

    const { files: result } = await scanDirectory(dir);

    expect(result).toHaveLength(2);
    const binaryFile = result.find(f => f.newPath === 'image.png');
    const textFile = result.find(f => f.newPath === 'text.ts');
    expect(binaryFile).toBeDefined();
    expect(binaryFile!.isBinary).toBe(true);
    expect(binaryFile!.changeType).toBe('added');
    expect(textFile).toBeDefined();
    expect(textFile!.isBinary).toBe(false);
  });

  it('returns empty array for empty directory', async () => {
    const dir = await createTempDir();

    const { files: result } = await scanDirectory(dir);

    expect(result).toEqual([]);
  });

  it('returns empty array for non-existent path', async () => {
    const { files: result } = await scanDirectory('/tmp/non-existent-dir-xyz-12345');

    expect(result).toEqual([]);
  });

  it('includes files without filtering by extension', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'Makefile'), 'all: build\n');
    await writeFile(join(dir, '.gitignore'), 'node_modules/\n');
    await writeFile(join(dir, 'data.json'), '{"key": "value"}\n');
    await writeFile(join(dir, 'noext'), 'plain content\n');

    const { files: result } = await scanDirectory(dir);

    expect(result).toHaveLength(4);
    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['.gitignore', 'Makefile', 'data.json', 'noext']);
  });

  it('skips subdirectories (only includes files)', async () => {
    const dir = await createTempDir();
    await mkdir(join(dir, 'subdir'));
    await writeFile(join(dir, 'root.txt'), 'root\n');
    await writeFile(join(dir, 'subdir', 'nested.txt'), 'nested\n');

    const { files: result } = await scanDirectory(dir);

    expect(result).toHaveLength(2);
    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['root.txt', 'subdir/nested.txt']);
  });

  it('filters files matching ignore patterns', async () => {
    const dir = await createTempDir();
    await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true });
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'node_modules', 'pkg', 'index.js'), 'module.exports = {};\n');
    await writeFile(join(dir, 'src', 'app.ts'), 'const app = 1;\n');
    await writeFile(join(dir, 'readme.txt'), 'Hello\n');

    const { files: result } = await scanDirectory(dir, ['node_modules']);

    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['readme.txt', 'src/app.ts']);
  });

  it('produces parseable hunks with correct line content', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'sample.ts'), 'line1\nline2\nline3\n');

    const { files: result } = await scanDirectory(dir);

    expect(result).toHaveLength(1);
    const file = result[0];
    expect(file.hunks).toHaveLength(1);
    expect(file.hunks[0].lines).toHaveLength(3);
    expect(file.hunks[0].lines[0].type).toBe('addition');
    expect(file.hunks[0].lines[0].content).toBe('line1');
    expect(file.hunks[0].lines[1].content).toBe('line2');
    expect(file.hunks[0].lines[2].content).toBe('line3');
  });
});

describe('scanFile', () => {
  const tempDirs: string[] = [];

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'file-scanner-test-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('scans a single text file', async () => {
    const dir = await createTempDir();
    const filePath = join(dir, 'hello.ts');
    await writeFile(filePath, 'export const x = 1;\n');

    const { files: result } = await scanFile(filePath);

    expect(result).toHaveLength(1);
    expect(result[0].newPath).toBe('hello.ts');
    expect(result[0].changeType).toBe('added');
  });

  it('produces correct hunk content', async () => {
    const dir = await createTempDir();
    const filePath = join(dir, 'sample.ts');
    await writeFile(filePath, 'line1\nline2\nline3\n');

    const { files: result } = await scanFile(filePath);

    expect(result).toHaveLength(1);
    const file = result[0];
    expect(file.hunks).toHaveLength(1);
    expect(file.hunks[0].lines).toHaveLength(3);
    expect(file.hunks[0].lines[0].type).toBe('addition');
    expect(file.hunks[0].lines[0].content).toBe('line1');
  });

  it('returns empty array for non-existent path', async () => {
    const { files: result } = await scanFile('/tmp/non-existent-file-xyz-12345.ts');

    expect(result).toEqual([]);
  });

  it('returns empty array for a directory path', async () => {
    const dir = await createTempDir();

    const { files: result } = await scanFile(dir);

    expect(result).toEqual([]);
  });

  it('handles binary files', async () => {
    const dir = await createTempDir();
    const filePath = join(dir, 'image.png');
    const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
    await writeFile(filePath, binaryContent);

    const { files: result } = await scanFile(filePath);

    expect(result).toHaveLength(1);
    expect(result[0].isBinary).toBe(true);
    expect(result[0].changeType).toBe('added');
  });
});

describe('scanDirectory input budgets', () => {
  const tempDirs: string[] = [];

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'dir-scanner-budget-test-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    vi.mocked(opendir).mockClear();
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  function openedDirectories(): string[] {
    return vi.mocked(opendir).mock.calls.map(call => String(call[0]));
  }

  it.each([['node_modules/'], ['node_modules']])(
    'never opens an ignored directory (pattern %s), however large',
    async pattern => {
      const dir = await createTempDir();
      const ignored = join(dir, 'node_modules', 'big');
      mkdirSync(ignored, { recursive: true });
      for (let i = 0; i < 10_000; i++) {
        writeFileSync(join(ignored, `f${i}.js`), '');
      }
      await mkdir(join(dir, 'src'));
      await writeFile(join(dir, 'src', 'app.ts'), 'const app = 1;\n');
      vi.mocked(opendir).mockClear();

      // A budget far below the ignored tree's size: pruned entries never count.
      const result = await scanDirectory(dir, [pattern], { budgets: { maxEntries: 10 } });

      expect(result.files.map(f => f.newPath)).toEqual(['src/app.ts']);
      expect(result.entryLimitExceeded).toBe(false);
      expect(result.diagnostics).toEqual([]);
      expect(openedDirectories().some(path => path.includes(`${sep}node_modules`))).toBe(false);
      expect(openedDirectories()).toContain(join(dir, 'src'));
    }
  );

  it('stops at the entry budget with an explicit limit-exceeded result, never a partial review', async () => {
    const dir = await createTempDir();
    for (let i = 0; i < 30; i++) {
      await writeFile(join(dir, `f${String(i).padStart(2, '0')}.txt`), `${i}\n`);
    }

    const result = await scanDirectory(dir, [], { budgets: { maxEntries: 10 } });

    expect(result.entryLimitExceeded).toBe(true);
    expect(result.files).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toContain('10');
  });

  it('skips symlinks and FIFOs, and never reads through a link', async () => {
    const dir = await createTempDir();
    const outside = await createTempDir();
    await writeFile(join(outside, 'secret.txt'), 'OUTSIDE-SENTINEL\n');
    await symlink(join(outside, 'secret.txt'), join(dir, 'file-link'));
    await symlink(outside, join(dir, 'dir-link'));
    if (process.platform !== 'win32') {
      execFileSync('mkfifo', [join(dir, 'pipe')]);
    }
    await writeFile(join(dir, 'real.txt'), 'real\n');

    const result = await scanDirectory(dir);

    expect(result.files.map(f => f.newPath)).toEqual(['real.txt']);
    expect(JSON.stringify(result)).not.toContain('OUTSIDE-SENTINEL');
  });

  it('reports an unreadable directory as a diagnostic, not as an empty directory', async () => {
    const result = await scanDirectory('/tmp/non-existent-dir-xyz-12345');

    expect(result.files).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toContain('/tmp/non-existent-dir-xyz-12345');
  });

  it('lists an oversized file without content, with a diagnostic', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'big.txt'), 'z'.repeat(2048));
    await writeFile(join(dir, 'ok.txt'), 'ok\n');

    const result = await scanDirectory(dir, [], { budgets: { maxFileBytes: 1024 } });

    expect(result.files.map(f => f.newPath)).toEqual(['big.txt', 'ok.txt']);
    expect(result.files[0].omittedReason).toMatch(/per-file/);
    expect(result.diagnostics).toHaveLength(1);
  });
});

describe('scanFile input budgets', () => {
  it('reports a missing file as a diagnostic', async () => {
    const result = await scanFile('/tmp/non-existent-file-xyz-12345.ts');

    expect(result.files).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
  });
});
