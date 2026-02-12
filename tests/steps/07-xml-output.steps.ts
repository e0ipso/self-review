/**
 * Step definitions for Feature 07: XML Output.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XMLParser } from 'fast-xml-parser';
import {
  getPage,
  getStdout,
  getStderr,
  triggerCommentIcon,
  readOutputFile,
  outputFileExists,
} from './app';

const { When, Then } = createBdd();

// Helper to perform a drag selection across a line range
async function selectLineRange(
  filePath: string,
  start: number,
  end: number,
  side: 'old' | 'new' = 'new'
) {
  const page = getPage();
  const section = page.locator(`[data-testid="file-section-${filePath}"]`);
  const gutter = section.locator(
    `[data-testid="${side}-line-${filePath}-${start}"]`
  );
  await gutter.hover();
  const startIcon = section.locator(
    `[data-testid="comment-icon-${side}-${start}"]`
  );
  const box = await startIcon.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    // Dispatch mousemove from browser context, scoped to the file section
    const secSel = `[data-testid="file-section-${filePath}"]`;
    await page.evaluate(({ ln, s, secSelector }) => {
      const container = document.querySelector(secSelector);
      if (!container) return;
      const el = container.querySelector(`[data-line-number="${ln}"][data-line-side="${s}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        document.dispatchEvent(new MouseEvent('mousemove', {
          clientX: rect.x + 20,
          clientY: rect.y + rect.height / 2,
          bubbles: true,
        }));
      }
    }, { ln: end, s: side, secSelector: secSel });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
}

// ── When: composite actions for XML scenarios ──

When(
  'I add a comment {string} on new line {int} of {string}',
  async ({}, body: string, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
    const page = getPage();
    await page.locator('[data-testid="comment-input"] textarea').fill(body);
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

When(
  'I add a file-level comment {string} on {string}',
  async ({}, body: string, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="add-file-comment-${filePath}"]`).click();
    await page.locator('[data-testid="comment-input"] textarea').fill(body);
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

When(
  'I add a comment {string} with category {string} on new line {int} of {string}',
  async (
    {},
    body: string,
    category: string,
    line: number,
    filePath: string
  ) => {
    await triggerCommentIcon(filePath, line, 'new');
    const page = getPage();
    await page.locator('[data-testid="category-selector"]').click();
    await page.locator(`[data-testid="category-option-${category}"]`).click();
    await page.locator('[data-testid="comment-input"] textarea').fill(body);
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

When(
  'I add a comment with a suggestion on new lines {int}-{int} of {string}',
  async ({}, start: number, end: number, filePath: string) => {
    await selectLineRange(filePath, start, end);
    const page = getPage();
    await page
      .locator('[data-testid="comment-input"] textarea')
      .fill('Suggestion comment');
    await page.locator('[data-testid="add-suggestion-btn"]').click();
    await page
      .locator('[data-testid="suggestion-proposed"] textarea')
      .fill('replacement code');
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

When(
  'I add a comment {string} on new lines {int}-{int} of {string}',
  async ({}, body: string, start: number, end: number, filePath: string) => {
    await selectLineRange(filePath, start, end);
    const page = getPage();
    await page.locator('[data-testid="comment-input"] textarea').fill(body);
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

When(
  'I add a comment {string} on old line {int} of {string}',
  async ({}, body: string, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'old');
    const page = getPage();
    await page.locator('[data-testid="comment-input"] textarea').fill(body);
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

// ── XML parsing helper ──

function parseXmlOutput(): any {
  const xmlContent = readOutputFile();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  return parser.parse(xmlContent);
}

function getFileElement(filePath: string): any {
  const parsed = parseXmlOutput();
  const files = Array.isArray(parsed.review.file)
    ? parsed.review.file
    : [parsed.review.file];
  return files.find((f: any) => f['@_path'] === filePath);
}

function getLastComment(filePath: string): any {
  const fileEl = getFileElement(filePath);
  if (!fileEl || !fileEl.comment) return null;
  const comments = Array.isArray(fileEl.comment)
    ? fileEl.comment
    : [fileEl.comment];
  return comments[comments.length - 1];
}

// ── Then: output file assertions ──

Then('the output file should exist', async () => {
  expect(outputFileExists()).toBe(true);
});

Then('the output file should contain valid XML', async () => {
  expect(outputFileExists()).toBe(true);
  const xmlContent = readOutputFile();
  expect(xmlContent).toContain('<?xml');
  // Should parse without errors
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const result = parser.parse(xmlContent);
  expect(result).toBeTruthy();
  expect(result.review).toBeTruthy();
});

Then('stdout should be empty', async () => {
  const stdout = getStdout();
  expect(stdout.trim()).toBe('');
});

// ── Then: XML assertions (reading from output file) ──

Then(
  'the XML should have a root element {string} with namespace {string}',
  async ({}, element: string, namespace: string) => {
    const xmlContent = readOutputFile();
    expect(xmlContent).toContain(`<${element}`);
    expect(xmlContent).toContain(`xmlns="${namespace}"`);
  }
);

Then(
  'the XML should contain {int} file elements',
  async ({}, count: number) => {
    const parsed = parseXmlOutput();
    if (count === 0) {
      expect(parsed.review.file).toBeUndefined();
    } else {
      const files = Array.isArray(parsed.review.file)
        ? parsed.review.file
        : [parsed.review.file];
      expect(files.length).toBe(count);
    }
  }
);

Then(
  'the XML {string} element should have a {string} attribute',
  async ({}, element: string, attr: string) => {
    const parsed = parseXmlOutput();
    const el = parsed[element] || parsed.review;
    expect(el[`@_${attr}`]).toBeDefined();
  }
);

Then(
  'the XML {string} element should have a {string} attribute with value {string}',
  async ({}, element: string, attr: string, value: string) => {
    const parsed = parseXmlOutput();
    const el = parsed[element] || parsed.review;
    expect(String(el[`@_${attr}`])).toBe(value);
  }
);

Then(
  'the XML file element for {string} should contain {int} comment',
  async ({}, filePath: string, count: number) => {
    const fileEl = getFileElement(filePath);
    expect(fileEl).toBeTruthy();
    if (count === 0) {
      expect(fileEl.comment).toBeUndefined();
    } else {
      const comments = Array.isArray(fileEl.comment)
        ? fileEl.comment
        : [fileEl.comment];
      expect(comments.length).toBe(count);
    }
  }
);

Then(
  'that comment should have new-line-start={string} and new-line-end={string}',
  async ({}, start: string, end: string) => {
    const xmlContent = readOutputFile();
    expect(xmlContent).toContain(`new-line-start="${start}"`);
    expect(xmlContent).toContain(`new-line-end="${end}"`);
  }
);

Then(
  'that comment should have old-line-start={string} and old-line-end={string}',
  async ({}, start: string, end: string) => {
    const xmlContent = readOutputFile();
    expect(xmlContent).toContain(`old-line-start="${start}"`);
    expect(xmlContent).toContain(`old-line-end="${end}"`);
  }
);

Then('that comment should have body {string}', async ({}, body: string) => {
  const xmlContent = readOutputFile();
  expect(xmlContent).toContain(`<body>${body}</body>`);
});

Then('that comment should not have line attributes', async () => {
  // The last comment in the output file should not have line attributes
  const parsed = parseXmlOutput();
  const files = Array.isArray(parsed.review.file)
    ? parsed.review.file
    : [parsed.review.file];
  // Find the first file with comments
  for (const file of files) {
    if (file.comment) {
      const comments = Array.isArray(file.comment)
        ? file.comment
        : [file.comment];
      const lastComment = comments[comments.length - 1];
      expect(lastComment['@_old-line-start']).toBeUndefined();
      expect(lastComment['@_old-line-end']).toBeUndefined();
      expect(lastComment['@_new-line-start']).toBeUndefined();
      expect(lastComment['@_new-line-end']).toBeUndefined();
      break;
    }
  }
});

Then(
  'that comment should have a category element with text {string}',
  async ({}, category: string) => {
    const xmlContent = readOutputFile();
    expect(xmlContent).toContain(`<category>${category}</category>`);
  }
);

Then('that comment should have a suggestion element', async () => {
  const xmlContent = readOutputFile();
  expect(xmlContent).toContain('<suggestion>');
  expect(xmlContent).toContain('</suggestion>');
});

Then(
  'the suggestion should have a/an {string} element',
  async ({}, element: string) => {
    const xmlContent = readOutputFile();
    expect(xmlContent).toContain(`<${element}>`);
    expect(xmlContent).toContain(`</${element}>`);
  }
);

Then(
  'that comment should not have new-line-start or new-line-end attributes',
  async () => {
    // Find the last comment in the XML and check it doesn't have new-line attrs
    const parsed = parseXmlOutput();
    const files = Array.isArray(parsed.review.file)
      ? parsed.review.file
      : [parsed.review.file];
    for (const file of files) {
      if (file.comment) {
        const comments = Array.isArray(file.comment)
          ? file.comment
          : [file.comment];
        const lastComment = comments[comments.length - 1];
        expect(lastComment['@_new-line-start']).toBeUndefined();
        expect(lastComment['@_new-line-end']).toBeUndefined();
        break;
      }
    }
  }
);

Then(
  'the output file should validate against {string}',
  async ({}, xsdPath: string) => {
    // Use xmllint-wasm for validation
    const { validateXML } = await import('xmllint-wasm');
    const xmlContent = readOutputFile();
    const xsdContent = readFileSync(resolve(process.cwd(), xsdPath), 'utf-8');
    const result = await validateXML({
      xml: [{ fileName: 'review.xml', contents: xmlContent }],
      schema: [{ fileName: 'schema.xsd', contents: xsdContent }],
    });
    expect(result.valid).toBe(true);
  }
);

Then('stderr should not be empty', async () => {
  const stderr = getStderr();
  expect(stderr.length).toBeGreaterThan(0);
});
