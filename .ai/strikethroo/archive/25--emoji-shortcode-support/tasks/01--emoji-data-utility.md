---
id: 1
group: "emoji-support"
dependencies: []
status: "completed"
created: "2026-02-27"
skills:
  - typescript
---
# Install emoji-mart data and create emoji data utility

## Objective
Install `@emoji-mart/data` and create a shared utility module that exposes emoji search and shortcode resolution functions used by both the autocomplete dropdown and the remark rendering plugin.

## Skills Required
- TypeScript module design

## Acceptance Criteria
- [ ] `@emoji-mart/data` is installed as a dependency
- [ ] `src/renderer/utils/emoji-data.ts` exists with `searchEmojis(query: string)` and `resolveShortcode(shortcode: string)` functions
- [ ] `searchEmojis` returns up to 8 results with id, name, and native Unicode character
- [ ] `resolveShortcode` returns the Unicode character for a valid shortcode or null for invalid ones
- [ ] Types are properly defined for the return values

## Technical Requirements
- Use `@emoji-mart/data` as the data source
- The emoji-mart data package exports a JSON structure with emoji objects containing `id`, `name`, `keywords`, `skins` (with `native` Unicode), and `emoticons`
- Search should match against emoji `id` and `name` by prefix
- Keep the module simple — no caching or lazy loading needed (Electron desktop app)

## Input Dependencies
None

## Output Artifacts
- `src/renderer/utils/emoji-data.ts` — shared emoji utility module
- Updated `package.json` with `@emoji-mart/data`

## Implementation Notes

<details>
<summary>Details</summary>

1. Run `npm install @emoji-mart/data`
2. Create `src/renderer/utils/emoji-data.ts`
3. Import the default export from `@emoji-mart/data` — it has structure: `{ emojis: { [id]: { id, name, keywords, skins: [{ native }] } } }`
4. Define `EmojiMatch` type: `{ id: string; name: string; native: string }`
5. `searchEmojis(query: string): EmojiMatch[]`:
   - Convert query to lowercase
   - Filter emojis where `id.startsWith(query)` or `name.toLowerCase().includes(query)` or any `keywords` include the query
   - Return first 8 matches mapped to `{ id, name, native: skins[0].native }`
6. `resolveShortcode(shortcode: string): string | null`:
   - Look up `shortcode` in the emojis object by id
   - If found, return `skins[0].native`
   - Otherwise return null
7. Build a lookup map at module load time for fast `resolveShortcode` access

</details>
