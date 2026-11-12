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
import { createStartupHost } from './startup-composition';
import { reportCoreCompatibility } from './core-capabilities';
import { createServeLifecycle } from './lifecycle';
import { createBoundReviewServer, listenLoopback } from './bound-server';
import { createPublicationOperations } from './review-operations';
import { installedServeEngine } from './engine-contract';
import { generateCapability } from './capability';
import { formatLaunchUrl } from './protocol';

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

The URL is printed to stderr on start. Open exactly that URL: the part after
'#' is this session's key, drawn fresh each start, and the browser keeps it
out of the address bar once the page has loaded. A reloaded or retyped
address has no key and the page says so; if the URL is lost, stop this
process and start it again. Over ssh, forward the port (ssh -L) and open the
same URL against the forwarded port, keeping the '#' part.

The output path is fixed by the arguments above and cannot be changed from
the browser. Completing the review writes that file and stops this process.
Nothing is saved before then, and closing the tab once you have written a
comment warns you first. If the file cannot be written, the browser says why
and keeps the review; fix the problem and press Finish Review again.

The listener binds to 127.0.0.1, refuses any request that names another host
or origin so a web page cannot reach it, and refuses any API request without
the key, so another account on the same host cannot either.
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

  const host = createStartupHost(process.cwd(), message => console.error(message));
  reportCoreCompatibility(host.reportDiagnostic);
  const lifetime = createServeLifecycle({
    signals: process,
    reportDiagnostic: host.reportDiagnostic,
  });
  const startupTimer = setTimeout(() => {
    console.error('[serve] Startup deadline reached; stopping.');
    lifetime.stop(1);
  }, 45_000);
  try {
    await lifetime.track(
      (async () => {
        const { session, output } = await resolveSession(
          args,
          {
            signal: lifetime.signal,
            timeoutMs: 30_000,
          },
          host
        );
        if (lifetime.signal.aborted) throw lifetime.signal.reason;
        const capability = generateCapability();
        const operations = createPublicationOperations(
          session,
          output,
          installedServeEngine,
          host.reportDiagnostic
        );
        const server = createBoundReviewServer({
          capability,
          operations,
          publication: operations,
          reportDiagnostic: host.reportDiagnostic,
        });
        lifetime.attach(server);
        const { url } = await listenLoopback(server, 0, { signal: lifetime.signal });
        if (lifetime.signal.aborted) throw lifetime.signal.reason;
        console.error(`[serve] Review ready at ${formatLaunchUrl(url, capability)}`);
        console.error(
          `[serve] Completing the review writes ${output.path} and stops this process.`
        );
        console.error(
          '[serve] The listener is loopback-only. The part of the URL after # is this ' +
            "session's key: open the URL exactly as printed, and do not share it."
        );
      })()
    );
  } catch (error) {
    if (!lifetime.signal.aborted)
      console.error(`[serve] ${error instanceof Error ? error.message : String(error)}`);
    lifetime.stop(1);
  } finally {
    clearTimeout(startupTimer);
  }
}

main().catch(error => {
  console.error(`[serve] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
