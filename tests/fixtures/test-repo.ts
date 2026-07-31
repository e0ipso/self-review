import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Creates a temporary git repository with deterministic unstaged changes
 * matching the Background sections in the Gherkin feature files.
 *
 * The repo has one commit with baseline files, then unstaged working tree
 * changes that produce a known diff visible via bare `git diff`.
 *
 * Returns the path to the repo. Caller is responsible for cleanup.
 */
export function createTestRepo(): string {
  const repoDir = mkdtempSync(join(tmpdir(), 'self-review-test-'));

  const run = (cmd: string) =>
    execSync(cmd, { cwd: repoDir, stdio: 'pipe' }).toString();

  // Initialize repo
  run('git init');
  run('git config user.email "test@test.com"');
  run('git config user.name "Test"');

  // ── Initial commit: baseline files ──

  mkdirSync(join(repoDir, 'src', 'auth'), { recursive: true });

  // src/auth/login.ts — will be "modified" (10 additions, 3 deletions)
  writeFileSync(
    join(repoDir, 'src', 'auth', 'login.ts'),
    [
      'import { db } from "../db";',
      '',
      'export async function login(username: string, password: string) {',
      '  const user = await db.findUser(username);',
      '  if (!user) {',
      '    throw new Error("User not found");',
      '  }',
      '  const valid = checkPassword(password, user.hash);',
      '  if (!valid) {',
      '    throw new Error("Invalid password");',
      '  }',
      '  return { id: user.id, username: user.username };',
      '}',
      '',
      'function checkPassword(input: string, hash: string): boolean {',
      '  return input === hash; // TODO: proper hashing',
      '}',
    ].join('\n')
  );

  // src/config.ts — empty file in initial commit, will be filled (25 additions)
  writeFileSync(join(repoDir, 'src', 'config.ts'), '');

  // src/legacy.ts — will be "deleted"
  writeFileSync(
    join(repoDir, 'src', 'legacy.ts'),
    Array.from({ length: 40 }, (_, i) => `// legacy line ${i + 1}`).join('\n')
  );

  // README.md — will be "modified" (2 additions, 1 deletion)
  writeFileSync(
    join(repoDir, 'README.md'),
    ['# My App', '', 'A simple application.'].join('\n')
  );

  run('git add -A');
  run('git commit -m "Initial commit"');

  // ── Unstaged working tree changes ──

  // Modify src/auth/login.ts: add try-catch, add session token, remove old error style
  writeFileSync(
    join(repoDir, 'src', 'auth', 'login.ts'),
    [
      'import { db } from "../db";',
      'import { createSession } from "../session";',
      'import { logger } from "../logger";',
      '',
      'export async function login(username: string, password: string) {',
      '  try {',
      '    const user = await db.findUser(username);',
      '    if (!user) {',
      '      logger.warn("Login failed: user not found", { username });',
      '      return null;',
      '    }',
      '    const valid = await verifyPassword(password, user.hash);',
      '    if (!valid) {',
      '      logger.warn("Login failed: invalid password", { username });',
      '      return null;',
      '    }',
      '    const session = await createSession(user.id);',
      '    return { id: user.id, username: user.username, sessionToken: session.token };',
      '  } catch (err) {',
      '    logger.error("Login error", { username, error: err });',
      '    throw err;',
      '  }',
      '}',
      '',
      'async function verifyPassword(input: string, hash: string): Promise<boolean> {',
      '  // TODO: use bcrypt',
      '  return input === hash;',
      '}',
    ].join('\n')
  );

  // Fill src/config.ts (was empty, now 25 lines)
  writeFileSync(
    join(repoDir, 'src', 'config.ts'),
    Array.from({ length: 25 }, (_, i) => {
      if (i === 0) return 'export interface AppConfig {';
      if (i === 24) return '}';
      return `  field${i}: string;`;
    }).join('\n')
  );

  // Delete src/legacy.ts
  rmSync(join(repoDir, 'src', 'legacy.ts'));

  // Modify README.md
  writeFileSync(
    join(repoDir, 'README.md'),
    [
      '# My App',
      '',
      'A modern application with authentication.',
      '',
      'See docs/ for more info.',
    ].join('\n')
  );

  // Add a new untracked file (will appear as "added" via untracked file detection)
  writeFileSync(
    join(repoDir, 'src', 'new-feature.ts'),
    Array.from({ length: 20 }, (_, i) => `export const feature${i + 1} = true;`).join('\n')
  );

  // Add a new untracked markdown file for rendered markdown view demo
  mkdirSync(join(repoDir, 'docs'), { recursive: true });
  writeFileSync(
    join(repoDir, 'docs', 'architecture.md'),
    [
      '# Architecture Overview',
      '',
      'This document describes the high-level architecture of the application.',
      '',
      '## Core Modules',
      '',
      '- **Auth** — Handles user authentication and session management',
      '- **Config** — Application configuration and environment setup',
      '- **Database** — Data access layer with connection pooling',
      '',
      '## Request Lifecycle',
      '',
      'Every incoming request goes through the following stages:',
      '',
      '1. Route matching and middleware execution',
      '2. Authentication and authorization checks',
      '3. Request validation and parameter parsing',
      '4. Business logic execution',
      '5. Response serialization and delivery',
      '',
      '## Configuration',
      '',
      'The app reads configuration from environment variables and YAML files:',
      '',
      '```typescript',
      'const config = loadConfig({',
      '  env: process.env.NODE_ENV,',
      '  configDir: "./config",',
      '});',
      '```',
      '',
      '## Error Handling',
      '',
      'All errors are caught at the middleware level and transformed',
      'into structured JSON responses with appropriate HTTP status codes.',
    ].join('\n')
  );

  // Do NOT stage — changes are visible via bare `git diff`

  return repoDir;
}

/**
 * Creates a minimal prior review XML file for --resume-from testing.
 */
export function createPriorReviewXml(
  repoDir: string,
  comments: Array<{
    filePath: string;
    newLineStart?: number;
    newLineEnd?: number;
    oldLineStart?: number;
    oldLineEnd?: number;
    body: string;
    category?: string;
    severity?: string;
    confidence?: string;
  }>,
  /** Viewed state per file. Files carrying comments default to not viewed. */
  fileStates: Array<{ path: string; viewed: boolean }> = []
): string {
  const commentXml = (c: (typeof comments)[0]) => {
    const lineAttrs = [
      c.oldLineStart != null ? `old-line-start="${c.oldLineStart}"` : '',
      c.oldLineEnd != null ? `old-line-end="${c.oldLineEnd}"` : '',
      c.newLineStart != null ? `new-line-start="${c.newLineStart}"` : '',
      c.newLineEnd != null ? `new-line-end="${c.newLineEnd}"` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const signalAttrs = [
      c.severity ? `severity="${c.severity}"` : '',
      c.confidence ? `confidence="${c.confidence}"` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const allAttrs = [lineAttrs, signalAttrs].filter(Boolean).join(' ');
    const attrs = allAttrs ? ` ${allAttrs}` : '';
    const categoryEl = c.category
      ? `\n      <category>${c.category}</category>`
      : '';

    return `    <comment${attrs}>\n      <body>${escapeXml(c.body)}</body>${categoryEl}\n    </comment>`;
  };

  // Group comments by file
  const byFile = new Map<string, typeof comments>();
  for (const c of comments) {
    const arr = byFile.get(c.filePath) ?? [];
    arr.push(c);
    byFile.set(c.filePath, arr);
  }
  // A file can be marked done without carrying any comment.
  for (const { path } of fileStates) {
    if (!byFile.has(path)) byFile.set(path, []);
  }
  const viewedByPath = new Map(fileStates.map(f => [f.path, f.viewed]));

  const fileElements = Array.from(byFile.entries())
    .map(([path, fileComments]) => {
      const viewed = viewedByPath.get(path) ?? false;
      const openTag = `  <file path="${path}" change-type="modified" viewed="${viewed}"`;
      if (fileComments.length === 0) return `${openTag} />`;
      return `${openTag}>\n${fileComments.map(commentXml).join('\n')}\n  </file>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<review
  xmlns="urn:self-review:v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:self-review:v2 self-review-v2.xsd"
  timestamp="2026-02-10T12:00:00Z"
  git-diff-args=""
  repository="${repoDir}"
>
${fileElements}
</review>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
