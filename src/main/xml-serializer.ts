// src/main/xml-serializer.ts
// Serialize ReviewState to XML and validate against XSD

import { ReviewState, FileReviewState, ReviewComment } from '../shared/types';
import { validateXML } from 'xmllint-wasm';

// Embed the XSD schema for validation
const XSD_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:sr="urn:self-review:v1"
  targetNamespace="urn:self-review:v1"
  elementFormDefault="qualified"
>

  <xs:element name="review" type="sr:ReviewType">
    <xs:annotation>
      <xs:documentation>
        Root element of a self-review output file. Contains one file element
        per file in the git diff, including files with no comments.
      </xs:documentation>
    </xs:annotation>
  </xs:element>

  <xs:complexType name="ReviewType">
    <xs:sequence>
      <xs:element name="file" type="sr:FileType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attribute name="timestamp" type="xs:dateTime" use="required">
      <xs:annotation>
        <xs:documentation>
          ISO 8601 timestamp of when the review was completed (window closed).
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="git-diff-args" type="xs:string" use="required">
      <xs:annotation>
        <xs:documentation>
          The git diff arguments that were passed to self-review on the CLI.
          Example: "--staged", "main..feature-branch", "HEAD~3".
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="repository" type="xs:string" use="required">
      <xs:annotation>
        <xs:documentation>
          Absolute path to the repository root where self-review was invoked.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>

  <xs:complexType name="FileType">
    <xs:annotation>
      <xs:documentation>
        Represents a single file in the diff. Files with no comments
        appear as empty elements. The path is relative to the repository root.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="comment" type="sr:CommentType" minOccurs="0" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attribute name="path" type="xs:string" use="required">
      <xs:annotation>
        <xs:documentation>
          File path relative to the repository root. For renamed files,
          this is the new path.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="change-type" type="sr:ChangeTypeEnum" use="required">
      <xs:annotation>
        <xs:documentation>
          The type of change: added, modified, deleted, or renamed.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="viewed" type="xs:boolean" use="required">
      <xs:annotation>
        <xs:documentation>
          Whether the reviewer marked this file as reviewed.
          true = the reviewer looked at this file.
          false = the reviewer did not mark this file as viewed.
          This helps an AI agent distinguish "reviewed with no comments"
          from "not yet reviewed."
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>

  <xs:complexType name="CommentType">
    <xs:annotation>
      <xs:documentation>
        A review comment. Three forms:

        1. File-level comment: no line attributes present.
           Applies to the file as a whole.

        2. Comment on new/added/context lines: new-line-start and
           new-line-end are present. These reference line numbers in the
           post-change version of the file.

        3. Comment on old/deleted lines: old-line-start and old-line-end
           are present. These reference line numbers in the pre-change
           version of the file.

        For single-line comments, start and end are equal.
        Exactly one pair (old or new) should be present for line-level
        comments. Both pairs absent = file-level comment.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="body" type="xs:string">
        <xs:annotation>
          <xs:documentation>
            The comment text. May contain markdown formatting.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="category" type="xs:string" minOccurs="0">
        <xs:annotation>
          <xs:documentation>
            Optional category tag for this comment (e.g., "bug", "style",
            "nit", "question", "security"). Categories are defined in the
            project-level .self-review.yaml configuration. Useful for AI
            agents to prioritize and triage feedback.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="suggestion" type="sr:SuggestionType" minOccurs="0">
        <xs:annotation>
          <xs:documentation>
            Optional code replacement proposal. When present, the AI agent
            should replace the original-code with the proposed-code at the
            referenced line range.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
    <xs:attribute name="old-line-start" type="xs:positiveInteger" use="optional">
      <xs:annotation>
        <xs:documentation>
          Start line number in the pre-change (old) version of the file.
          Use for comments on deleted lines.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="old-line-end" type="xs:positiveInteger" use="optional">
      <xs:annotation>
        <xs:documentation>
          End line number (inclusive) in the pre-change (old) version.
          Must be >= old-line-start when both are present.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="new-line-start" type="xs:positiveInteger" use="optional">
      <xs:annotation>
        <xs:documentation>
          Start line number in the post-change (new) version of the file.
          Use for comments on added or context (unchanged) lines.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="new-line-end" type="xs:positiveInteger" use="optional">
      <xs:annotation>
        <xs:documentation>
          End line number (inclusive) in the post-change (new) version.
          Must be >= new-line-start when both are present.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>

  <xs:complexType name="SuggestionType">
    <xs:annotation>
      <xs:documentation>
        A code replacement proposal. The original-code is the literal text
        currently at the referenced lines. The proposed-code is what the
        reviewer suggests it should be replaced with. The AI agent can apply
        this by performing a text substitution.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="original-code" type="xs:string">
        <xs:annotation>
          <xs:documentation>
            The existing code at the referenced line range, copied verbatim
            from the diff. Used by the AI agent to locate the replacement
            target via text matching.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="proposed-code" type="xs:string">
        <xs:annotation>
          <xs:documentation>
            The replacement code proposed by the reviewer. The AI agent
            should substitute original-code with this text.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="ChangeTypeEnum">
    <xs:annotation>
      <xs:documentation>
        The type of change a file underwent in the diff.
      </xs:documentation>
    </xs:annotation>
    <xs:restriction base="xs:string">
      <xs:enumeration value="added">
        <xs:annotation>
          <xs:documentation>New file that did not exist before.</xs:documentation>
        </xs:annotation>
      </xs:enumeration>
      <xs:enumeration value="modified">
        <xs:annotation>
          <xs:documentation>Existing file with content changes.</xs:documentation>
        </xs:annotation>
      </xs:enumeration>
      <xs:enumeration value="deleted">
        <xs:annotation>
          <xs:documentation>File was removed.</xs:documentation>
        </xs:annotation>
      </xs:enumeration>
      <xs:enumeration value="renamed">
        <xs:annotation>
          <xs:documentation>File was moved or renamed, with or without content changes.</xs:documentation>
        </xs:annotation>
      </xs:enumeration>
    </xs:restriction>
  </xs:simpleType>

</xs:schema>`;

export async function serializeReview(state: ReviewState): Promise<string> {
  const xml = buildXml(state);

  // Validate the XML against the XSD
  try {
    const validationResult = await validateXML({
      xml: [{ fileName: 'review.xml', contents: xml }],
      schema: [{ fileName: 'self-review-v1.xsd', contents: XSD_SCHEMA }],
    });

    if (!validationResult.valid) {
      const errors = validationResult.errors || [];
      console.error('XML validation failed:');
      errors.forEach((err: any) => console.error(`  ${err}`));
      throw new Error('Generated XML does not conform to schema');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`XML validation error: ${error.message}`);
    } else {
      console.error('XML validation error: unknown error');
    }
    throw error;
  }

  return xml;
}

function buildXml(state: ReviewState): string {
  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // Root element with namespace
  lines.push(
    `<review xmlns="urn:self-review:v1" timestamp="${escapeXml(state.timestamp)}" git-diff-args="${escapeXml(state.gitDiffArgs)}" repository="${escapeXml(state.repository)}">`
  );

  // Files
  for (const file of state.files) {
    lines.push(...buildFileXml(file));
  }

  // Close root element
  lines.push('</review>');

  return lines.join('\n');
}

function buildFileXml(file: FileReviewState): string[] {
  const lines: string[] = [];

  if (file.comments.length === 0) {
    // Self-closing tag for files with no comments
    lines.push(
      `  <file path="${escapeXml(file.path)}" change-type="${file.changeType}" viewed="${file.viewed}" />`
    );
  } else {
    // Opening tag
    lines.push(
      `  <file path="${escapeXml(file.path)}" change-type="${file.changeType}" viewed="${file.viewed}">`
    );

    // Comments
    for (const comment of file.comments) {
      lines.push(...buildCommentXml(comment));
    }

    // Closing tag
    lines.push('  </file>');
  }

  return lines;
}

function buildCommentXml(comment: ReviewComment): string[] {
  const lines: string[] = [];
  const attrs: string[] = [];

  // Add line attributes
  if (comment.lineRange) {
    if (comment.lineRange.side === 'old') {
      attrs.push(`old-line-start="${comment.lineRange.start}"`);
      attrs.push(`old-line-end="${comment.lineRange.end}"`);
    } else {
      attrs.push(`new-line-start="${comment.lineRange.start}"`);
      attrs.push(`new-line-end="${comment.lineRange.end}"`);
    }
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Opening tag
  lines.push(`    <comment${attrStr}>`);

  // Body (preserve whitespace and newlines)
  lines.push(`      <body>${escapeXml(comment.body)}</body>`);

  // Category
  if (comment.category) {
    lines.push(`      <category>${escapeXml(comment.category)}</category>`);
  }

  // Suggestion
  if (comment.suggestion) {
    lines.push('      <suggestion>');
    lines.push(`        <original-code>${escapeXml(comment.suggestion.originalCode)}</original-code>`);
    lines.push(`        <proposed-code>${escapeXml(comment.suggestion.proposedCode)}</proposed-code>`);
    lines.push('      </suggestion>');
  }

  // Closing tag
  lines.push('    </comment>');

  return lines;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
