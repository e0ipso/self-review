/**
 * Reading a written review document, for the assertions in this project.
 *
 * Everything here works on the file on disk. Serve mode answers a submission
 * with 200 as soon as the state is on the session and writes the document
 * afterwards, from the response's `finish` event, so a status code says
 * nothing about the artifact and only the file does.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

export type XmlNode = Record<string, any>;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** Parse a written review document. Throws if it is not there. */
export function readReviewDocument(filePath: string): XmlNode {
  return parser.parse(readFileSync(filePath, 'utf-8'));
}

/** fast-xml-parser collapses a single child to an object; this restores a list. */
export function toArray(value: unknown): XmlNode[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]) as XmlNode[];
}

/** The `<file>` elements of a parsed document, in document order. */
export function filesOf(document: XmlNode): XmlNode[] {
  return toArray(document.review?.file);
}

/** The `<comment>` elements under one path, in document order. */
export function commentsFor(document: XmlNode, filePath: string): XmlNode[] {
  const file = filesOf(document).find(f => f['@_path'] === filePath);
  return file ? toArray(file.comment) : [];
}

/**
 * Validate a document against the canonical v3 schema — the same file the
 * Electron project's XML scenarios validate against, so both front ends are
 * held to one contract.
 */
export async function validateAgainstV3Xsd(
  filePath: string
): Promise<{ valid: boolean; errors: unknown[] }> {
  const { validateXML } = await import('xmllint-wasm');
  const schemaPath = resolve(
    __dirname,
    '../../.agents/skills/self-review-apply/assets/self-review-v3.xsd'
  );
  const result = await validateXML({
    xml: [{ fileName: 'review.xml', contents: readFileSync(filePath, 'utf-8') }],
    schema: [{ fileName: 'schema.xsd', contents: readFileSync(schemaPath, 'utf-8') }],
  });
  return { valid: result.valid, errors: [...(result.errors ?? [])] };
}
