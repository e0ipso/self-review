// Entry point of the self-review-stack helper, bundled into
// .agents/skills/self-review-stack/scripts/stack.cjs. Core is imported by relative source
// path, never through the @self-review/core barrel, so the bundle carries only the modules
// the helper reaches.

import { cmdBuild } from './build';
import { cmdCheckImports, type CheckImportsOptions } from './check-imports';
import { StackError } from './git';
import { cmdResolve } from './resolve';
import { cmdTable } from './table';

const USAGE = `usage: stack.cjs resolve <git-diff-args...>
       stack.cjs build <spec.json>
       stack.cjs check-imports <spec.json> [--alias PREFIX=DIR]... [--ignore REGEX]...
       stack.cjs table <spec.json>

Builds a stack of local review branches for one git diff. Run it from inside the
repository. It never writes the working tree, the index, HEAD or an existing ref.

Commands:

  resolve <git-diff-args...>
      Print what the stack would hold, then one "<status>\\t<path>" line per
      changed path (status as in git diff --name-status --no-renames):

        base     <commit the stack starts from>
        target   <tree the stack ends at>  (<what is compared>)
        paths    <pathspecs>                   (only when pathspecs were given)
        options  <pass-through options>        (or "(none)")
        diff     <N> files changed +<insertions> -<deletions>
        M\tsrc/retry.ts

      Prints "No changes to stack." and exits 3 when the diff is empty.

  build <spec.json>
      Validate the spec against the diff its "diff_args" name, build one commit
      per step on a throwaway index, confirm the stack reproduces the diff, then
      create the branch <prefix>/<slug> for every step (all of them or none).
      Prints each branch, its short SHA and subject, and the diff arguments for
      each step: the pass-through options, then <previous>..<step branch>, where
      step 1's previous is the base's short SHA.

  check-imports <spec.json> [--alias PREFIX=DIR]... [--ignore REGEX]...
      A JS/TS heuristic over a built stack, read with regular expressions. At
      every step, report each import of a file that does not exist yet and each
      named import a changed file does not export yet, then "<N> problem(s)":

        retry-stack/02-retry: src/client.ts imports ./backoff, which does not exist at this step
        retry-stack/02-retry: src/client.ts imports retry from ./retry.js, which src/retry.ts does not export at this step
        2 problem(s)

      Exits 1 when it reports a problem. An import that is neither relative nor
      under an --alias (e.g. --alias @/=src/) is a package and is not checked.
      --ignore skips specifiers a JavaScript regular expression matches (e.g.
      --ignore '\\$types$'). Both repeat.

  table <spec.json>
      Print the stack as a Markdown table: one row per step with its description,
      diff size and review state, then the total. The review state comes from
      files beside the spec. When <slug>.serve.log exists, the last of its
      "Review ready at <url>" and "Review complete" lines decides: the URL, or
      "completed (\`<slug>.review.xml\`)"; "not ready, see log" when it has
      neither. Without a log, "completed (...)" when <slug>.review.xml exists,
      else "not started".

Diff arguments, with their git diff meanings:

  (none)              the index to the working tree (unstaged changes); the
                      index is committed on HEAD as the stack's base
  --staged [<rev>]    <rev>, default HEAD, to the index (also --cached)
  <rev>               <rev> to the working tree
  <a>..<b>, <a> <b>   <a> to <b>
  <a>...<b>           the merge base of <a> and <b> to <b>
  --merge-base        start from the merge base of the revision and <b>, or HEAD
  -- <paths>          only changes under these paths; a positional that names
                      no revision is a path too, as in git

Options that select which paths or changes a diff contains are refused, since
the stack holds every change; name paths after -- instead: --diff-filter, -S,
-G, --pickaxe-all, --pickaxe-regex, --find-object, --relative, --skip-to,
--ignore-submodules, --ita-invisible-in-index and --ita-visible-in-index.
Every other option (-w, -U10, -M, ...) changes how a diff is shown: it stays
out of the stack and is passed through to each step's diff arguments, spelled
as given. Untracked files are not part of a git diff. Also refused: --no-index,
-R, more than two revisions, --cached with a range, --merge-base with no
revision, and output formats self-review cannot load (--stat, --name-only, ...).

The spec is a JSON file. "trailers" and "description" are optional; "files" are
paths from the repository root, as resolve prints them. Every changed path must
be in exactly one step, and no branch may exist under the prefix yet:

  {
    "diff_args": ["main...feature/retry"],
    "prefix": "retry-stack",
    "trailers": [],
    "steps": [
      {"slug": "01-design", "subject": "docs: add design notes",
       "description": "The design the code follows.", "files": ["docs/retry.md"]},
      {"slug": "02-retry", "subject": "feat: retry failed requests",
       "files": ["src/retry.ts", "src/client.ts"]}
    ]
  }

Exit status: 0 success, 1 refusal or error (reason on stderr) or problems found by
check-imports, 2 usage error, 3 resolve found no changes.`;

/** A command line the CLI cannot run: the reason, printed before the usage. */
class UsageError extends Error {}

/** `<spec.json> [--alias PREFIX=DIR]... [--ignore REGEX]...`, in any order. */
function parseCheckImports(args: readonly string[]): CheckImportsOptions {
  const specs: string[] = [];
  const aliases: CheckImportsOptions['aliases'] = [];
  const ignores: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const option = /^(--alias|--ignore)(?:=(.*))?$/s.exec(args[i]);
    if (!option) {
      if (args[i].startsWith('-')) throw new UsageError(`unknown option ${args[i]}`);
      specs.push(args[i]);
      continue;
    }
    const [, name, inline] = option;
    const value = inline ?? args[(i += 1)];
    if (value === undefined) throw new UsageError(`${name} needs a value`);
    if (name === '--ignore') {
      ignores.push(value);
      continue;
    }
    const separator = value.indexOf('=');
    if (separator < 1) throw new UsageError(`--alias needs PREFIX=DIR, got '${value}'`);
    aliases.push({ prefix: value.slice(0, separator), directory: value.slice(separator + 1) });
  }
  if (specs.length !== 1) throw new UsageError('check-imports takes one spec file');
  return { specFile: specs[0], aliases, ignores };
}

function main(argv: readonly string[]): number {
  const [command, ...args] = argv;
  try {
    if (command === 'resolve') return cmdResolve(args);
    if (command === 'build' && args.length === 1) return cmdBuild(args[0]);
    if (command === 'check-imports') return cmdCheckImports(parseCheckImports(args));
    if (command === 'table' && args.length === 1) return cmdTable(args[0]);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`stack.cjs ${command}: ${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    if (!(error instanceof StackError)) throw error;
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  const help = command === '-h' || command === '--help';
  (help ? process.stdout : process.stderr).write(`${USAGE}\n`);
  return help ? 0 : 2;
}

process.exitCode = main(process.argv.slice(2));
