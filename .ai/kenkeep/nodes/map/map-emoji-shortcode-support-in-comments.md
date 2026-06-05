---
schema_version: 1
id: map-emoji-shortcode-support-in-comments
title: Emoji shortcode support in comments
kind: map
tags:
  - task-manager
  - emoji
  - comments
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Typing :xx in the comment editor triggers an inline autocomplete; :shortcode:
  text is converted to Unicode in rendered markdown.
---
Typing `:` + 2 characters in the comment editor triggers an inline autocomplete dropdown via the `useEmojiAutocomplete` hook and `EmojiAutocomplete` component. Emoji data comes from `@emoji-mart/data`. A custom remark plugin (`remark-emoji.ts`) converts `:shortcode:` text to Unicode emojis in all rendered markdown views (`CommentDisplay` and `RenderedMarkdownView`).
