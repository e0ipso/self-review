import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTestRepo, createPriorReviewXml } from '../fixtures/test-repo';

/**
 * Helper to run shell commands in a given directory.
 */
function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: 'pipe' }).toString();
}

/**
 * Initializes a fresh git repo in a temp directory with standard git config.
 * Returns the repo path.
 */
function initRepo(): string {
  const repoDir = mkdtempSync(join(tmpdir(), 'self-review-screenshot-'));
  run('git init', repoDir);
  run('git config user.email "test@test.com"', repoDir);
  run('git config user.name "Test"', repoDir);
  return repoDir;
}

/**
 * Creates a git repo with an untracked plan.md file for directory-mode review.
 *
 * The plan looks like a realistic AI assistant implementation plan with
 * headings, bullet lists, a mermaid diagram, and a TypeScript code snippet.
 * The repo has a single initial commit (README), and plan.md is left untracked.
 *
 * Returns the repo path. Caller is responsible for cleanup.
 */
export function createPlanReviewFixture(): string {
  const repoDir = initRepo();

  // Initial commit with a basic README
  writeFileSync(
    join(repoDir, 'README.md'),
    ['# Project Notes', '', 'Working directory for implementation plans.'].join(
      '\n'
    )
  );
  run('git add -A', repoDir);
  run('git commit -m "Initial commit"', repoDir);

  // Untracked plan.md — a realistic AI-generated implementation plan
  writeFileSync(
    join(repoDir, 'plan.md'),
    [
      '# WebSocket Real-Time Notification Service',
      '',
      '## Approach',
      '',
      'Replace the current polling-based notification system with a WebSocket',
      'connection that pushes events to connected clients in real time. The',
      'server maintains a registry of active connections keyed by user ID and',
      'broadcasts relevant events as they occur.',
      '',
      '## Implementation Steps',
      '',
      '- Add `ws` dependency and create `WebSocketServer` on the existing HTTP server',
      '- Implement connection registry with heartbeat-based cleanup',
      '- Define a typed event envelope for all notification payloads',
      '- Migrate the three highest-traffic polling endpoints:',
      '  - `/api/notifications/unread` (badge count)',
      '  - `/api/activity/feed` (live activity stream)',
      '  - `/api/tasks/status` (background job progress)',
      '- Add reconnection logic with exponential backoff on the client',
      '- Write integration tests using a local WebSocket test harness',
      '- Add Grafana dashboard panels for connection count and message throughput',
      '',
      '## Architecture',
      '',
      '```mermaid',
      'graph LR',
      '  A[Client App] -->|ws://| B[WebSocket Server]',
      '  B --> C[Connection Registry]',
      '  D[Event Bus] --> B',
      '  E[Auth Service] --> B',
      '  B -->|push| A',
      '```',
      '',
      '## Key Types',
      '',
      '```typescript',
      'interface NotificationEnvelope<T = unknown> {',
      '  id: string;',
      '  type: "unread_count" | "activity" | "task_status";',
      '  timestamp: string;',
      '  payload: T;',
      '}',
      '',
      'interface ConnectionEntry {',
      '  userId: string;',
      '  socket: WebSocket;',
      '  lastHeartbeat: number;',
      '}',
      '```',
      '',
      '## Risk Assessment',
      '',
      '- **Memory pressure** — Each open WebSocket holds a small buffer. At 10k',
      '  concurrent connections this is ~80 MB, well within budget.',
      '- **Stale connections** — Heartbeat interval of 30s with a 10s grace period',
      '  ensures dead sockets are reaped promptly.',
      '- **Backward compatibility** — Polling endpoints remain active during the',
      '  migration window; clients that have not upgraded continue to work.',
    ].join('\n')
  );

  return repoDir;
}

/**
 * Creates a git repo with unstaged code changes and a .self-review.yaml config
 * defining review categories (bug, nit, question, improvement).
 *
 * Builds on createTestRepo() and adds the YAML config file.
 *
 * Returns the repo path. Caller is responsible for cleanup.
 */
export function createCodeReviewFixture(): string {
  const repoDir = createTestRepo();

  // Add .self-review.yaml with review categories
  writeFileSync(
    join(repoDir, '.self-review.yaml'),
    [
      'categories:',
      '  - name: bug',
      '    description: Potential bug or incorrect behavior',
      '    color: "#e53e3e"',
      '  - name: nit',
      '    description: Minor style or formatting issue',
      '    color: "#a0aec0"',
      '  - name: question',
      '    description: Request for clarification',
      '    color: "#3182ce"',
      '  - name: improvement',
      '    description: Suggested enhancement or refactor',
      '    color: "#38a169"',
    ].join('\n')
  );

  return repoDir;
}

/**
 * Creates a git repo with multiple source files across directories, then
 * makes unstaged modifications to several of them to produce realistic diffs.
 *
 * Includes a .self-review.yaml with exploration-oriented categories.
 *
 * Returns the repo path. Caller is responsible for cleanup.
 */
export function createExplorationFixture(): string {
  const repoDir = initRepo();

  mkdirSync(join(repoDir, 'src', 'auth'), { recursive: true });
  mkdirSync(join(repoDir, 'src', 'utils'), { recursive: true });
  mkdirSync(join(repoDir, 'docs'), { recursive: true });

  // ── Initial commit: baseline files ──

  writeFileSync(
    join(repoDir, 'src', 'auth', 'middleware.ts'),
    [
      'import { Request, Response, NextFunction } from "express";',
      'import { verifyToken } from "../utils/helpers";',
      '',
      'export interface AuthRequest extends Request {',
      '  userId?: string;',
      '}',
      '',
      'export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {',
      '  const token = req.headers.authorization?.replace("Bearer ", "");',
      '  if (!token) {',
      '    return res.status(401).json({ error: "Missing token" });',
      '  }',
      '  try {',
      '    const payload = verifyToken(token);',
      '    req.userId = payload.sub;',
      '    next();',
      '  } catch {',
      '    return res.status(401).json({ error: "Invalid token" });',
      '  }',
      '}',
      '',
      'export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {',
      '  const token = req.headers.authorization?.replace("Bearer ", "");',
      '  if (token) {',
      '    try { req.userId = verifyToken(token).sub; } catch { /* ignore */ }',
      '  }',
      '  next();',
      '}',
    ].join('\n')
  );

  writeFileSync(
    join(repoDir, 'src', 'utils', 'helpers.ts'),
    [
      'import jwt from "jsonwebtoken";',
      '',
      'const SECRET = process.env.JWT_SECRET || "dev-secret";',
      '',
      'export function verifyToken(token: string): jwt.JwtPayload {',
      '  return jwt.verify(token, SECRET) as jwt.JwtPayload;',
      '}',
      '',
      'export function createToken(userId: string): string {',
      '  return jwt.sign({ sub: userId }, SECRET, { expiresIn: "24h" });',
      '}',
      '',
      'export function slugify(text: string): string {',
      '  return text',
      '    .toLowerCase()',
      '    .replace(/[^a-z0-9]+/g, "-")',
      '    .replace(/^-|-$/g, "");',
      '}',
      '',
      'export function truncate(str: string, maxLen: number): string {',
      '  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;',
      '}',
    ].join('\n')
  );

  writeFileSync(
    join(repoDir, 'src', 'config.ts'),
    [
      'export interface AppConfig {',
      '  port: number;',
      '  logLevel: "debug" | "info" | "warn" | "error";',
      '  dbUrl: string;',
      '  corsOrigins: string[];',
      '}',
      '',
      'export function loadConfig(): AppConfig {',
      '  return {',
      '    port: Number(process.env.PORT) || 3000,',
      '    logLevel: (process.env.LOG_LEVEL as AppConfig["logLevel"]) || "info",',
      '    dbUrl: process.env.DATABASE_URL || "postgres://localhost/app",',
      '    corsOrigins: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),',
      '  };',
      '}',
    ].join('\n')
  );

  writeFileSync(
    join(repoDir, 'docs', 'api-guide.md'),
    [
      '# API Guide',
      '',
      '## Authentication',
      '',
      'All protected endpoints require a Bearer token in the `Authorization` header.',
      '',
      '```',
      'Authorization: Bearer <token>',
      '```',
      '',
      '## Endpoints',
      '',
      '### POST /auth/login',
      '',
      'Authenticate a user and receive an access token.',
      '',
      '| Field      | Type   | Required |',
      '|------------|--------|----------|',
      '| `username` | string | yes      |',
      '| `password` | string | yes      |',
      '',
      '### GET /users/me',
      '',
      'Returns the current authenticated user profile.',
      '',
      '### PUT /users/me',
      '',
      'Update the current user profile. Accepts partial updates.',
      '',
      '## Error Responses',
      '',
      'All errors return a JSON body with an `error` field:',
      '',
      '```json',
      '{ "error": "Human-readable error message" }',
      '```',
    ].join('\n')
  );

  writeFileSync(
    join(repoDir, 'config.yaml'),
    [
      'server:',
      '  port: 3000',
      '  host: 0.0.0.0',
      '',
      'database:',
      '  pool_size: 10',
      '  timeout: 5000',
      '',
      'logging:',
      '  level: info',
      '  format: json',
    ].join('\n')
  );

  run('git add -A', repoDir);
  run('git commit -m "Initial commit"', repoDir);

  // ── Unstaged modifications ──

  // Modify middleware.ts: add rate limiting and improve error messages
  writeFileSync(
    join(repoDir, 'src', 'auth', 'middleware.ts'),
    [
      'import { Request, Response, NextFunction } from "express";',
      'import { verifyToken } from "../utils/helpers";',
      'import { logger } from "../utils/logger";',
      '',
      'export interface AuthRequest extends Request {',
      '  userId?: string;',
      '  authMethod?: "bearer" | "api-key";',
      '}',
      '',
      'const RATE_LIMIT_WINDOW = 60_000; // 1 minute',
      'const MAX_FAILED_ATTEMPTS = 5;',
      'const failedAttempts = new Map<string, { count: number; resetAt: number }>();',
      '',
      'export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {',
      '  const clientIp = req.ip || "unknown";',
      '  const attempts = failedAttempts.get(clientIp);',
      '  if (attempts && attempts.count >= MAX_FAILED_ATTEMPTS && Date.now() < attempts.resetAt) {',
      '    logger.warn("Rate limited auth attempt", { ip: clientIp });',
      '    return res.status(429).json({ error: "Too many failed attempts, try again later" });',
      '  }',
      '',
      '  const token = req.headers.authorization?.replace("Bearer ", "");',
      '  if (!token) {',
      '    return res.status(401).json({ error: "Missing authentication token" });',
      '  }',
      '  try {',
      '    const payload = verifyToken(token);',
      '    req.userId = payload.sub;',
      '    req.authMethod = "bearer";',
      '    failedAttempts.delete(clientIp);',
      '    next();',
      '  } catch (err) {',
      '    logger.warn("Auth failed", { ip: clientIp, reason: (err as Error).message });',
      '    const entry = failedAttempts.get(clientIp) || { count: 0, resetAt: 0 };',
      '    entry.count += 1;',
      '    entry.resetAt = Date.now() + RATE_LIMIT_WINDOW;',
      '    failedAttempts.set(clientIp, entry);',
      '    return res.status(401).json({ error: "Invalid or expired token" });',
      '  }',
      '}',
      '',
      'export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {',
      '  const token = req.headers.authorization?.replace("Bearer ", "");',
      '  if (token) {',
      '    try {',
      '      req.userId = verifyToken(token).sub;',
      '      req.authMethod = "bearer";',
      '    } catch {',
      '      /* token present but invalid — proceed unauthenticated */',
      '    }',
      '  }',
      '  next();',
      '}',
    ].join('\n')
  );

  // Modify helpers.ts: add token refresh, update truncate
  writeFileSync(
    join(repoDir, 'src', 'utils', 'helpers.ts'),
    [
      'import jwt from "jsonwebtoken";',
      '',
      'const SECRET = process.env.JWT_SECRET || "dev-secret";',
      'const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";',
      '',
      'export function verifyToken(token: string): jwt.JwtPayload {',
      '  return jwt.verify(token, SECRET) as jwt.JwtPayload;',
      '}',
      '',
      'export function createToken(userId: string, expiresIn = "24h"): string {',
      '  return jwt.sign({ sub: userId }, SECRET, { expiresIn });',
      '}',
      '',
      'export function createRefreshToken(userId: string): string {',
      '  return jwt.sign({ sub: userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: "30d" });',
      '}',
      '',
      'export function verifyRefreshToken(token: string): jwt.JwtPayload {',
      '  const payload = jwt.verify(token, REFRESH_SECRET) as jwt.JwtPayload;',
      '  if (payload.type !== "refresh") {',
      '    throw new Error("Token is not a refresh token");',
      '  }',
      '  return payload;',
      '}',
      '',
      'export function slugify(text: string): string {',
      '  return text',
      '    .toLowerCase()',
      '    .replace(/[^a-z0-9]+/g, "-")',
      '    .replace(/^-|-$/g, "");',
      '}',
      '',
      'export function truncate(str: string, maxLen: number, suffix = "..."): string {',
      '  if (str.length <= maxLen) return str;',
      '  return str.slice(0, maxLen - suffix.length) + suffix;',
      '}',
    ].join('\n')
  );

  // Modify config.yaml: add redis section
  writeFileSync(
    join(repoDir, 'config.yaml'),
    [
      'server:',
      '  port: 3000',
      '  host: 0.0.0.0',
      '',
      'database:',
      '  pool_size: 20',
      '  timeout: 5000',
      '',
      'redis:',
      '  url: redis://localhost:6379',
      '  prefix: app:',
      '',
      'logging:',
      '  level: info',
      '  format: json',
    ].join('\n')
  );

  // Modify docs/api-guide.md: add rate limiting section
  writeFileSync(
    join(repoDir, 'docs', 'api-guide.md'),
    [
      '# API Guide',
      '',
      '## Authentication',
      '',
      'All protected endpoints require a Bearer token in the `Authorization` header.',
      '',
      '```',
      'Authorization: Bearer <token>',
      '```',
      '',
      '## Rate Limiting',
      '',
      'Authentication endpoints enforce rate limiting per client IP.',
      'After 5 failed attempts within 60 seconds, further requests receive `429 Too Many Requests`.',
      '',
      '## Endpoints',
      '',
      '### POST /auth/login',
      '',
      'Authenticate a user and receive an access token.',
      '',
      '| Field      | Type   | Required |',
      '|------------|--------|----------|',
      '| `username` | string | yes      |',
      '| `password` | string | yes      |',
      '',
      '### POST /auth/refresh',
      '',
      'Exchange a refresh token for a new access token.',
      '',
      '### GET /users/me',
      '',
      'Returns the current authenticated user profile.',
      '',
      '### PUT /users/me',
      '',
      'Update the current user profile. Accepts partial updates.',
      '',
      '## Error Responses',
      '',
      'All errors return a JSON body with an `error` field:',
      '',
      '```json',
      '{ "error": "Human-readable error message" }',
      '```',
    ].join('\n')
  );

  // Add .self-review.yaml with exploration-oriented categories
  writeFileSync(
    join(repoDir, '.self-review.yaml'),
    [
      'categories:',
      '  - name: question',
      '    description: Need clarification on intent or behavior',
      '    color: "#3182ce"',
      '  - name: improvement',
      '    description: Suggested enhancement or refactor',
      '    color: "#38a169"',
      '  - name: needs-docs',
      '    description: Missing or outdated documentation',
      '    color: "#d69e2e"',
    ].join('\n')
  );

  return repoDir;
}

/**
 * Creates a code review repo with a pre-existing AI-generated review XML file.
 * Useful for demonstrating the --resume-from workflow where a human reviews
 * AI feedback in the self-review UI.
 *
 * Returns the repo path and the path to the generated XML review file.
 * Caller is responsible for cleanup.
 */
export function createAIReviewFixture(): { repoDir: string; xmlPath: string } {
  const repoDir = createCodeReviewFixture();

  const xml = createPriorReviewXml(repoDir, [
    {
      filePath: 'src/auth/login.ts',
      newLineStart: 11,
      newLineEnd: 11,
      body: 'Consider using bcrypt instead of plain comparison for password verification. The current `verifyPassword` function does a direct string equality check, which means passwords are stored and compared in plaintext. Use `bcrypt.compare()` with hashed passwords to prevent credential exposure if the database is compromised.',
      category: 'bug',
    },
    {
      filePath: 'src/auth/login.ts',
      body: 'This function has grown beyond a single responsibility \u2014 it now handles user lookup, password verification, session creation, and structured logging. Consider extracting the session creation into a `createUserSession(userId)` helper and the credential check into an `authenticateUser(username, password)` function. This will make each piece independently testable.',
      category: 'improvement',
    },
    {
      filePath: 'README.md',
      newLineStart: 3,
      newLineEnd: 3,
      body: 'The description mentions authentication but the README lacks a "Getting Started" section. New contributors would benefit from setup instructions, especially the required environment variables and database configuration.',
      category: 'nit',
    },
  ]);

  const xmlPath = join(repoDir, 'review.xml');
  writeFileSync(xmlPath, xml);

  return { repoDir, xmlPath };
}
