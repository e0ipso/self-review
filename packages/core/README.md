# @self-review/core

Node-only review loading and publication logic shared by the desktop app and HTTP CLI. Shared review
types live in `@self-review/types` and have no runtime dependencies.

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
source reads yield between bounded reads and files; projecting one bounded source file remains
synchronous.

The loaders preserve literal path ordering, no-follow reads, symlink target text, binary sniffing,
CR characters, BOMs, UTF-8 replacement, empty hunks and omission diagnostics. The existing text
format can report a blank separator after an empty file as a hunk-count diagnostic when another file
follows. Direct loading retains that diagnostic for compatibility. Ignore filtering and entry limits
stay with the calling scanner or git loader. Review publication and explicit Apply remain separate
operations.
