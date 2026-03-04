/**
 * Static diff fixture data matching the test-repo.ts output.
 * This provides the same DiffFile[] that the Electron app would generate
 * from the test repository, but without needing git.
 */
import type { DiffFile, DiffLoadPayload, DiffSource, AppConfig, CategoryDef } from '../../packages/core/src/types';

// ── src/auth/login.ts — modified ──

const loginOld = [
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
];

const loginNew = [
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
];

const loginFile: DiffFile = {
  oldPath: 'src/auth/login.ts',
  newPath: 'src/auth/login.ts',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@ -1,17 +1,27 @@',
      oldStart: 1,
      oldLines: 17,
      newStart: 1,
      newLines: 27,
      lines: [
        { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: ' import { db } from "../db";' },
        { type: 'deletion', oldLineNumber: 2, newLineNumber: null, content: '-' },
        { type: 'addition', newLineNumber: 2, oldLineNumber: null, content: '+import { createSession } from "../session";' },
        { type: 'addition', newLineNumber: 3, oldLineNumber: null, content: '+import { logger } from "../logger";' },
        { type: 'addition', newLineNumber: 4, oldLineNumber: null, content: '+' },
        { type: 'context', oldLineNumber: 3, newLineNumber: 5, content: ' export async function login(username: string, password: string) {' },
        { type: 'addition', newLineNumber: 6, oldLineNumber: null, content: '+  try {' },
        { type: 'context', oldLineNumber: 4, newLineNumber: 7, content: '   const user = await db.findUser(username);' },
        { type: 'context', oldLineNumber: 5, newLineNumber: 8, content: '   if (!user) {' },
        { type: 'deletion', oldLineNumber: 6, newLineNumber: null, content: '-    throw new Error("User not found");' },
        { type: 'addition', newLineNumber: 9, oldLineNumber: null, content: '+    logger.warn("Login failed: user not found", { username });' },
        { type: 'addition', newLineNumber: 10, oldLineNumber: null, content: '+    return null;' },
        { type: 'context', oldLineNumber: 7, newLineNumber: 11, content: '   }' },
        { type: 'deletion', oldLineNumber: 8, newLineNumber: null, content: '-  const valid = checkPassword(password, user.hash);' },
        { type: 'addition', newLineNumber: 12, oldLineNumber: null, content: '+  const valid = await verifyPassword(password, user.hash);' },
        { type: 'context', oldLineNumber: 9, newLineNumber: 13, content: '   if (!valid) {' },
        { type: 'deletion', oldLineNumber: 10, newLineNumber: null, content: '-    throw new Error("Invalid password");' },
        { type: 'addition', newLineNumber: 14, oldLineNumber: null, content: '+    logger.warn("Login failed: invalid password", { username });' },
        { type: 'addition', newLineNumber: 15, oldLineNumber: null, content: '+    return null;' },
        { type: 'context', oldLineNumber: 11, newLineNumber: 16, content: '   }' },
        { type: 'deletion', oldLineNumber: 12, newLineNumber: null, content: '-  return { id: user.id, username: user.username };' },
        { type: 'addition', newLineNumber: 17, oldLineNumber: null, content: '+  const session = await createSession(user.id);' },
        { type: 'addition', newLineNumber: 18, oldLineNumber: null, content: '+  return { id: user.id, username: user.username, sessionToken: session.token };' },
        { type: 'addition', newLineNumber: 19, oldLineNumber: null, content: '+  } catch (err) {' },
        { type: 'addition', newLineNumber: 20, oldLineNumber: null, content: '+    logger.error("Login error", { username, error: err });' },
        { type: 'addition', newLineNumber: 21, oldLineNumber: null, content: '+    throw err;' },
        { type: 'addition', newLineNumber: 22, oldLineNumber: null, content: '+  }' },
        { type: 'context', oldLineNumber: 13, newLineNumber: 23, content: ' }' },
        { type: 'context', oldLineNumber: 14, newLineNumber: 24, content: ' ' },
        { type: 'deletion', oldLineNumber: 15, newLineNumber: null, content: '-function checkPassword(input: string, hash: string): boolean {' },
        { type: 'deletion', oldLineNumber: 16, newLineNumber: null, content: '-  return input === hash; // TODO: proper hashing' },
        { type: 'addition', newLineNumber: 25, oldLineNumber: null, content: '+async function verifyPassword(input: string, hash: string): Promise<boolean> {' },
        { type: 'addition', newLineNumber: 26, oldLineNumber: null, content: '+  // TODO: use bcrypt' },
        { type: 'addition', newLineNumber: 27, oldLineNumber: null, content: '+  return input === hash;' },
        { type: 'context', oldLineNumber: 17, newLineNumber: 28, content: ' }' },
      ],
    },
  ],
};

// ── src/config.ts — modified (was empty, now filled) ──

const configLines = Array.from({ length: 25 }, (_, i) => {
  if (i === 0) return 'export interface AppConfig {';
  if (i === 24) return '}';
  return `  field${i}: string;`;
});

const configFile: DiffFile = {
  oldPath: 'src/config.ts',
  newPath: 'src/config.ts',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@ -0,0 +1,25 @@',
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 25,
      lines: configLines.map((line, i) => ({
        type: 'addition' as const,
        oldLineNumber: null,
        newLineNumber: i + 1,
        content: '+' + line,
      })),
    },
  ],
};

// ── src/legacy.ts — deleted ──

const legacyLines = Array.from({ length: 40 }, (_, i) => `// legacy line ${i + 1}`);

const legacyFile: DiffFile = {
  oldPath: 'src/legacy.ts',
  newPath: 'src/legacy.ts',
  changeType: 'deleted',
  isBinary: false,
  hunks: [
    {
      header: '@@ -1,40 +0,0 @@',
      oldStart: 1,
      oldLines: 40,
      newStart: 0,
      newLines: 0,
      lines: legacyLines.map((line, i) => ({
        type: 'deletion' as const,
        oldLineNumber: i + 1,
        newLineNumber: null,
        content: '-' + line,
      })),
    },
  ],
};

// ── README.md — modified ──

const readmeFile: DiffFile = {
  oldPath: 'README.md',
  newPath: 'README.md',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@ -1,3 +1,5 @@',
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 5,
      lines: [
        { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: ' # My App' },
        { type: 'context', oldLineNumber: 2, newLineNumber: 2, content: ' ' },
        { type: 'deletion', oldLineNumber: 3, newLineNumber: null, content: '-A simple application.' },
        { type: 'addition', newLineNumber: 3, oldLineNumber: null, content: '+A modern application with authentication.' },
        { type: 'addition', newLineNumber: 4, oldLineNumber: null, content: '+' },
        { type: 'addition', newLineNumber: 5, oldLineNumber: null, content: '+See docs/ for more info.' },
      ],
    },
  ],
};

// ── src/new-feature.ts — added (untracked) ──

const newFeatureLines = Array.from({ length: 20 }, (_, i) => `export const feature${i + 1} = true;`);

const newFeatureFile: DiffFile = {
  oldPath: '/dev/null',
  newPath: 'src/new-feature.ts',
  changeType: 'added',
  isBinary: false,
  isUntracked: true,
  hunks: [
    {
      header: '@@ -0,0 +1,20 @@',
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 20,
      lines: newFeatureLines.map((line, i) => ({
        type: 'addition' as const,
        oldLineNumber: null,
        newLineNumber: i + 1,
        content: '+' + line,
      })),
    },
  ],
};

// ── docs/architecture.md — added (untracked) ──

const architectureLines = [
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
];

const architectureFile: DiffFile = {
  oldPath: '/dev/null',
  newPath: 'docs/architecture.md',
  changeType: 'added',
  isBinary: false,
  isUntracked: true,
  hunks: [
    {
      header: '@@ -0,0 +1,35 @@',
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: architectureLines.length,
      lines: architectureLines.map((line, i) => ({
        type: 'addition' as const,
        oldLineNumber: null,
        newLineNumber: i + 1,
        content: '+' + line,
      })),
    },
  ],
};

// ── Exported fixture data ──

/** All diff files in the order they'd appear from `git diff` + untracked detection */
export const fixtureFiles: DiffFile[] = [
  readmeFile,
  loginFile,
  configFile,
  legacyFile,
  architectureFile,
  newFeatureFile,
];

export const fixtureSource: DiffSource = {
  type: 'git',
  gitDiffArgs: '',
  repository: '/mock-test-repo',
};

export function createFixturePayload(): DiffLoadPayload {
  return {
    files: fixtureFiles,
    source: fixtureSource,
  };
}

/** Default categories matching what test features expect */
export const defaultCategories: CategoryDef[] = [
  { name: 'bug', description: 'Likely defect', color: '#e53e3e' },
  { name: 'security', description: 'Security vulnerability', color: '#dd6b20' },
  { name: 'style', description: 'Code style', color: '#3182ce' },
  { name: 'question', description: 'Clarification needed', color: '#805ad5' },
  { name: 'task', description: 'Action item', color: '#38a169' },
  { name: 'nit', description: 'Minor nitpick', color: '#718096' },
];

/** Custom categories used by commenting feature tests */
export const commentingCategories: CategoryDef[] = [
  { name: 'bug', description: 'bug category', color: '#e53e3e' },
  { name: 'nit', description: 'nit category', color: '#718096' },
  { name: 'question', description: 'question category', color: '#805ad5' },
];
