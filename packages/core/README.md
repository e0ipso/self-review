# @self-review/core

Node-only review operations shared by the desktop and HTTP hosts. Importing the package does not
start a review, install signal handlers or print diagnostics. Shared data types come from the
runtime-free `@self-review/types` package.

## Supported entry points

- `@self-review/core/operations` provides configuration, startup, review-session, publication,
  scanning and remote-fetch operations for hosts. It excludes concrete filesystem adapters and
  low-level replacement policy. A host can load a source, commit it into a session, then publish the
  submitted review through `publishReview`.
- `@self-review/core/filesystem` provides advanced read and write adapter contracts, no-follow
  operations, and legacy synchronous adapter compatibility for hosts implementing a filesystem.
- `@self-review/core` retains every existing export and call form. Existing imports need no
  migration. More specialized operations, parsers, providers and infrastructure remain supported
  there; the smaller entry points help new consumers choose only their role's contracts.

All entry points ship ESM, CommonJS, and declarations for both module systems. These are additive
exports with no version, dependency or minimum-version change.

```ts
import { loadConfigWithProvenance, runFetchComments } from '@self-review/core/operations';

const reportDiagnostic = (message: string) => diagnostics.push(message);
const diagnostics: string[] = [];
const controller = new AbortController();
const loaded = loadConfigWithProvenance({ cwd: '/project', reportDiagnostic });
await runFetchComments('https://github.com/owner/repo/pull/7', {
  cwd: '/project',
  reportDiagnostic,
  signal: controller.signal,
});
```

`runFetchComments` sends its progress, configuration warnings, remote loading and materialization
messages to the supplied per-call `reportDiagnostic`. With no reporter, the existing text goes to
stderr and stdout stays unused. Failure still rejects for the host to present. Cleanup finishes
before the operation settles. Reporters must not throw. Cleanup diagnostics cannot interrupt
resource release even if a reporter throws. Injected dependencies must honor the reporter passed in
their options; an independently printing injected dependency is outside this guarantee.

`scanDirectory` and `scanFile` accept the same optional reporter and retain their returned payload
diagnostics. `loadLocalReview` routes scanner messages through its existing `log` callback as well
as reporting payload diagnostics. Hosts calling scanners directly can pass their own reporter. Each
operation owns its reporter; there is no mutable global reporting setting.

## Payload threshold validation

`max-files` and `max-total-lines` accept finite numeric values from zero through
`Number.MAX_SAFE_INTEGER`. Zero disables that dimension. Finite fractions retain their existing
comparison semantics because the configuration contract does not require integer thresholds.
Nonfinite, negative, unsafe and nonnumeric YAML values produce a warning and leave the inherited
user value or default in place. Rejected values do not acquire project provenance. Other config keys
and project-over-user-over-default precedence are unchanged.

## Read capabilities and compatibility

`AsyncReadHandle` requires only `stat`, `read` and `close`. `AsyncReadFsLayer` requires only `open`,
`lstat` and `realpath`. `readContainedFileAsync` accepts this read-only role. The
`openContainedFileAsync` overload preserves the exact supplied handle type, so existing
`AsyncFsLayer` callers still receive `AsyncFileHandle` with every write and ownership method.
Default callers also retain that full handle type and own its close.

`readContainedFileBounded` requires `BoundedAsyncReadFsLayer`, which explicitly promises that each
read copies at most the requested chunk without allocating the entire file. The native
`nodeReadFsLayer` provides it. Reads check descriptor size, allocate within the byte budget plus one
sentinel byte, copy chunks of at most 64 KiB, detect growth and close on all outcomes. Both read
entry points share the same containment, no-follow and descriptor identity policy.

`boundedReadFsFromSync` accepts a read-only `SyncReadFsLayer` with required descriptor `readSync`.
It uses only the supplied filesystem, including virtual descriptors. It yields before each chunk and
checks cancellation, but a synchronous call in progress cannot be preempted. The bounded allocation
promise does not imply an interruptible syscall.

`asyncFsFromSync` remains available at its original source-module export and the new filesystem
entry point. It preserves all `FsLayer` and `AsyncFsLayer` methods, including virtual descriptors.
It is a legacy compatibility adapter, not a bounded-read capability. Without `readSync`, its
`readFileSync` fallback allocates the whole file once. Size checks before and after that call cannot
bound allocation or interrupt the call. Existing adapters remain supported; no new refusal or
error/outcome-union member is introduced. A supplied `asyncFs` implementation retains precedence.
