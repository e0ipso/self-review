// src/main/directory-scanner.test.ts
// Unit tests for directory-scanner module

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanDirectory, scanFile } from './directory-scanner';

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

    const result = await scanDirectory(dir);

    expect(result).toHaveLength(2);
    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['hello.ts', 'readme.txt']);
  });

  it('marks all files as added', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'a.ts'), 'const a = 1;\n');
    await writeFile(join(dir, 'b.ts'), 'const b = 2;\n');

    const result = await scanDirectory(dir);

    for (const file of result) {
      expect(file.changeType).toBe('added');
    }
  });

  it('returns relative file paths', async () => {
    const dir = await createTempDir();
    await mkdir(join(dir, 'src', 'utils'), { recursive: true });
    await writeFile(join(dir, 'src', 'utils', 'helper.ts'), 'export {};\n');
    await writeFile(join(dir, 'src', 'index.ts'), 'import "./utils/helper";\n');

    const result = await scanDirectory(dir);

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

    const result = await scanDirectory(dir);

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

    const result = await scanDirectory(dir);

    expect(result).toEqual([]);
  });

  it('returns empty array for non-existent path', async () => {
    const result = await scanDirectory('/tmp/non-existent-dir-xyz-12345');

    expect(result).toEqual([]);
  });

  it('includes files without filtering by extension', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'Makefile'), 'all: build\n');
    await writeFile(join(dir, '.gitignore'), 'node_modules/\n');
    await writeFile(join(dir, 'data.json'), '{"key": "value"}\n');
    await writeFile(join(dir, 'noext'), 'plain content\n');

    const result = await scanDirectory(dir);

    expect(result).toHaveLength(4);
    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['.gitignore', 'Makefile', 'data.json', 'noext']);
  });

  it('skips subdirectories (only includes files)', async () => {
    const dir = await createTempDir();
    await mkdir(join(dir, 'subdir'));
    await writeFile(join(dir, 'root.txt'), 'root\n');
    await writeFile(join(dir, 'subdir', 'nested.txt'), 'nested\n');

    const result = await scanDirectory(dir);

    expect(result).toHaveLength(2);
    const paths = result.map(f => f.newPath).sort();
    expect(paths).toEqual(['root.txt', 'subdir/nested.txt']);
  });

  it('produces parseable hunks with correct line content', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'sample.ts'), 'line1\nline2\nline3\n');

    const result = await scanDirectory(dir);

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

    const result = await scanFile(filePath);

    expect(result).toHaveLength(1);
    expect(result[0].newPath).toBe('hello.ts');
    expect(result[0].changeType).toBe('added');
  });

  it('produces correct hunk content', async () => {
    const dir = await createTempDir();
    const filePath = join(dir, 'sample.ts');
    await writeFile(filePath, 'line1\nline2\nline3\n');

    const result = await scanFile(filePath);

    expect(result).toHaveLength(1);
    const file = result[0];
    expect(file.hunks).toHaveLength(1);
    expect(file.hunks[0].lines).toHaveLength(3);
    expect(file.hunks[0].lines[0].type).toBe('addition');
    expect(file.hunks[0].lines[0].content).toBe('line1');
  });

  it('returns empty array for non-existent path', async () => {
    const result = await scanFile('/tmp/non-existent-file-xyz-12345.ts');

    expect(result).toEqual([]);
  });

  it('returns empty array for a directory path', async () => {
    const dir = await createTempDir();

    const result = await scanFile(dir);

    expect(result).toEqual([]);
  });

  it('handles binary files', async () => {
    const dir = await createTempDir();
    const filePath = join(dir, 'image.png');
    const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
    await writeFile(filePath, binaryContent);

    const result = await scanFile(filePath);

    expect(result).toHaveLength(1);
    expect(result[0].isBinary).toBe(true);
    expect(result[0].changeType).toBe('added');
  });
});
