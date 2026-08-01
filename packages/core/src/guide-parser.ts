// packages/core/src/guide-parser.ts
// Parse a walkthrough guide XML string into a typed ReviewGuide, and
// reconcile a guide with the diff's file list into resolved display groups.
//
// Tolerance contract (binding, from docs/intent/llm-review-guide.md): the
// guide is orientation garnish on a deterministic tool. A missing, stale, or
// invalid guide degrades the consumer to its flat view — parsing problems
// are failure VALUES the caller can log and ignore, never exceptions.

import { XMLParser } from 'fast-xml-parser';
import { validateXML } from 'xmllint-wasm';
import type {
  GuideFileEntry,
  GuideGroup,
  ResolvedGuideGroup,
  ResolvedGuideFile,
  ReviewGuide,
} from './types';
import { GUIDE_XSD_SCHEMA } from './guide-schema';

/** Display name given to the derived trailing group of unmentioned files. */
export const IMPLICIT_GUIDE_GROUP_NAME = 'Everything else';

export type GuideParseResult =
  | { ok: true; guide: ReviewGuide }
  | { ok: false; reason: string };

/**
 * Parse and validate a guide XML string.
 *
 * The document is validated against the embedded self-review-guide-v1 XSD
 * (same xmllint-wasm tooling the review serializer uses) before being read,
 * so a successful result is structurally guaranteed by the schema. Any
 * defect — non-XML input, schema violations, validator failure — comes back
 * as `{ ok: false, reason }`; this function never throws on bad input.
 */
export async function parseGuideXml(xmlContent: string): Promise<GuideParseResult> {
  try {
    const validationResult = await validateXML({
      xml: [{ fileName: 'guide.xml', contents: xmlContent }],
      schema: [
        { fileName: 'self-review-guide-v1.xsd', contents: GUIDE_XSD_SCHEMA },
      ],
    });

    if (!validationResult.valid) {
      const details = (validationResult.errors || [])
        .map(err => (typeof err === 'string' ? err : err.message))
        .join('; ');
      return {
        ok: false,
        reason: `Guide XML does not conform to self-review-guide-v1 schema${details ? `: ${details}` : ''}`,
      };
    }

    return { ok: true, guide: readGuide(xmlContent) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `Failed to parse guide XML: ${message}` };
  }
}

/**
 * Extract the typed guide from a document that already passed XSD
 * validation. Values are still string-coerced defensively, but structural
 * guarantees (required attributes/elements, at least one file per group)
 * come from the schema.
 */
function readGuide(xmlContent: string): ReviewGuide {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Keep values verbatim: a description like "007" or an overview of
    // "true" must stay a string, not become a number or boolean.
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const root = parser.parse(xmlContent).guide as Record<string, unknown>;

  const guide: ReviewGuide = { groups: asArray(root.group).map(readGroup) };

  const overview = root.overview;
  if (typeof overview === 'string' && overview !== '') {
    guide.overview = overview;
  }

  return guide;
}

function readGroup(raw: unknown): GuideGroup {
  const group = raw as Record<string, unknown>;
  return {
    name: String(group['@_name']),
    rationale: String(group.rationale ?? ''),
    files: asArray(group.file).map(readFileEntry),
  };
}

function readFileEntry(raw: unknown): GuideFileEntry {
  const file = raw as Record<string, unknown>;
  return {
    path: String(file['@_path']),
    description: String(file.description ?? ''),
  };
}

/** fast-xml-parser yields a bare object for singular elements; normalize. */
function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Merge a parsed guide with the diff's file list into resolved display
 * groups, tolerantly:
 *
 * - Guide entries whose path is not in the diff are dropped (stale guide);
 *   a group left with no surviving files is dropped entirely.
 * - A file referenced by more than one group appears only in the first.
 * - Diff files no group mentions land in a terminal implicit
 *   "Everything else" group, preserving the diff's file order, marked
 *   `implicit: true` so the UI can label it.
 * - Guide group order and in-group file order are preserved.
 */
export function reconcileGuide(
  guide: ReviewGuide,
  diffFilePaths: string[]
): ResolvedGuideGroup[] {
  const diffPaths = new Set(diffFilePaths);
  const claimed = new Set<string>();
  const resolved: ResolvedGuideGroup[] = [];

  for (const group of guide.groups) {
    const files: ResolvedGuideFile[] = [];
    for (const file of group.files) {
      if (!diffPaths.has(file.path) || claimed.has(file.path)) continue;
      claimed.add(file.path);
      files.push({ path: file.path, description: file.description });
    }
    if (files.length > 0) {
      resolved.push({
        name: group.name,
        rationale: group.rationale,
        implicit: false,
        files,
      });
    }
  }

  const leftover = diffFilePaths.filter(path => !claimed.has(path));
  if (leftover.length > 0) {
    resolved.push({
      name: IMPLICIT_GUIDE_GROUP_NAME,
      implicit: true,
      files: leftover.map(path => ({ path })),
    });
  }

  return resolved;
}
