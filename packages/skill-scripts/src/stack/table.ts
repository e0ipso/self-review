// `table`: the Markdown summary of a built stack, one row per step with its diff size and
// where its review stands, read from the files the skill keeps beside the spec.

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { branchName, loadSpec, stackBase } from './spec';
import { diffstat, shortstat } from './stats';

const READY = /Review ready at (\S+)/g;

/**
 * A step's review state: a finished `<slug>.review.xml` first, else the last URL its
 * `<slug>.serve.log` announced.
 */
export function serveStatus(specDir: string, slug: string): string {
  if (existsSync(path.join(specDir, `${slug}.review.xml`))) {
    return `completed (\`${slug}.review.xml\`)`;
  }
  let log: string;
  try {
    log = readFileSync(path.join(specDir, `${slug}.serve.log`), 'utf8');
  } catch {
    return 'not started';
  }
  const urls = [...log.matchAll(READY)].map(match => match[1]);
  return urls.length > 0 ? urls[urls.length - 1] : 'not ready, see log';
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
