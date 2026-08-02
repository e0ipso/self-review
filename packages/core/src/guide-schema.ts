// packages/core/src/guide-schema.ts
// Embedded copy of the walkthrough guide XSD for validation.

// This MUST stay byte-identical to the on-disk copy at
// .agents/skills/self-review-guide/assets/self-review-guide-v1.xsd;
// the sync test in xsd-schema.test.ts enforces it.
export const GUIDE_XSD_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:sg="urn:self-review-guide:v1"
  targetNamespace="urn:self-review-guide:v1"
  elementFormDefault="qualified"
>

  <!--
    self-review guide XML Schema v1
    ===============================
    Defines the walkthrough guide sidecar for the self-review application.
    This schema is designed to be both machine-validated and fed to an LLM
    so it can author valid guide documents from the schema alone.

    Key concepts:
    - A <guide> is a read-only orientation aid generated BEFORE a review
      starts. It lives next to the review output file and is discovered by
      convention; it is never written by the review UI.
    - The optional <overview> is short Markdown prose shown before the
      first file, orienting the reviewer to the change as a whole.
    - Each <group> names a set of files that belong together (for example
      "Core change", "Tests", "Generated/mechanical") and explains, in one
      line, why they are grouped and where they sit in the reading order.
    - Each <file> inside a group points at one diff file by its
      repository-relative path and carries a one-line description of the
      role that file plays in the change.

    Ordering:
    - Document order IS the reading order. Groups are presented in the
      order they appear, and files within a group are presented in the
      order they appear. There are no explicit ordering attributes; to
      reorder, reorder the elements.

    Presentation only, never suppression:
    - This vocabulary labels and orders content; it cannot hide it. There
      is deliberately no element or attribute that hides, collapses, or
      marks a file as skippable, and none may be added to v1. Files in the
      diff that no group mentions remain fully visible in an implicit
      "Everything else" group; files mentioned here but absent from the
      diff are silently ignored.

    Tolerance:
    - A missing, stale, or invalid guide degrades the consumer to its
      normal ungrouped view. A guide can therefore never block or fail a
      review, but an invalid guide is silently useless, so authors should
      validate against this schema before writing the file.
  -->

  <!-- ===== Root element ===== -->

  <xs:element name="guide" type="sg:GuideType">
    <xs:annotation>
      <xs:documentation>
        Root element of a self-review walkthrough guide sidecar. Contains
        an optional overview followed by zero or more ordered groups.
      </xs:documentation>
    </xs:annotation>
  </xs:element>

  <!-- ===== Complex types ===== -->

  <xs:complexType name="GuideType">
    <xs:annotation>
      <xs:documentation>
        The whole walkthrough guide. The optional metadata attributes
        mirror the review schema's provenance attributes so a consumer can
        sanity-check that the guide was generated for the diff it is being
        shown next to; none of them are required and none affect
        presentation.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="overview" type="xs:string" minOccurs="0">
        <xs:annotation>
          <xs:documentation>
            Review-level orientation prose shown before the first file.
            Markdown formatting is allowed, including fenced code blocks;
            a fenced code block labelled "mermaid" may be used for a
            diagram of the change.
            Keep it short: a few sentences saying what the change does and
            where to start reading, not a restatement of every file.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="group" type="sg:GroupType" minOccurs="0" maxOccurs="unbounded">
        <xs:annotation>
          <xs:documentation>
            Ordered reading groups. The first group should hold the files
            the reviewer must understand first (the core of the change);
            later groups hold consequences, tests, and mechanical fallout.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
    <xs:attribute name="timestamp" type="xs:dateTime" use="optional">
      <xs:annotation>
        <xs:documentation>
          ISO 8601 timestamp of when the guide was generated.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="git-diff-args" type="xs:string" use="optional">
      <xs:annotation>
        <xs:documentation>
          The git diff arguments the guide was generated against.
          Example: "--staged", "main..feature-branch", "HEAD~3".
          Present only when the guide describes a git diff.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="repository" type="xs:string" use="optional">
      <xs:annotation>
        <xs:documentation>
          Absolute path to the repository root the guide was generated in.
          Present only when the guide describes a git diff.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>

  <xs:complexType name="GroupType">
    <xs:annotation>
      <xs:documentation>
        A named set of related files with a one-line rationale. Groups are
        labels for orientation, never suppressions: a consumer shows every
        group and every file in it. Position in the document is position
        in the reading order.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="rationale" type="xs:string">
        <xs:annotation>
          <xs:documentation>
            One line explaining why these files form a group and what the
            reviewer should look for in them (e.g., "The retry wrapper
            everything else calls; read this first"). Plain text, a single
            sentence; no Markdown, no line breaks.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="file" type="sg:FileEntryType" minOccurs="1" maxOccurs="unbounded">
        <xs:annotation>
          <xs:documentation>
            The files in this group, in reading order. A group must list
            at least one file; do not author empty placeholder groups.
            Every file in the diff may appear in at most one group, and
            files omitted from every group are not hidden — the consumer
            shows them in an implicit trailing "Everything else" group.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
    <xs:attribute name="name" type="xs:string" use="required">
      <xs:annotation>
        <xs:documentation>
          Short display name for the group, e.g. "Core change", "Tests",
          "Generated/mechanical". Shown as the group heading in the file
          tree; keep it to a few words.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>

  <xs:complexType name="FileEntryType">
    <xs:annotation>
      <xs:documentation>
        One file in a group. The path must match a file in the diff being
        reviewed; entries whose path matches nothing in the diff are
        silently dropped by the consumer, so a stale guide degrades
        instead of erroring.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="description" type="xs:string">
        <xs:annotation>
          <xs:documentation>
            One line describing the role this file plays in the change
            (e.g., "Adds the retry wrapper that everything else calls").
            Plain text, a single sentence; no Markdown, no line breaks.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
    <xs:attribute name="path" type="xs:string" use="required">
      <xs:annotation>
        <xs:documentation>
          File path relative to the repository root, using the same
          convention as review.xml file paths. For renamed files, use the
          new path.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>

</xs:schema>`;
