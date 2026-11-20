#!/usr/bin/env node
// Generated from packages/skill-scripts/src/stack; do not edit.
// Rebuild with npm run build:skills --workspace @self-review/skill-scripts
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../core/src/git-option-policy.ts
var OPTION_POLICY = {
  "--output": { value: "required", writeCapable: true, unsupportedOutput: "always" },
  "--ext-diff": { writeCapable: true },
  "--textconv": { writeCapable: true },
  "--src-prefix": { value: "required" },
  "--dst-prefix": { value: "required" },
  "--line-prefix": { value: "required", unsupportedOutput: "always" },
  "--output-indicator-new": { value: "required", unsupportedOutput: "always" },
  "--output-indicator-old": { value: "required", unsupportedOutput: "always" },
  "--output-indicator-context": { value: "required", unsupportedOutput: "always" },
  "--inter-hunk-context": { value: "required" },
  // Preserve the existing warning policy for these attached stat parameters.
  "--stat-width": { value: "required", unsupportedOutput: "attached" },
  "--stat-name-width": { value: "required", unsupportedOutput: "attached" },
  "--stat-graph-width": { value: "required", unsupportedOutput: "attached" },
  "--stat-count": { value: "required", unsupportedOutput: "attached" },
  "--diff-algorithm": { value: "required" },
  "--word-diff-regex": { value: "required", unsupportedOutput: "always" },
  "--ignore-matching-lines": { value: "required" },
  "--anchored": { value: "required" },
  "--diff-filter": { value: "required" },
  "--find-object": { value: "required" },
  "--rotate-to": { value: "required", rediff: "drop" },
  "--skip-to": { value: "required", rediff: "drop" },
  "--ws-error-highlight": { value: "required" },
  "--color-moved-ws": { value: "required", unsupportedOutput: "always" },
  "-S": { value: "required" },
  "-G": { value: "required" },
  "-O": { value: "required", rediff: "drop" },
  "-I": { value: "required" },
  "-l": { value: "required" },
  "-U": { value: "attached", rediff: "drop" },
  "-B": { value: "attached" },
  "-M": { value: "attached" },
  "-C": { value: "attached" },
  "-W": { rediff: "drop" },
  "--unified": { value: "attached", rediff: "drop" },
  "--function-context": { rediff: "drop" },
  "--no-function-context": { rediff: "drop" },
  "--relative": { value: "attached", rediff: "relative" },
  "--no-relative": { rediff: "relative" },
  "--stat": { value: "attached", unsupportedOutput: "always" },
  "--numstat": { unsupportedOutput: "always" },
  "--shortstat": { unsupportedOutput: "always" },
  "--dirstat": { value: "attached", unsupportedOutput: "always" },
  "--dirstat-by-file": { value: "attached", unsupportedOutput: "always" },
  "--cumulative": { unsupportedOutput: "always" },
  "--summary": { unsupportedOutput: "always" },
  "--name-only": { unsupportedOutput: "always" },
  "--name-status": { unsupportedOutput: "always" },
  "--raw": { unsupportedOutput: "always" },
  "--patch-with-stat": { unsupportedOutput: "always" },
  "--patch-with-raw": { unsupportedOutput: "always" },
  "--compact-summary": { unsupportedOutput: "always" },
  "--word-diff": { value: "attached", unsupportedOutput: "always" },
  "--color-words": { value: "attached", unsupportedOutput: "always" },
  "--color-moved": { value: "attached", unsupportedOutput: "always" },
  "--no-patch": { unsupportedOutput: "always" },
  "-s": { unsupportedOutput: "always" },
  "--exit-code": { unsupportedOutput: "always" },
  "--quiet": { unsupportedOutput: "always" },
  "--check": { unsupportedOutput: "always" }
};
function gitDiffOptionPolicy(name) {
  return Object.prototype.hasOwnProperty.call(OPTION_POLICY, name) ? OPTION_POLICY[name] : {};
}

// ../core/src/git-argument-policy.ts
function consumesNextArgument(arg) {
  if (arg.startsWith("--")) return gitDiffOptionPolicy(arg).value === "required";
  if (!arg.startsWith("-")) return false;
  for (let i = 1; i < arg.length; i++) {
    if (gitDiffOptionPolicy(`-${arg[i]}`).value === "required") return i === arg.length - 1;
    if (gitDiffOptionPolicy(`-${arg[i]}`).value === "attached") return false;
  }
  return false;
}
function parseGitDiffArgs(args) {
  const options = [];
  const positionalIndices = [];
  let separatorIndex = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (separatorIndex !== null) {
      positionalIndices.push(i);
    } else if (arg === "--") {
      separatorIndex = i;
    } else if (arg.startsWith("--")) {
      const equals = arg.indexOf("=");
      const option = {
        index: i,
        arg,
        name: equals < 0 ? arg : arg.slice(0, equals)
      };
      if (equals >= 0) option.value = arg.slice(equals + 1);
      else if (consumesNextArgument(arg) && i + 1 < args.length) {
        option.value = args[++i];
      }
      options.push(option);
    } else if (arg.startsWith("-")) {
      for (let j = 1; j < arg.length; j++) {
        const name = arg[j];
        const option = { index: i, arg, name: `-${name}` };
        options.push(option);
        if (gitDiffOptionPolicy(`-${name}`).value === "required" || gitDiffOptionPolicy(`-${name}`).value === "attached") {
          if (j + 1 < arg.length) option.value = arg.slice(j + 1);
          else if (gitDiffOptionPolicy(`-${name}`).value === "required" && i + 1 < args.length) {
            option.value = args[++i];
          }
          break;
        }
      }
    } else {
      positionalIndices.push(i);
    }
  }
  return { options, positionalIndices, separatorIndex };
}

// ../core/src/process-tree.ts
var import_node_child_process = require("child_process");
var import_promises = require("fs/promises");
var import_promises2 = require("timers/promises");

// ../core/src/command-runner.ts
var MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

// ../core/src/input-budgets.ts
var KIB = 1024;
var MIB = 1024 * KIB;
var MAX_SOURCE_ENTRIES = 5e4;
var BINARY_SNIFF_BYTES = 8 * KIB;
var MAX_SOURCE_FILE_BYTES = 5 * MIB;
var MAX_SOURCE_TOTAL_BYTES = 64 * MIB;
var MAX_GIT_DIFF_OUTPUT_BYTES = 50 * MIB;
var MAX_GUIDE_BYTES = 1 * MIB;
var MAX_RESUME_XML_BYTES = 16 * MIB;
var MAX_PUBLICATION_ASSET_BYTES = 64 * MIB;
var MAX_IMAGE_BYTES = 10 * MIB;
var MAX_SOURCE_FILE_LINES = 1e5;
var MAX_SOURCE_TOTAL_LINES = 25e4;
var MAX_DIFF_FILES = 1e4;
var MAX_DIFF_HUNKS = 5e4;
var MAX_DIFF_DIAGNOSTICS = 1e3;
var MAX_DIFF_DIAGNOSTIC_CHARS = 8 * KIB;
var DEFAULT_SOURCE_BUDGETS = Object.freeze({
  maxEntries: MAX_SOURCE_ENTRIES,
  maxFileBytes: MAX_SOURCE_FILE_BYTES,
  maxTotalBytes: MAX_SOURCE_TOTAL_BYTES,
  maxGitDiffOutputBytes: MAX_GIT_DIFF_OUTPUT_BYTES,
  maxFileLines: MAX_SOURCE_FILE_LINES,
  maxTotalLines: MAX_SOURCE_TOTAL_LINES,
  maxDiffFiles: MAX_DIFF_FILES,
  maxDiffHunks: MAX_DIFF_HUNKS,
  maxDiagnostics: MAX_DIFF_DIAGNOSTICS
});

// ../core/src/safe-fs.ts
var nodeFs = __toESM(require("fs"), 1);
var import_node_crypto2 = require("crypto");
var path3 = __toESM(require("path"), 1);

// ../core/src/bounded-read.ts
var import_fs = require("fs");
var import_util = require("util");

// ../core/src/local-loading-lifetime.ts
var import_promises3 = require("timers/promises");

// ../core/src/bounded-read.ts
var READ_FLAGS = import_fs.constants.O_RDONLY | (import_fs.constants.O_NONBLOCK ?? 0);
var readAsync = (0, import_util.promisify)(import_fs.read);

// ../core/src/safe-fs-async.ts
var fs2 = __toESM(require("fs/promises"), 1);
var import_node_fs = require("fs");
var path2 = __toESM(require("path"), 1);
var import_node_crypto = require("crypto");

// ../core/src/safe-fs-read.ts
var fs = __toESM(require("fs/promises"), 1);
var import_promises4 = require("timers/promises");
var path = __toESM(require("path"), 1);
var nodeReadFsLayer = {
  readAllocation: "bounded",
  open: (target, flags, mode) => fs.open(target, flags, mode),
  lstat: (target) => fs.lstat(target),
  realpath: (target) => fs.realpath(target)
};

// ../core/src/safe-fs-legacy.ts
var import_promises5 = require("timers/promises");

// ../core/src/safe-fs.ts
var { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW, O_RDONLY } = nodeFs.constants;

// ../core/src/node-scan-fs.ts
var import_promises6 = require("fs/promises");
var nodeScanFsLayer = {
  ...nodeReadFsLayer,
  stat: (target) => (0, import_promises6.stat)(target),
  opendir: (target) => (0, import_promises6.opendir)(target),
  readlink: (target) => (0, import_promises6.readlink)(target, { encoding: "buffer" })
};

// ../core/src/loaded-snapshot.ts
var import_node_path = __toESM(require("path"), 1);

// ../core/src/source-identity.ts
var WORKING_TREE = { kind: "working-tree" };
var INDEX = { kind: "index" };
var HEAD = { kind: "revision", rev: "HEAD", implicit: true };
function revision(rev) {
  return rev === "" ? HEAD : { kind: "revision", rev, implicit: false };
}
function mergeBase(left, right) {
  return { kind: "merge-base", left: left || "HEAD", right: right || "HEAD" };
}
function unknownSides(reason) {
  return { oldSide: { kind: "unknown", reason }, newSide: { kind: "unknown", reason } };
}
function describeGitDiffSides(argv) {
  const parsed = parseGitDiffArgs(argv);
  const names = new Set(parsed.options.map((option) => option.name));
  if (names.has("--no-index")) return unknownSides("--no-index compares paths, not snapshots");
  const revs = parsed.positionalIndices.filter((index) => parsed.separatorIndex === null || index < parsed.separatorIndex).map((index) => argv[index]);
  const cached = names.has("--cached") || names.has("--staged");
  const reverse = names.has("-R");
  const useMergeBase = names.has("--merge-base");
  const sides = describeRevisionSides(revs, cached, useMergeBase);
  return reverse ? { oldSide: sides.newSide, newSide: sides.oldSide } : sides;
}
function describeRevisionSides(revs, cached, useMergeBase) {
  if (revs.length === 0) {
    if (useMergeBase) return unknownSides("--merge-base requires a revision");
    return cached ? { oldSide: HEAD, newSide: INDEX } : { oldSide: INDEX, newSide: WORKING_TREE };
  }
  if (revs.length === 1) {
    const rev = revs[0];
    const symmetric = rev.indexOf("...");
    if (symmetric !== -1) {
      if (cached) return unknownSides("--cached does not accept a revision range");
      const left = rev.slice(0, symmetric);
      const right = rev.slice(symmetric + 3);
      return { oldSide: mergeBase(left, right), newSide: revision(right) };
    }
    const range = rev.indexOf("..");
    if (range !== -1) {
      if (cached) return unknownSides("--cached does not accept a revision range");
      return { oldSide: revision(rev.slice(0, range)), newSide: revision(rev.slice(range + 2)) };
    }
    const oldSide = useMergeBase ? mergeBase(rev, "HEAD") : revision(rev);
    return { oldSide, newSide: cached ? INDEX : WORKING_TREE };
  }
  if (revs.length === 2) {
    if (cached) return unknownSides("--cached does not accept two revisions");
    const [left, right] = revs;
    return {
      oldSide: useMergeBase ? mergeBase(left, right) : revision(left),
      newSide: revision(right)
    };
  }
  return unknownSides(`a combined diff of ${revs.length} revisions has no single old side`);
}

// src/stack/cli.ts
var USAGE = "usage: stack.cjs resolve <git-diff-args...>";
function resolve(args) {
  const { oldSide, newSide } = describeGitDiffSides(args);
  process.stdout.write(`old: ${oldSide.kind}
new: ${newSide.kind}
`);
  return 0;
}
function main(argv) {
  const [subcommand, ...args] = argv;
  switch (subcommand) {
    case "resolve":
      return resolve(args);
    default:
      process.stderr.write(`${USAGE}
`);
      return 2;
  }
}
process.exitCode = main(process.argv.slice(2));
