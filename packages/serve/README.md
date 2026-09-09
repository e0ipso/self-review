# @self-review/serve

The `self-review-serve` command: the [self-review](../../README.md) review UI, served over
loopback HTTP as an ordinary Node command instead of an Electron window. Same review engine
(`@self-review/core`), same UI (`@self-review/react`), a browser tab and a plain HTTP transport
in place of the desktop app and IPC.

## Install

```bash
npm install -g @self-review/serve
```

## Run

```bash
self-review-serve [options] [<git-diff-args>...]
```

Anything that isn't one of the flags below is passed straight through to `git diff`. With no
arguments, the unstaged working tree changes are reviewed; outside a git repository, pass a
directory or file to review instead.

```bash
self-review-serve                             # unstaged changes
self-review-serve --staged
self-review-serve main..feature-branch
self-review-serve --resume-from review.xml    # resume a previous review
```

Options:

| Flag | Description |
| --- | --- |
| `-o, --output <file>` | Write the review to `<file>` (default: `./review.xml`, or `output-file` from `.self-review.yaml`) |
| `--resume-from <file>` | Load a previous review XML file |
| `-h, --help` | Show the help message |
| `-v, --version` | Show the version number |

The URL is printed to stderr on start; open it in a browser. The output path is fixed by
`--output`/`-o` (or the configured `output-file`) at startup — there is no route and no browser
control that changes it. Completing the review writes that file and stops the process. Closing
the tab does nothing: nothing is auto-saved, and nothing is written until the review is
completed.

## Access control

The listener binds to `127.0.0.1` only, and there is no authentication. That is the whole of the
access-control story: anything on the same machine that can reach the port can read the diff and
complete the review. Do not expose the port beyond loopback — no reverse proxy, no tunnel, no
port-forward — without putting your own access control in front of it.
