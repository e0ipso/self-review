---
type: map
title: Emoji shortcode support in comments
description: >-
  Typing :xx in the comment editor triggers an inline autocomplete; :shortcode:
  text is converted to Unicode in rendered markdown.
tags:
  - task-manager
  - emoji
  - comments
kk_schema_version: 3
kk_id: map-emoji-shortcode-support-in-comments
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
Typing `:` + 2 characters in the comment editor triggers an inline autocomplete dropdown via the `useEmojiAutocomplete` hook and `EmojiAutocomplete` component. Emoji data comes from `@emoji-mart/data`. A custom remark plugin (`remark-emoji.ts`) converts `:shortcode:` text to Unicode emojis in all rendered markdown views (`CommentDisplay` and `RenderedMarkdownView`).

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
