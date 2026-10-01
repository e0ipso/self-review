---
id: 12
group: "react-previews"
dependencies: [2, 8]
status: "pending"
created: 2026-10-01
skills:
  - react
  - html-sanitization
complexity_score: 5
execution_profile: "complex-architecture"
---
# Isolate Mermaid diagrams from the application document and contain passive HTML layout (A7)

## Objective
Reviewed Mermaid source (rendered Markdown and guide overview) can no longer inject CSS or passive HTML into the application document: diagrams render as an isolated image, consistent with the existing SVG-as-`<img>` pattern. Passive HTML cannot reuse app positioning classes or escape its preview area to cover review controls. No active content, events or CSP widening.

## Skills Required
React rendering and HTML/SVG sanitization/isolation.

## Acceptance Criteria
- [ ] `MermaidBlock.tsx` (`:24,:28,:61`) no longer uses `dangerouslySetInnerHTML` for generated SVG; it renders `<img src="data:image/svg+xml;base64,…" alt="…">` (as `RenderedSvgView` does). Mermaid's render container is detached/off-document and removed after render; rendering errors show a contained message (task 5's boundary also applies).
- [ ] Content-controlled Mermaid configuration cannot alter global behavior: initialize with `securityLevel: 'strict'` (or stricter), and strip/ignore `%%{init}%%`/front-matter config keys that change `securityLevel`, `themeCSS`, `fontFamily`, `htmlLabels`, `maxTextSize` (document the list).
- [ ] Render is bounded: a size limit on diagram source and a render timeout that shows a contained error (the cancellation flag alone doesn't interrupt rendering; the timeout must at least stop waiting and display the error).
- [ ] Passive HTML (`packages/react/src/utils/passive-content.ts`): `class`/`className` and `style` attributes from reviewed content are dropped (or restricted to an allow-list that contains no app positioning utilities), and rendered text previews are contained (`contain: layout paint; overflow: hidden; position: relative; isolation: isolate`) so fixed/absolute content cannot cover review controls.
- [ ] Tests (jsdom) reproduce the audit payloads (`docs/security-audit-2026-10-01/mermaid-probe.mjs`): after rendering, no `<style>` or foreign `DIV` from the diagram exists in the application document outside an `<img>`, and an app button's computed/inline state is untouched; passive HTML with `class="fixed inset-0"`/`style="position:fixed"` renders without those attributes.
- [ ] Native browser evidence: run the webapp (`npm run test:e2e` harness or the Vite dev server) with a fixture containing the CSS-selector and `classDef` payloads and confirm (Playwright screenshot or assertion) that the review controls remain visible and clickable. Record the evidence path in the task output.
- [ ] `npm run test:unit`, `npm run test:e2e` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/react/src/components/DiffViewer/MermaidBlock.tsx`, `packages/react/src/utils/passive-content.ts`, rendered-text container styles (`RenderedMarkdownView.tsx` wrapper class only / `packages/react/src/styles.css`), guide overview rendering (`GuideOverviewContent.tsx`) if it renders Mermaid separately, webapp e2e fixture/feature for the payload.

## Input Dependencies
Task 2 (Mermaid upgraded), task 8 (RenderedMarkdownView/passive-content positions rework).

## Output Artifacts
Isolated Mermaid rendering and contained passive layout.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/security-audit-2026-10-01.md` A7 and "Strengthen Electron boundaries and passive content isolation", `docs/security-audit-2026-10-01-sol/sol-p5-render.md`, and the probe `docs/security-audit-2026-10-01/mermaid-probe.mjs` + output.
2. `mermaid.render(id, code, container?)` accepts a container; pass a detached element appended to an off-screen sandbox only for measurement if required, then remove it. Convert the returned SVG string with a UTF-8-safe base64 (`btoa(unescape(encodeURIComponent(svg)))` or `TextEncoder`).
3. In an `<img>`, SVG scripts don't run and styles are isolated to the image document — this is the isolation boundary. Fonts may differ; acceptable.
4. Check `RenderedSvgView.tsx` for the existing data-URI helper and reuse it (extract a shared util if needed — no duplication).
5. Concurrency: tasks 10 and 13 (core) run in the same phase; no React overlap expected. Re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (real Mermaid render in jsdom where feasible; mock only if Mermaid cannot run in jsdom, and then rely on the browser e2e evidence). Test the isolation boundary, not Mermaid itself.
</details>
