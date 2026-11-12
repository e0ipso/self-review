import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { adoptResumeDocument, loadResumeDocument } from './startup';
import { createReviewSession } from './review-session';

let directory: string | undefined;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it('adopts parsed feedback with the same provenance and diagnostics as the synchronous API', () => {
  directory = mkdtempSync(join(tmpdir(), 'resume-adoption-'));
  const path = join(directory, 'prior.xml');
  writeFileSync(
    path,
    `<review><file path="x.ts" viewed="true">
    <comment new-line-start="0"><body>keep &amp;lt; text</body>
      <attachment path=".self-review-assets/root.png" media-type="image/png"/>
      <reply><body>reply</body><attachment path=".self-review-assets/reply.png" media-type="image/png"/></reply>
    </comment>
    <comment><body>unsafe attachment</body><attachment path="../unsafe.png" media-type="image/png"/></comment>
  </file></review>`
  );
  const sync = createReviewSession();
  const parsed = loadResumeDocument(sync, path);
  const adopted = createReviewSession();
  expect(adoptResumeDocument(adopted, parsed, path)).toBe(parsed);
  expect(adopted.resumeComments).toBe(parsed.comments);
  expect(adopted.resumeViewedFiles).toEqual(['x.ts']);
  expect(adopted.resumeImportDiagnostics).toEqual(sync.resumeImportDiagnostics);
  expect(adopted.resumeImportDiagnostics.length).toBeGreaterThan(1);
  expect(adopted.attachmentOrigins).toEqual(sync.attachmentOrigins);
  expect([...adopted.attachmentOrigins.keys()]).toEqual([
    '.self-review-assets/root.png',
    '.self-review-assets/reply.png',
  ]);
});
