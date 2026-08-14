# kenkeep Index: app / ui / previews

↑ Parent: [ui](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Force unified view for added and deleted files**](practice-force-unified-view-for-added-and-deleted-files.md) to learn about: Files with changeType added or deleted always render in unified view regardless of the user's selected mode. #ui #diff-view
- Open [**Use Prism.js for syntax highlighting with theme matching**](practice-use-prism-js-for-syntax-highlighting-with-theme-matching.md) to learn about: Detect language by file extension and match Prism theme to the app's light/dark mode. #task-manager #syntax-highlighting #prism

## Components (what exists)
- Open [**Rendered file previews**](map-rendered-file-previews.md) to learn about: Markdown, HTML, raster images, and SVG support Raw/Rendered toggles for newly added files. #task-manager #rendered-preview #file-types
- Open [**Rendered image and SVG previews for added files**](map-rendered-image-and-svg-previews-for-added-files.md) to learn about: Raster images load via diff:load-image as base64 data URIs; SVG content from addition lines renders via img+data-URI to block scripts. #preview #image #svg
- Open [**Rendered text view for added Markdown and HTML files**](map-rendered-text-view-for-added-markdown-and-html-files.md) to learn about: Newly added .md/.markdown and .html/.htm files get a Raw/Rendered toggle with source-line-mapped gutter for line comments. #preview #markdown #html #rendered

## By topic

### #preview
- Open [**Rendered image and SVG previews for added files**](map-rendered-image-and-svg-previews-for-added-files.md) — Raster images load via diff:load-image as base64 data URIs; SVG content from addition lines renders via img+data-URI to block scripts.
- Open [**Rendered text view for added Markdown and HTML files**](map-rendered-text-view-for-added-markdown-and-html-files.md) — Newly added .md/.markdown and .html/.htm files get a Raw/Rendered toggle with source-line-mapped gutter for line comments.
### #task-manager
- Open [**POST_PHASE hook**](../../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #diff-view
- Open [**Force unified view for added and deleted files**](practice-force-unified-view-for-added-and-deleted-files.md) — Files with changeType added or deleted always render in unified view regardless of the user's selected mode.
### #file-types
- Open [**Rendered file previews**](map-rendered-file-previews.md) — Markdown, HTML, raster images, and SVG support Raw/Rendered toggles for newly added files.
### #html
- Open [**Rendered text view for added Markdown and HTML files**](map-rendered-text-view-for-added-markdown-and-html-files.md) — Newly added .md/.markdown and .html/.htm files get a Raw/Rendered toggle with source-line-mapped gutter for line comments.
### #image
- Open [**Rendered image and SVG previews for added files**](map-rendered-image-and-svg-previews-for-added-files.md) — Raster images load via diff:load-image as base64 data URIs; SVG content from addition lines renders via img+data-URI to block scripts.
### #markdown
- Open [**Preserve review body whitespace during XML parsing**](../../../review-xml/comments/practice-preserve-review-body-whitespace-during-xml-parsing.md) — Disable XML value trimming so comment and reply Markdown bodies round-trip byte-identically.
- Open [**Rendered text view for added Markdown and HTML files**](map-rendered-text-view-for-added-markdown-and-html-files.md) — Newly added .md/.markdown and .html/.htm files get a Raw/Rendered toggle with source-line-mapped gutter for line comments.
### #prism
- Open [**Use Prism.js for syntax highlighting with theme matching**](practice-use-prism-js-for-syntax-highlighting-with-theme-matching.md) — Detect language by file extension and match Prism theme to the app's light/dark mode.
### #rendered
- Open [**Rendered text view for added Markdown and HTML files**](map-rendered-text-view-for-added-markdown-and-html-files.md) — Newly added .md/.markdown and .html/.htm files get a Raw/Rendered toggle with source-line-mapped gutter for line comments.
### #rendered-preview
- Open [**Rendered file previews**](map-rendered-file-previews.md) — Markdown, HTML, raster images, and SVG support Raw/Rendered toggles for newly added files.
### #svg
- Open [**Rendered image and SVG previews for added files**](map-rendered-image-and-svg-previews-for-added-files.md) — Raster images load via diff:load-image as base64 data URIs; SVG content from addition lines renders via img+data-URI to block scripts.
### #syntax-highlighting
- Open [**Use Prism.js for syntax highlighting with theme matching**](practice-use-prism-js-for-syntax-highlighting-with-theme-matching.md) — Detect language by file extension and match Prism theme to the app's light/dark mode.
### #ui
- Open [**Force unified view for added and deleted files**](practice-force-unified-view-for-added-and-deleted-files.md) — Files with changeType added or deleted always render in unified view regardless of the user's selected mode.
- Open [**@self-review/react package**](../../../packages/architecture/map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
- Open [**Use shadcn/ui components instead of raw HTML for UI**](../interactions/practice-use-shadcn-ui-components-instead-of-raw-html-for-ui.md) — All buttons, inputs, dropdowns, dialogs, etc. must use shadcn/ui; no raw HTML equivalents.