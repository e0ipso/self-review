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

`loadGuide(outputPath, config, diffPaths, options)` accepts `reader?: BoundedGuideReader` and
`reportDiagnostic`. The reader's `read(path, maxBytes, options?)` uses the existing
`BoundedReadResult` and bounded-read options. It receives `MAX_GUIDE_BYTES` and the operation's
signal, retains its receiver, and owns its opened handles through success, failure and cancellation.
A supplied reader owns every guide read. Missing or refused virtual input never triggers a native
retry. It must check regular-file metadata before reading, avoid blocking on FIFOs, bound allocation
and detect growth while reading. Core independently refuses an oversized returned buffer before
decoding or validation; it cannot undo allocation inside an adapter that violates the contract. The
default remains the native descriptor reader with regular-file checks, bounded growth detection and
cleanup. Missing guides stay silent, other read or validation failures return null with one warning,
and an aborted supplied signal propagates after the reader settles. XML/schema validation and
reconciliation apply equally to native and supplied bytes. Validation and individual adapter calls
in flight cannot be preempted.

`loadImage(session, path, options)` accepts a per-operation `reportDiagnostic`. Snapshot refusals
retain their existing error results and diagnostic text. Reporter throws and rejected promises are
ignored without replacing the read result. Membership, image-size and replaced-session refusals
retain their existing silent behavior; cancellation rejects without a diagnostic. The option does
not change captured versus legacy live read semantics. Neither option installs a global reporter.
Both operations and their option types are available from `@self-review/core/operations`, and the
original root functions remain supported. Hosts must pass their own reporter into each operation to
route these messages; callers that omit it retain stderr output.

## Startup path classification

`resolveStartupSourceAsync(argv, cwd, options)` accepts an optional `sourceProbe: StartupPathProbe`
alongside its existing git execution options. The probe's `stat(path)` returns metadata with
`isFile()` and `isDirectory()`, or null for an unavailable path. It receives the resolved first
positional path and retains its receiver. A supplied refusal or ordinary probe error uses the
existing git/directory/file/welcome classification rules without retrying native stat. Tracked files
still use git, untracked files use file mode, and a repository in cwd takes precedence over
directory mode. Option values never select a source.

The probe supplies classification only. Virtual content loading separately requires the filesystem
roles accepted by `loadLocalReview`. Omitting the probe retains native stat, and the original
synchronous APIs and call forms remain supported. Probe and git cancellation propagate instead of
becoming welcome mode. An aborted signal is checked before probing and after success or failure;
in-flight native or supplied work is joined before rejection. `timeoutMs` bounds git commands, not
stat or an arbitrary supplied probe. A promise or timer cannot preempt a native syscall.

`StartupSourceOptions`, `StartupPathProbe` and `StartupPathStats` are available through
`@self-review/core/operations`. Existing root imports remain supported.

## Comment ownership validation

Every comment's `filePath` must exactly match its containing file's `path`. The shared runtime and
serialization validator refuses inconsistent ownership with `ReviewXmlError` code `invalid-state`;
publication reports `validation-failed` before attachment preparation or staging. Diagnostics name
the field without echoing supplied path values. The empty review-level path, Unicode paths, renamed
and deleted files follow the same exact comparison. Paths are never rewritten to repair a mismatch.
Valid DTOs retain their reference aliases and extension metadata. Historical nullable omissions and
serialization's optional transient comment IDs keep their existing handling.

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

`readAssetFile`, `relocateAttachments` and `readContainedFile` accept an optional `readFs`
capability with the bounded read contract. Read-only adapters need no write, permission, ownership
or replacement methods. The original `fs?: FsLayer` option remains supported, including its optional
`asyncFs` and whole-file fallback. When both options are supplied, `readFs` takes precedence for
reads and relocation root resolution. Asset authorization, 10 MiB per-asset and 64 MiB aggregate
relocation limits are unchanged. Cancellation is checked across reads and close; no partial
attachment data is returned after cancellation.

`scanDirectory` and `scanFile` accept `scanFs?: ScanFsLayer`. This extends the bounded reader with
`stat`, `readlink` and `opendir`; directory handles provide async iteration and `close`.
`SourceReadFsLayer` is the smaller source-reader role, adding only `readlink` to the bounded reader.
The async synthetic diff and file loaders accept it as `readFs`. These contracts and the default
`nodeScanFsLayer` are exported from the root and filesystem entries. All root resolution,
enumeration, ancestor/link inspection, descriptor identity checks and content reads use the supplied
filesystem. Virtual paths never fall back to host filesystem reads. Adapters must supply Node-style
metadata, errno codes and canonical paths, and bounded descriptor reads over that same filesystem.

Ignored directories are pruned before opening. Scans retain deterministic file ordering, entry
budgets, no-follow containment and cleanup after early return, failure and cancellation. Directory
scans skip links; explicitly selected files still follow their leaf link, and synthetic git
additions retain link target text. The existing async scan signatures and synchronous synthetic APIs
remain. Native I/O calls in flight cannot be preempted, and portable name/identity checks cannot
eliminate all path replacement races. Callers own adapters; each operation owns and closes its
opened handles.

## Patch parsing and local additions

`parseDiff(rawDiff)` and `parseDiffWithDiagnostics(rawDiff)` remain synchronous. They use the same
parsing state machine as `parseDiffWithDiagnosticsAsync(rawDiff, { signal })`. The async entry
returns the same `{ files, diagnostics }` result and rejects cancellation with
`CommandCancelledError` instead of returning partial files. `loadGitDiffWithUntracked` awaits that
parser with its operation signal, so its desktop, serve and remote callers share the cooperative
path.

The async parser scans at most 64 Ki UTF-16 code units per chunk and yields after at most 256
complete lines or each chunk. Scanning yields even within a single long line. It avoids a complete
split-lines array, but retains the captured patch and resulting AST. Assembling and parsing one
complete line, regex matching, string decoding, allocation and garbage collection remain
synchronous. These checkpoints allow scheduled work and cancellation to progress; they provide no
hard CPU deadline or preemption of an individual string operation. The git capture budget still
applies before parsing.

`loadSyntheticFiles` and `loadSyntheticFilesAsync` construct additions directly from bounded source
reads. They share decoding, source classification, aggregate accounting and omission policy with
`generateSyntheticDiffs` and `generateSyntheticDiffsAsync`, which still return the textual patch
format. Structured loading avoids constructing a complete patch, splitting that patch and parsing
its headers back into files. It retains per-file UTF-8 decoding and source line allocation. Async
source reads yield between bounded reads and files. Projection uses one pure generator for both
synchronous and asynchronous consumers. The asynchronous consumer yields while counting each 64 KiB
of source bytes, before decoding or line allocation, and after emitting each 256 lines within one
file. UTF-8 decoding, a single line slice, patch joining, allocation and garbage collection still
run synchronously. Synchronous entry points retain synchronous execution.

The loaders preserve literal path ordering, no-follow reads, symlink target text, binary sniffing,
CR characters, BOMs, UTF-8 replacement, empty hunks and omission diagnostics. The existing text
format can report a blank separator after an empty file as a hunk-count diagnostic when another file
follows. Direct loading retains that diagnostic for compatibility. Ignore filtering and entry limits
stay with the calling scanner or git loader. Review publication and explicit Apply remain separate
operations.

Representation safety limits apply before line arrays, hunk objects and file objects grow, including
when payload thresholds are zero. The defaults are 100,000 line objects per file, 250,000 total line
objects, 10,000 file-header attempts or synthetic paths, and 50,000 total hunks. A context line is
one object; an addition and deletion are two. Empty hunks and metadata-only files consume their own
budgets. Patch diagnostic output retains at most 1,000 individual messages plus one stop summary,
and refuses individual patch diagnostics longer than 8,192 characters. These limits complement the
existing file, aggregate-read and git-output byte budgets.

`SourceBudgets` keeps its four original required fields. New `maxFileLines`, `maxTotalLines`,
`maxDiffFiles`, `maxDiffHunks` and `maxDiagnostics` fields are optional. `resolveSourceBudgets`
fills absent values with defaults. Limits must be nonnegative safe integers; zero refuses that kind
of representation. They are optional embedding/test controls, not YAML settings or CLI flags. All
three parsers accept an optional `{ budgets }` argument; the asynchronous parser also retains
`signal`. Existing calls and result shapes are unchanged. The legacy `parseDiff` result cannot carry
an aggregate diagnostic, so representation refusals throw `RangeError` instead of returning an
incomplete list. Ordinary malformed-input diagnostics remain discarded by that legacy API; use
`parseDiffWithDiagnostics` to inspect omitted content and aggregate stops without throwing. The
browser-safe source entry also exports `parseDiffWithDiagnostics` and the parser option/result
types.

A per-file refusal discards that file's entire hunk list and sets `omittedReason`, retaining its
path, change type and binary status. It never returns a truncated hunk as complete. The parser
reports the refusal and continues with the next file; aggregate exhaustion stops parsing and reports
that remaining input was not loaded. Synthetic projection lists omitted files without reading
further content after aggregate exhaustion, stopping with a diagnostic at the file limit. Unsafe
hunk coordinates and coordinate sums outside the safe integer range are refused explicitly.
Malformed headers and repeated empty hunks cannot bypass file, hunk or diagnostic accounting. Small
patches, source encodings and textual/direct projection semantics stay unchanged.

Tracked git and untracked additions share the retained file, hunk and line limits. Lazy delivery
returns the stored, already bounded hunks. Context expansion refuses an already omitted file, parses
cooperatively within the remaining review budget, and rechecks aggregate replacement after
concurrent reads. Refused expansion returns `null`, reports the reason and preserves existing hunks.
Source membership, snapshot selection and Apply authorization remain unchanged.

`readAttachment` forwards its existing optional signal through the bounded, authorized asset reader.
Aborting stops further chunks and closes the acquired handle, then rejects with the existing
`CommandCancelledError` contract. Origin and no-follow checks and read failure results are
unchanged.

These limits bound representation counts, not a universal memory or latency ceiling. Captured git
text, one decoded source buffer, path/header strings, patch output, retained ASTs and temporary
replacement representations still consume memory. Pure parser callers already own their input
string. Native I/O, regular expressions, string operations and GC cannot be preempted. Legacy
filesystem adapters retain the weaker guarantees documented above.

## Package entry point verification

After `npm run build --workspace @self-review/core`, run
`node --test scripts/test/core-entry-points.test.mjs` from the repository root. These checks
exercise ESM and CommonJS imports and ensure facade errors retain the root entry's class identity
and typed failure behavior. Generated shared chunks ship alongside each entry point in `dist`.

## Host-owned resume workers

`@self-review/core/resume-worker` shares one-shot ownership and reply validation between hosts. It
has no runtime Core, parser or filesystem dependencies. The host constructs the worker, supplies an
owned request ID and input path, and injects failure reconstruction using its own Core error
constructors. Parser byte and attachment budgets remain in the parser. Parsed metadata is retained.
Legacy failures need only a message, with optional code and details; name, stack and native read
cause diagnostics are additive. Unknown failure codes remain strings on this internal wire and do
not extend the installed peer's public error-code union.

Ownership includes admission, delivery and termination. Results settle only after termination; abort
listeners and the deadline stay active during termination, and freshness is checked again before
returning. Hosts must abort replaced operations and check ownership before adopting into session
state. Omitted or zero timeout uses 30,000 ms, positive fractions round up, and values above
2,147,483,647 clamp to that limit. Negative and nonfinite values reject after worker cleanup.

Cancellation retains the original abort reason, including falsy values. If termination rejects,
release is unconfirmed: a successful parse rejects with that termination error; an owned failure or
cancellation rejects with `ResumeWorkerTerminationError`, carrying the original reason as `cause`
and the cleanup rejection as `terminationError`. Listeners and timers are still removed. This does
not report cancellation as successfully releasing a potentially running worker. Native syscalls may
delay termination.

Hosts supporting older installed Core versions must bundle this subpath from their build input,
while retaining the runtime Core root as external. Serve does this with its `noExternal` binding, so
Core 2.0.4 needs no new export and its error classes keep their identity.

## Explicit loaded review capabilities

New local hosts carry `LoadedLocalReview.loadedReview` separately from the logical
`ReviewSourceIdentity`. `loadLocalReview`, `loadGitReviewSnapshot` and `prepareDirectoryReview`
issue this opaque `LoadedReview` capability after observing the source. Use
`commitLoadedReview(session, payload, loadedReview)` to retain it in a session, or
`readLoadedReviewContent(loadedReview, path, side, options)` for a direct captured read.
`loadedReviewIdentity` returns the original mutable identity alias; `loadedReviewPaths` returns a
membership copy. Copying that set cannot authorize additional reads. The original payload, identity,
fields and nested maps remain mutable. Changing identity after load makes captured reads refuse
until reload. Physical source drift also refuses; index reads use the captured blob OID even after
restaging. Expansion verifies both compared sides and index replacement before and after re-diff. No
source bytes, temporary source snapshots, Git objects, index entries or refs are written to capture
a local review. The handle owns no open descriptors and requires no disposal.

This capability is host-local. Do not put it in XML, IPC, HTTP, saved state or other transport data.
Spreading or serializing a handle does not create another usable capability. Keep the original
handle when copying logical metadata. Session previews and expansion consume it explicitly, and a
copied logical identity cannot replace the identity associated with a retained handle.

The original three-argument `commitDiffData`, synchronous identity functions, six-argument
`loadLocalReview` and live structural `readReviewedContent` calls remain supported. For
compatibility with captured callers predating this API, first-party loaders also attach
non-enumerable evidence to the exact original identity object. The old commit/read route retains its
captured guarantee only while that original object survives. A spread, clone or serialized logical
identity has no capture guarantee and retains legacy live descriptor reads. Supplying such an
identity to the old API does not assert capture. Use the explicit capability route whenever capture
is required. Hosts running actual published Core 2.0.4 must feature-detect `commitLoadedReview` and
retain their original commit/read, Apply, publication and resume paths. That peer has no explicit
capture capability and provides only its original live descriptor semantics. No new peer subpath is
needed.

`loadLocalReview` accepts an optional seventh `LocalReviewDependencies` argument. Its `scanFs` role
owns path canonicalization, enumeration, metadata and bounded bytes for directory/file loads.
`resolveLocalSourceIdentityAsync(options, paths, signal)` uses the supplied path role; the original
synchronous resolver keeps native behavior. Every provider method retains its receiver. Failed
canonicalization keeps lexical paths for the scanner's diagnostics and never calls native realpath
as a fallback. Source budgets and cancellation stay in the sixth options argument. Native defaults
use the existing scanners and filesystem roles.

Git hosts can supply `gitSnapshot` dependencies. Its bounded `readFs` supplies capture inspection;
`sourceFs`, or the loader's `readFs` option, supplies untracked content and link reads. The standard
loader refuses an untracked read if only a path role was supplied, rather than reading the host
filesystem. Injected loaders retain their own source effects. Captured context expansion also uses
the load's Git runner with the current operation's signal. A supplied text Git runner also needs
`snapshotRunner` for binary-safe blob reads; otherwise a captured blob read refuses. Selected
comparison paths bound index evidence; unrelated tracked entries never consume untracked entry
budgets.

Synthetic projection shares source accounting and text budgets, selects a patch or structured
emitter once, then formats diagnostics separately. Both public synchronous and asynchronous forms
retain their patch bytes, structured data, omission wording and ordering, and cancellation
checkpoints. `scripts/test/core-loaded-review.test.mjs` checks the additive capture API and the
legacy bridge through both built ESM and CommonJS root/operations aliases.

## Session Apply and attachment effects

Suggestion admission and current Apply reject unpaired UTF-16 surrogates in proposed code, which
UTF-8 encoding would otherwise replace silently. Direct Apply uses the existing write-failed refusal
and leaves the file unchanged. Valid surrogate pairs, explicit U+FFFD, literal source-code escapes
and other supported code units retain their original bytes.

Synchronous `applySuggestionForSession(session, request, options?)` and asynchronous
`applySuggestionForSessionAsync` share destination and final authorization checks. A selected
destination redirected into a disposable clone is refused. Replacing the review, changing its
identity or destination, or removing membership before the commit also refuses. The synchronous
operation additionally accepts `fs?: FsLayer` through its optional effects argument. That layer owns
all inspection, reads, staging and replacement, including legacy virtual descriptors without
`readSync`; native methods never supplement it. A supplied `destinationInspection` retains its
receiver. The async operation keeps its existing filesystem and inspection arguments and
cancellation behavior. Neither operation changes the original session identity or payload aliases.

These checks do not make portable rename a filesystem transaction. Another actor can still change
names after the final check. If a parent directory moves after staging, path-based cleanup cannot
rediscover the staged file in the moved directory. Ordinary failures remove staging, and a refusal
never claims a committed replacement. Legacy synchronous reads can allocate a whole file and block
until their adapter returns. Timers and promise races cannot interrupt that work.

`readAttachment(session, reference, options?)` accepts an optional `attachmentReader` with one
`readAssetFile(authorizedPath, { signal })` method, plus `reportDiagnostic`. The method retains its
receiver and returns the existing `AttachmentReadResult`. Authorization against recorded origins or
the current output asset directory always precedes provider access. Rejected references touch no
provider. A supplied reader is authoritative; errors and refusals never cause a native retry. It
must enforce no-follow ancestry and leaf opens, regular files and `MAX_IMAGE_BYTES` before
allocation, preserve passive bytes, close acquired resources and honor cancellation. Core checks
cancellation before invocation and after settlement. Calls already in progress cannot be preempted.
Reporter throws and rejected promises cannot replace results. Omitted options retain native reads,
stderr messages and typed results. Refusal diagnostics describe non-string inputs without traversing
objects or calling `toJSON`; string labels are limited to 512 input characters before escaping.

The attachment operation and its types are available from the focused operations entry point. Hosts
must pass effects explicitly. Actual published Core 2.0.4 predates these options and ignores them;
its native attachment, synchronous Apply, startup, resume and publication routes remain supported.
Passing options alone cannot supply a virtual reader to that historical peer. Hosts must select a
supported operation explicitly when requiring injected I/O; bundling effectful Core internals as a
supposed pure helper would duplicate acquisition and error ownership. Keep the installed Core root
and its error classes external. No minimum-version change is required for existing native hosts.

`runFetchComments` forwards `temporaryClones` to real materialization, with receiver binding and
cleanup ownership intact on success, failure and cancellation. `remote-mode` retains direct aliases
for `mergeRemoteThreads`, `applyRemoteProvenance` and `computeRemoteDrift`; their implementation is
pure policy in `remote-feedback`, independent of clone acquisition and disposal.
