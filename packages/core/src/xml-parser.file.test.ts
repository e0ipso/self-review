// parseReviewXml against the real filesystem: reading, typed read failures,
// and the resume budgets that are enforced before the document is parsed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseReviewXml, parseReviewXmlString } from './xml-parser';
import { ReviewXmlError } from './xml-errors';
import { MAX_RESUME_ATTACHMENTS, MAX_RESUME_XML_BYTES } from './input-budgets';

const EMPTY_REVIEW = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
</review>`;

function reviewWithAttachments(count: number): string {
  const attachments = Array.from(
    { length: count },
    (_, i) => `      <attachment path=".self-review-assets/img-${i}.png" media-type="image/png" />`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="" repository="/repo">
  <file path="a.ts" change-type="modified" viewed="false">
    <comment>
      <body>see images</body>
      <category>note</category>
${attachments}
    </comment>
  </file>
</review>`;
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ReviewXmlError);
    return (error as ReviewXmlError).code;
  }
  return undefined;
}

describe('parseReviewXml (file reading)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'self-review-test-resume-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads a file and parses it', () => {
    const path = join(dir, 'review.xml');
    writeFileSync(path, EMPTY_REVIEW);

    const result = parseReviewXml(path);

    expect(result.comments).toEqual([]);
    expect(result.gitDiffArgs).toBe('--staged');
  });

  it('throws a typed read error naming the path, never exiting, when the file cannot be read', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const path = join(dir, 'missing.xml');

    let caught: unknown;
    try {
      parseReviewXml(path);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ReviewXmlError);
    expect((caught as ReviewXmlError).code).toBe('read-failed');
    expect((caught as ReviewXmlError).message).toContain(path);
    expect((caught as ReviewXmlError).message).toContain('ENOENT');
    expect(mockExit).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it('refuses an oversized document before parsing it', () => {
    const path = join(dir, 'huge.xml');
    // Not even well-formed: a parse would fail as parse-failed. The budget
    // answers first, so the parser never sees it.
    writeFileSync(path, `<review>${'x'.repeat(MAX_RESUME_XML_BYTES)}`);

    let caught: unknown;
    try {
      parseReviewXml(path);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ReviewXmlError);
    expect((caught as ReviewXmlError).code).toBe('input-too-large');
    expect((caught as ReviewXmlError).message).toContain('16 MiB');
    expect((caught as ReviewXmlError).message).toContain(path);
  });

  it.skipIf(process.platform === 'win32')(
    'refuses a FIFO with a typed read error instead of blocking on it',
    () => {
      const path = join(dir, 'pipe.xml');
      execFileSync('mkfifo', [path]);

      expect(codeOf(() => parseReviewXml(path))).toBe('read-failed');
    }
  );
});

describe('resume attachment budget', () => {
  it('accepts a document at the attachment budget', () => {
    const result = parseReviewXmlString(reviewWithAttachments(MAX_RESUME_ATTACHMENTS));

    expect(result.comments[0].attachments).toHaveLength(MAX_RESUME_ATTACHMENTS);
  });

  it('refuses a document with more attachments than the budget', () => {
    expect(
      codeOf(() => parseReviewXmlString(reviewWithAttachments(MAX_RESUME_ATTACHMENTS + 1)))
    ).toBe('input-too-large');
  });
});
