# @self-review/serve

Runs the [self-review](../../README.md) interface in your browser instead of an Electron window.
Useful when a desktop app is not an option: a remote box, a container, a machine with no display.

It is the same review engine (`@self-review/core`) and the same UI (`@self-review/react`) as the
desktop application. Only the transport differs: HTTP and a browser tab in place of IPC and a
window.

## Run it

```bash
npx @self-review/serve --staged
```

Or install it if you use it often:

```bash
npm install -g @self-review/serve
self-review-serve --staged
```

Anything that is not one of the flags below goes straight to `git diff`. With no arguments you
review the unstaged working tree. Outside a git repository, pass a directory or a file.

```bash
npx @self-review/serve                          # unstaged changes
npx @self-review/serve --staged
npx @self-review/serve main..feature-branch
npx @self-review/serve --resume-from review.xml # continue a previous review
```

| Flag | What it does |
| --- | --- |
| `-o, --output <file>` | Where to write the review. Defaults to `./review.xml`, or `output-file` from `.self-review.yaml` |
| `--resume-from <file>` | Load a previous review and carry its comments in |
| `-h, --help` | Print usage |
| `-v, --version` | Print the version |

## Run it from a checkout

If you have this repository cloned and want to try a change, one script from the repository root
builds and runs it. Arguments after `--` go to the program:

```bash
npm run start:serve -- --staged
npm run start:serve -- main..feature-branch -o /tmp/review.xml
```

That mirrors `npm start` for the desktop application, and takes a single `--` where the desktop
needs two. It always rebuilds first, which is a few seconds and is the point: `dist/` is not in
git, so running `dist/cli.js` on a fresh clone without building fails with
`ERR_MODULE_NOT_FOUND`. The build covers `@self-review/core` and `@self-review/react` as well as
the server and the browser bundle.

The build reviews whatever repository *this* checkout is, because npm runs the script from the
package root. To review a different repository, install the package and run `self-review-serve`
there.

To skip the rebuild when you know `dist/` is current, call it directly:

```bash
node packages/serve/dist/cli.js --staged
```

`npm run dev --workspace @self-review/serve` watches the server only. Changes to anything under
`src/client` need `npm run build:client --workspace @self-review/serve` to show up in the browser.

## What to expect

The URL goes to stderr when the process starts. Open it in a browser.

The output path is set once, when the process starts, by `-o` or by `output-file` in your config.
No route and no browser control changes it afterward.

Finishing the review writes that file and stops the process. The port closes with it, so there is
no second attempt: if you want to keep reviewing, start it again with `--resume-from`.

Closing the tab does nothing at all. Nothing is auto-saved and nothing is written until you
finish the review.

## Walkthrough guides

Guides work the same way they do in the desktop application. If a guide sidecar sits next to your
output path, `review.guide.xml` for the default `review.xml`, it is picked up when the process
starts and the file tree opens in guided mode. Generate one with the `self-review-guide` skill
before starting the server.

The guide is read once at startup. Writing a sidecar while the server is already running has no
effect until you restart it.

## Access control

The listener binds to `127.0.0.1` and there is no authentication. Anything on the same machine
that can reach the port can read your diff and finish the review on your behalf.

If you put a reverse proxy, tunnel, or port-forward in front of it, you are responsible for
access control. The program provides none.
