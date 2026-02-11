#!/usr/bin/env node

/**
 * Extract skills from a task file's YAML frontmatter.
 *
 * Usage: node extract-task-skills.cjs <task-file>
 * Output: One skill per line, trimmed, empty lines removed.
 *
 * Supports both inline array and block list formats:
 *   skills: [skill-a, skill-b]
 *   skills:
 *     - skill-a
 *     - "skill-b"
 */

'use strict';

const fs = require('fs');
const path = require('path');

const taskFile = process.argv[2];
if (!taskFile) {
  console.error('Usage: node extract-task-skills.cjs <task-file>');
  process.exit(1);
}

const content = fs.readFileSync(path.resolve(taskFile), 'utf8');
const lines = content.split('\n');

let inFrontmatter = false;
let frontmatterClosed = false;
let inSkills = false;
const skills = [];

for (const line of lines) {
  if (frontmatterClosed) break;

  if (line.trim() === '---') {
    if (!inFrontmatter) {
      inFrontmatter = true;
      continue;
    }
    // Second delimiter – end of frontmatter
    frontmatterClosed = true;
    break;
  }

  if (!inFrontmatter) continue;

  // Detect "skills:" key
  if (/^skills\s*:/.test(line)) {
    inSkills = true;

    // Check for inline array: skills: [a, b, c]
    const inlineMatch = line.match(/\[(.*)]/);
    if (inlineMatch) {
      inlineMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .forEach(s => skills.push(s));
      inSkills = false;
    }
    continue;
  }

  if (inSkills) {
    // A non-indented, non-empty line ends the block list
    if (/^\S/.test(line)) {
      inSkills = false;
      continue;
    }
    // List item: "  - skill-name"
    const itemMatch = line.match(/^\s*-\s*(.*)/);
    if (itemMatch) {
      const value = itemMatch[1].trim().replace(/^["']|["']$/g, '');
      if (value) skills.push(value);
    }
  }
}

if (skills.length > 0) {
  console.log(skills.join('\n'));
}
