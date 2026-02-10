import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Creates a temporary git repository with deterministic staged changes
 * matching the Background sections in the Gherkin feature files.
 *
 * The repo has two commits:
 *   1. Initial commit with baseline files
 *   2. Staged (but uncommitted) changes that produce a known diff
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

  // ── Staged changes ──

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

  // Add src/config.ts (new file, 25 lines)
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
    ['# My App', '', 'A modern application with authentication.', '', 'See docs/ for more info.'].join('\n')
  );

  // Stage everything
  run('git add -A');

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
  }>
): string {
  const commentXml = (c: typeof comments[0]) => {
    const lineAttrs = [
      c.oldLineStart != null ? `old-line-start="${c.oldLineStart}"` : '',
      c.oldLineEnd != null ? `old-line-end="${c.oldLineEnd}"` : '',
      c.newLineStart != null ? `new-line-start="${c.newLineStart}"` : '',
      c.newLineEnd != null ? `new-line-end="${c.newLineEnd}"` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const attrs = lineAttrs ? ` ${lineAttrs}` : '';
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

  const fileElements = Array.from(byFile.entries())
    .map(
      ([path, fileComments]) =>
        `  <file path="${path}" change-type="modified" viewed="false">\n${fileComments.map(commentXml).join('\n')}\n  </file>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<review
  xmlns="urn:self-review:v1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:self-review:v1 self-review-v1.xsd"
  timestamp="2026-02-10T12:00:00Z"
  git-diff-args="--staged"
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
