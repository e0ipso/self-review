---
id: 2
group: "foundation"
dependencies: []
status: "completed"
created: "2026-02-16"
skills: ["xml-schema"]
---

# Update XSD Schema with Attachment Element

## Objective

Add an optional `<attachment>` element to the XSD schema so the XML output can reference image files. Both copies of the XSD (standalone file and embedded string in the serializer) must be updated in sync.

## Skills Required

- `xml-schema`: XSD design, type definitions, element placement

## Acceptance Criteria

- [ ] `AttachmentType` complex type added to `.claude/skills/self-review-apply/assets/self-review-v1.xsd` with `path` (xs:string, required) and `media-type` (xs:string, required) attributes
- [ ] `<attachment>` element added to `CommentType` as optional (`minOccurs="0"`) and repeatable (`maxOccurs="unbounded"`), placed after `<suggestion>` in the sequence
- [ ] `AttachmentType` includes `xs:documentation` annotations consistent with existing schema style
- [ ] Embedded XSD string in `src/main/xml-serializer.ts` updated to match the standalone XSD exactly
- [ ] Existing XML without attachments still validates against the updated schema

## Technical Requirements

- The `<attachment>` element is a self-closing element with attributes only (no text content)
- Example output: `<attachment path=".self-review-assets/c1-0.png" media-type="image/png" />`
- Backward compatibility: since the element is optional, existing XML files validate unchanged

## Input Dependencies

None — XSD update is independent of type changes.

## Output Artifacts

- Updated `.claude/skills/self-review-apply/assets/self-review-v1.xsd`
- Updated embedded XSD in `src/main/xml-serializer.ts` (string only, not the serialization logic)

## Implementation Notes

<details>

### Step 1: Read the current XSD

Read `.claude/skills/self-review-apply/assets/self-review-v1.xsd` to understand the existing schema structure, particularly `CommentType` and how other optional elements (like `<suggestion>`) are defined.

### Step 2: Add `AttachmentType` to the standalone XSD

Add a new complex type after `SuggestionType` (or wherever types are grouped):

```xml
<xs:complexType name="AttachmentType">
  <xs:annotation>
    <xs:documentation>
      Reference to an image file attached to a review comment. The file is stored
      alongside the XML output in the .self-review-assets/ directory.
    </xs:documentation>
  </xs:annotation>
  <xs:attribute name="path" type="xs:string" use="required">
    <xs:annotation>
      <xs:documentation>Relative path from the XML file to the image file.</xs:documentation>
    </xs:annotation>
  </xs:attribute>
  <xs:attribute name="media-type" type="xs:string" use="required">
    <xs:annotation>
      <xs:documentation>MIME type of the image (e.g., image/png, image/jpeg).</xs:documentation>
    </xs:annotation>
  </xs:attribute>
</xs:complexType>
```

### Step 3: Add `<attachment>` element to `CommentType`

Inside the `CommentType` sequence, after the `<suggestion>` element, add:

```xml
<xs:element name="attachment" type="AttachmentType" minOccurs="0" maxOccurs="unbounded" />
```

### Step 4: Update embedded XSD in `src/main/xml-serializer.ts`

Find the XSD string constant in `xml-serializer.ts` and apply the same changes. Ensure the two copies are character-for-character identical in schema content.

### Step 5: Verify backward compatibility

Check that the existing test fixtures or example XML files would still validate against the updated schema (mentally verify — the element is optional so existing XML is unaffected).

</details>
