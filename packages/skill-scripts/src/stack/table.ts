// `table`: the Markdown summary of a built stack, one row per step with its diff size and
// where its review stands, read from the files the skill keeps beside the spec.

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { branchName, loadSpec, stackBase } from './spec';
import { diffstat, shortstat } from './stats';

// The two lines self-review-serve writes to stderr when a review opens and when it ends.
const SERVE_EVENT = /Review ready at (\S+)|Review complete/g;

/**
 * A step's review state. A server log decides when there is one: whichever came last of
 * "Review ready at <url>" (the URL) and "Review complete" (completed). The review file alone
 * cannot, since a critique writes it before the review opens. With no log (desktop mode), an
 * existing `<slug>.review.xml` means completed.
 */
export function serveStatus(specDir: string, slug: string): string {
  const completed = `completed (\`${slug}.review.xml\`)`;
  let log: string;
  try {
    log = readFileSync(path.join(specDir, `${slug}.serve.log`), 'utf8');
  } catch {
    return existsSync(path.join(specDir, `${slug}.review.xml`)) ? completed : 'not started';
  }
  const last = [...log.matchAll(SERVE_EVENT)].pop();
  if (last === undefined) return 'not ready, see log';
  return last[1] ?? completed;
}

/** A description as one table cell: pipes escaped, line breaks folded. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ');
}

/** `table <spec>`: print the summary; always 0. */
export function cmdTable(specFile: string): number {
  const spec = loadSpec(specFile, { requireDiffArgs: false });
  const specDir = path.dirname(path.resolve(specFile));
  const base = stackBase(spec);
  const rows = ['| # | Step | Description | Diff | Review URL |', '|---|---|---|---|---|'];
  let previous = base;
  spec.steps.forEach((step, index) => {
    const ref = branchName(spec, step);
    const size = diffstat(shortstat(previous, ref));
    const status = serveStatus(specDir, step.slug);
    rows.push(`| ${index + 1} | \`${ref}\` | ${cell(step.description)} | ${size} | ${status} |`);
    previous = ref;
  });
  rows.push(`| | **Total** | | **${diffstat(shortstat(base, previous))}** | |`);
  process.stdout.write(`${rows.join('\n')}\n`);
  return 0;
}
