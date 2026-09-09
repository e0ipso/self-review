#!/usr/bin/env node

// The serve-mode entry point: resolve one review session, serve it on a
// port, and stop when the review is complete.
//
// Composition only — argument parsing is ./args, session resolution is
// ./startup, the routes are ./server and the completion is ./lifecycle. The
// order below is the load-bearing part: the session is fully resolved, and
// the completion hook attached, before the listener opens, so no request can
// reach a half-built session and no submission can arrive unobserved.

import { createRequire } from 'node:module';
import { parseServeArgs } from './args';
import { resolveSession } from './startup';
import { completeReviewOnSubmit } from './lifecycle';
import { createReviewServer, listenLoopback } from './server';

const HELP = `
self-review-serve - Serve the self-review interface over HTTP

Usage: self-review-serve [options] [<git-diff-args>...]

Options:
  -o, --output <file>     Write the review to <file> (default: ./review.xml, or
                          output-file from .self-review.yaml)
  --resume-from <file>    Load a previous review XML file
  -h, --help              Show this help message
  -v, --version           Show version number

All other arguments are passed to git diff. With none, the unstaged working
tree changes are reviewed. Outside a git repository, pass a directory or file.

Examples:
  self-review-serve                             # unstaged changes
  self-review-serve --staged
  self-review-serve main..feature-branch
  self-review-serve --resume-from review.xml    # resume a previous review

The URL is printed to stderr on start. The output path is fixed by the
arguments above and cannot be changed from the browser. Completing the review
writes that file and stops this process. Nothing is saved before then, and
closing the tab once you have written a comment warns you first.

The listener binds to 127.0.0.1 and there is no authentication: anything that
can reach the port can read the diff and complete the review.
`.trim();

function printVersion(): void {
  try {
    // Read at runtime rather than imported, so the version is the installed
    // package's own. dist/cli.js sits one directory below package.json in
    // both the workspace and an installed tarball.
    const requireFromHere = createRequire(import.meta.url);
    const pkg = requireFromHere('../package.json') as { version: string };
    console.error(`self-review-serve v${pkg.version}`);
  } catch {
    console.error('self-review-serve (version unknown)');
  }
}

async function main(): Promise<void> {
  const args = parseServeArgs(process.argv.slice(2));
  if (args.help) {
    console.error(HELP);
    return;
  }
  if (args.version) {
    printVersion();
    return;
  }

  const { session, repositoryRoot, outputPath } = await resolveSession(args);

  const server = createReviewServer({ session, repositoryRoot });
  completeReviewOnSubmit({ server, session, outputPath });

  const { url } = await listenLoopback(server);
  console.error(`[serve] Review ready at ${url}`);
  console.error(`[serve] Completing the review writes ${outputPath} and stops this process.`);
  console.error('[serve] The listener is loopback-only and unauthenticated.');
}

main().catch(error => {
  console.error(`[serve] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
