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

// src/stack/build.ts
var path7 = __toESM(require("path"), 1);

// ../core/src/git-argument-text.ts
function needsQuoting(arg) {
  return arg.length === 0 || /[\s'"\\]/.test(arg);
}
function formatGitDiffArgs(args) {
  return args.map((arg) => needsQuoting(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg).join(" ");
}

// src/stack/git.ts
var import_child_process = require("child_process");
var import_fs = require("fs");
var import_os = require("os");
var path = __toESM(require("path"), 1);
var StackError = class extends Error {
};
var MAX_BUFFER = 1024 * 1024 * 1024;
function spawnGit(args, options, encoding) {
  const result = (0, import_child_process.spawnSync)("git", [...args], {
    encoding: encoding === "utf8" ? "utf8" : "buffer",
    env: options.env ? { ...process.env, ...options.env } : process.env,
    input: options.input,
    maxBuffer: MAX_BUFFER
  });
  if (result.error) throw new StackError(`cannot run git: ${result.error.message}`);
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr.toString()
  };
}
function tryGit(args, options = {}) {
  return spawnGit(args, options, "utf8");
}
function failure(args, stderr) {
  return new StackError(`git ${args.join(" ")} failed:
${stderr.trim()}`);
}
function git(args, options = {}) {
  const result = tryGit(args, options);
  if (result.status !== 0) throw failure(args, result.stderr);
  return result.stdout;
}
function gitBytes(args, options = {}) {
  const result = spawnGit(args, options, "buffer");
  if (result.status !== 0) throw failure(args, result.stderr);
  return result.stdout;
}
function gitValue(args, options = {}) {
  return git(args, options).trim();
}
function nulSplit(text) {
  return text.split("\0").filter((item) => item !== "");
}
function commitOrNull(rev) {
  const result = tryGit([
    "rev-parse",
    "--verify",
    "--quiet",
    "--end-of-options",
    `${rev}^{commit}`
  ]);
  return result.status === 0 ? result.stdout.trim() : null;
}
function commitOf(rev) {
  const sha = commitOrNull(rev);
  if (sha === null) throw new StackError(`${rev} does not name a commit`);
  return sha;
}
function treeOf(commit) {
  return gitValue(["rev-parse", `${commit}^{tree}`]);
}
function shortSha(sha) {
  return gitValue(["rev-parse", "--short", sha]);
}
function withTempDir(work) {
  const dir = (0, import_fs.mkdtempSync)(path.join((0, import_os.tmpdir)(), "self-review-stack-"));
  try {
    return work(dir);
  } finally {
    (0, import_fs.rmSync)(dir, { recursive: true, force: true });
  }
}

// src/stack/resolve.ts
var import_fs3 = require("fs");
var path6 = __toESM(require("path"), 1);

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
function findUnsupportedGitDiffOptions(args) {
  const offending = parseGitDiffArgs(args).options.filter((option) => {
    const output = gitDiffOptionPolicy(option.name).unsupportedOutput;
    return output === "always" || output === "attached" && option.arg.includes("=");
  });
  return [...new Set(offending.map((option) => option.index))].map((index) => args[index]);
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
var path4 = __toESM(require("path"), 1);

// ../core/src/bounded-read.ts
var import_fs2 = require("fs");
var import_util = require("util");

// ../core/src/local-loading-lifetime.ts
var import_promises3 = require("timers/promises");

// ../core/src/bounded-read.ts
var READ_FLAGS = import_fs2.constants.O_RDONLY | (import_fs2.constants.O_NONBLOCK ?? 0);
var readAsync = (0, import_util.promisify)(import_fs2.read);

// ../core/src/safe-fs-async.ts
var fs2 = __toESM(require("fs/promises"), 1);
var import_node_fs = require("fs");
var path3 = __toESM(require("path"), 1);
var import_node_crypto = require("crypto");

// ../core/src/safe-fs-read.ts
var fs = __toESM(require("fs/promises"), 1);
var import_promises4 = require("timers/promises");
var path2 = __toESM(require("path"), 1);
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

// src/stack/stats.ts
function shortstat(from, to, paths = []) {
  const text = gitValue([
    "-c",
    "diff.relative=false",
    "diff",
    "--shortstat",
    from,
    to,
    "--",
    ...paths
  ]);
  const count = (kind) => {
    const match = new RegExp(`(\\d+) ${kind}`).exec(text);
    return match ? Number(match[1]) : 0;
  };
  return { files: count("file"), insertions: count("insertion"), deletions: count("deletion") };
}
function diffstat({ files, insertions, deletions }) {
  return `${files} file${files === 1 ? "" : "s"} changed +${insertions} -${deletions}`;
}

// src/stack/resolve.ts
var STACK_OPTIONS = /* @__PURE__ */ new Set(["--staged", "--cached", "--merge-base"]);
var ROOT_PATHS = ["-c", "diff.relative=false"];
function isRevision(arg) {
  if (arg.includes("..") && !(0, import_fs3.existsSync)(arg)) return true;
  return commitOrNull(arg) !== null;
}
function classify(argv, parsed) {
  const end = parsed.separatorIndex ?? argv.length;
  const optionNames = /* @__PURE__ */ new Map();
  for (const option of parsed.options) {
    optionNames.set(option.index, [...optionNames.get(option.index) ?? [], option.name]);
  }
  const positionals = new Set(parsed.positionalIndices);
  const revisions = [];
  const paths = [];
  const pathIndices = /* @__PURE__ */ new Set();
  const passThrough = [];
  let keeping = false;
  for (let i = 0; i < end; i++) {
    const names = optionNames.get(i);
    if (positionals.has(i)) {
      keeping = false;
      if (isRevision(argv[i])) revisions.push(argv[i]);
      else {
        paths.push(argv[i]);
        pathIndices.add(i);
      }
    } else if (names !== void 0) {
      keeping = !names.some((name) => STACK_OPTIONS.has(name));
      if (keeping) passThrough.push(argv[i]);
    } else if (keeping) {
      passThrough.push(argv[i]);
    }
  }
  paths.push(...argv.slice(end + 1));
  const sidesArgv = argv.slice(0, end).filter((_, index) => !pathIndices.has(index));
  return { sidesArgv, revisions, paths, passThrough };
}
function refuseUnstackable(argv, parsed) {
  const names = new Set(parsed.options.map((option) => option.name));
  if (names.has("--no-index")) {
    throw new StackError(
      "--no-index compares files outside the repository; there is no history to stack on"
    );
  }
  if (names.has("-R")) {
    throw new StackError("-R reverses the diff; name the same diff in its forward direction");
  }
  const unsupported = findUnsupportedGitDiffOptions(argv);
  if (unsupported.length > 0) {
    throw new StackError(
      `${unsupported.join(" ")}: self-review cannot load this output format; leave it out`
    );
  }
}
function snapshot(worktree) {
  const realIndex = path6.resolve(gitValue(["rev-parse", "--git-path", "index"]));
  return withTempDir((dir) => {
    const copy = path6.join(dir, "index");
    if ((0, import_fs3.existsSync)(realIndex)) (0, import_fs3.copyFileSync)(realIndex, copy);
    const env = { GIT_INDEX_FILE: copy };
    if (worktree) {
      git(["-C", gitValue(["rev-parse", "--show-toplevel"]), "add", "--update"], { env });
    }
    const result = tryGit(["write-tree"], { env });
    if (result.status !== 0) {
      throw new StackError(`cannot snapshot the index:
${result.stderr.trim()}`);
    }
    return result.stdout.trim();
  });
}
function indexCommit() {
  const head = commitOf("HEAD");
  const tree = snapshot(false);
  if (tree === treeOf(head)) return head;
  return gitValue(["commit-tree", tree, "-p", head], {
    input: "The index this stack builds on\n"
  });
}
function mergeBase2(left, right) {
  const result = tryGit(["merge-base", commitOf(left), commitOf(right)]);
  if (result.status !== 0) throw new StackError(`${left} and ${right} have no merge base`);
  return result.stdout.trim();
}
function unstackableSide(side) {
  const reason = side.kind === "unknown" ? side.reason : `the ${side.kind} cannot be that side`;
  return new StackError(`cannot stack this diff: ${reason}`);
}
function resolveBase(side) {
  switch (side.kind) {
    case "revision":
      return commitOf(side.rev);
    case "merge-base":
      return mergeBase2(side.left, side.right);
    case "index":
      return indexCommit();
    default:
      throw unstackableSide(side);
  }
}
function resolveTarget(side) {
  switch (side.kind) {
    case "revision":
      return treeOf(commitOf(side.rev));
    case "index":
      return snapshot(false);
    case "working-tree":
      return snapshot(true);
    default:
      throw unstackableSide(side);
  }
}
function describeSide(side) {
  switch (side.kind) {
    case "revision":
      return side.rev;
    case "merge-base":
      return `the merge base of ${side.left} and ${side.right}`;
    case "index":
      return "the index";
    case "working-tree":
      return "the working tree";
    case "unknown":
      return side.reason;
  }
}
function resolveDiff(argv) {
  const parsed = parseGitDiffArgs(argv);
  refuseUnstackable(argv, parsed);
  const { sidesArgv, revisions, paths, passThrough } = classify(argv, parsed);
  if (revisions.length > 2) {
    throw new StackError(`at most two revisions bound a diff, got ${revisions.join(" ")}`);
  }
  const { oldSide, newSide } = describeGitDiffSides(sidesArgv);
  const base = resolveBase(oldSide);
  const target = resolveTarget(newSide);
  return {
    base,
    target,
    paths,
    passThrough,
    summary: `${describeSide(newSide)} against ${describeSide(oldSide)}`
  };
}
function changedPaths(base, target, paths) {
  const tokens = git([
    ...ROOT_PATHS,
    "diff",
    "--name-status",
    "--no-renames",
    "-z",
    base,
    target,
    "--",
    ...paths
  ]).split("\0");
  const changes = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    changes.push({ status: tokens[i], path: tokens[i + 1] });
  }
  return changes;
}
function rawDiff(base, target, paths = []) {
  return gitBytes([
    ...ROOT_PATHS,
    "diff",
    "--raw",
    "--no-renames",
    "--no-abbrev",
    "-z",
    base,
    target,
    "--",
    ...paths
  ]);
}
var NO_CHANGES = "No changes to stack.";
function cmdResolve(argv) {
  const { base, target, paths, passThrough, summary } = resolveDiff(argv);
  const changes = changedPaths(base, target, paths);
  if (changes.length === 0) {
    process.stdout.write(`${NO_CHANGES}
`);
    return 3;
  }
  const lines = [`base     ${base}`, `target   ${target}  (${summary})`];
  if (paths.length > 0) lines.push(`paths    ${formatGitDiffArgs(paths)}`);
  lines.push(`options  ${passThrough.length > 0 ? formatGitDiffArgs(passThrough) : "(none)"}`);
  lines.push(`diff     ${diffstat(shortstat(base, target, paths))}`);
  for (const change of changes) lines.push(`${change.status}	${change.path}`);
  process.stdout.write(`${lines.join("\n")}
`);
  return 0;
}

// src/stack/spec.ts
var import_fs4 = require("fs");
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}
function stepProblems(step, index) {
  const where = `steps[${index}]`;
  if (!isObject(step)) return [`${where} must be an object`];
  const problems = [];
  if (!isNonEmptyString(step.slug)) problems.push(`${where}: "slug" must be a non-empty string`);
  if (!isNonEmptyString(step.subject) || step.subject.includes("\n")) {
    problems.push(`${where}: "subject" must be a non-empty single line`);
  }
  if (step.description !== void 0 && typeof step.description !== "string") {
    problems.push(`${where}: "description" must be a string`);
  }
  if (!isStringArray(step.files) || step.files.length === 0) {
    problems.push(`${where}: "files" must be a non-empty array of paths`);
  }
  return problems;
}
function specProblems(spec, requireDiffArgs) {
  if (!isObject(spec)) return ["the spec must be a JSON object"];
  const problems = [];
  if (requireDiffArgs || spec.diff_args !== void 0) {
    if (!isStringArray(spec.diff_args)) problems.push('"diff_args" must be an array of strings');
  }
  if (!isNonEmptyString(spec.prefix)) problems.push('"prefix" must be a non-empty string');
  if (spec.trailers !== void 0 && !isStringArray(spec.trailers)) {
    problems.push('"trailers" must be an array of strings');
  }
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    problems.push('"steps" must be a non-empty array');
  } else {
    spec.steps.forEach((step, index) => problems.push(...stepProblems(step, index)));
  }
  return problems;
}
function loadSpec(file, options) {
  let parsed;
  try {
    parsed = JSON.parse((0, import_fs4.readFileSync)(file, "utf8"));
  } catch (error) {
    throw new StackError(`${file}: ${error.message}`);
  }
  const problems = specProblems(parsed, options.requireDiffArgs);
  if (problems.length > 0) throw new StackError(`${file}:
  ${problems.join("\n  ")}`);
  const json = parsed;
  return {
    diffArgs: json.diff_args ?? [],
    prefix: json.prefix,
    trailers: json.trailers ?? [],
    steps: json.steps.map((step) => ({
      slug: step.slug,
      subject: step.subject,
      description: step.description ?? "",
      files: step.files
    }))
  };
}
function branchName(spec, step) {
  return `${spec.prefix}/${step.slug}`;
}
function stackBase(spec) {
  return gitValue(["rev-parse", "--verify", `refs/heads/${branchName(spec, spec.steps[0])}^`]);
}

// src/stack/build.ts
function partitionProblems(spec, changes) {
  const problems = [];
  const slugs = /* @__PURE__ */ new Set();
  const owner = /* @__PURE__ */ new Map();
  for (const step of spec.steps) {
    if (slugs.has(step.slug)) problems.push(`slug '${step.slug}' is used twice`);
    slugs.add(step.slug);
    for (const file of step.files) {
      const previous = owner.get(file);
      if (previous !== void 0) problems.push(`${file}: in both ${previous} and ${step.slug}`);
      else if (!changes.has(file)) {
        problems.push(`${file}: in ${step.slug}, but the diff does not touch it`);
      }
      if (previous === void 0) owner.set(file, step.slug);
    }
  }
  for (const file of [...changes.keys()].sort()) {
    if (!owner.has(file)) problems.push(`${file}: changed, but in no step`);
  }
  return problems;
}
function branchNameProblems(spec) {
  const problems = [];
  const names = spec.steps.map((step) => branchName(spec, step));
  for (const name of new Set(names)) {
    if (tryGit(["check-ref-format", "--branch", name]).status !== 0) {
      problems.push(`'${name}' is not a valid branch name`);
    }
    const parent = names.find((other) => name.startsWith(`${other}/`));
    if (parent !== void 0)
      problems.push(`'${name}' cannot be a branch while '${parent}' is one`);
  }
  return problems;
}
function takenBranchProblems(spec) {
  const existing = git(["for-each-ref", "--format=%(refname)", "refs/heads/"]).split("\n").filter((ref) => ref !== "").map((ref) => ref.slice("refs/heads/".length));
  const under = existing.filter((name) => name === spec.prefix || name.startsWith(`${spec.prefix}/`));
  const problems = [];
  if (under.length > 0) {
    problems.push(`branches already exist under the prefix:
    ${under.join("\n    ")}`);
  }
  const names = spec.steps.map((step) => branchName(spec, step));
  for (const name of existing) {
    if (!under.includes(name) && names.some((branch) => branch.startsWith(`${name}/`))) {
      problems.push(`branch '${name}' exists, so no branch can be created under it`);
    }
  }
  return problems;
}
function treeEntries(tree) {
  const entries = /* @__PURE__ */ new Map();
  for (const line of nulSplit(git(["ls-tree", "-r", "-z", tree]))) {
    const tab = line.indexOf("	");
    const [mode, , oid] = line.slice(0, tab).split(" ");
    entries.set(line.slice(tab + 1), { mode, oid });
  }
  return entries;
}
function commitMessage(spec, step) {
  const trailers = spec.trailers.length > 0 ? `
${spec.trailers.join("\n")}
` : "";
  return `${step.subject}
${trailers}`;
}
function indexInfo(step, changes, entries, zero) {
  return step.files.map((file) => {
    if (changes.get(file) === "D") return `0 ${zero}	${file}\0`;
    const entry = entries.get(file);
    if (entry === void 0) throw new StackError(`${file}: not in the target tree`);
    return `${entry.mode} ${entry.oid}	${file}\0`;
  }).join("");
}
function buildCommits(spec, base, target, changes) {
  const entries = treeEntries(target);
  const zero = "0".repeat(base.length);
  return withTempDir((dir) => {
    const env = { GIT_INDEX_FILE: path7.join(dir, "index") };
    git(["read-tree", base], { env });
    let parent = base;
    return spec.steps.map((step) => {
      git(["update-index", "-z", "--index-info"], {
        env,
        input: indexInfo(step, changes, entries, zero)
      });
      const tree = gitValue(["write-tree"], { env });
      parent = gitValue(["commit-tree", tree, "-p", parent], {
        input: commitMessage(spec, step)
      });
      return { branch: branchName(spec, step), commit: parent, subject: step.subject };
    });
  });
}
function createBranches(steps) {
  git(["update-ref", "--stdin"], {
    input: steps.map((step) => `create refs/heads/${step.branch} ${step.commit}
`).join("")
  });
}
function report(spec, base, passThrough, summary, steps) {
  const baseShort = shortSha(base);
  const width = Math.max(...steps.map((step) => step.branch.length));
  const lines = [
    `Built ${steps.length} steps on ${baseShort} for \`${formatGitDiffArgs(["git", "diff", ...spec.diffArgs])}\`:`,
    ...steps.map(
      (step) => `  ${step.branch.padEnd(width)}  ${shortSha(step.commit)}  ${step.subject}`
    ),
    `The stack reproduces the diff: ${summary}.`,
    "Diff args for each step's guide and server:"
  ];
  let previous = baseShort;
  for (const step of steps) {
    lines.push(`  ${formatGitDiffArgs([...passThrough, `${previous}..${step.branch}`])}`);
    previous = step.branch;
  }
  return `${lines.join("\n")}
`;
}
function cmdBuild(specFile) {
  const spec = loadSpec(specFile, { requireDiffArgs: true });
  const { base, target, paths, passThrough, summary } = resolveDiff(spec.diffArgs);
  const changes = new Map(changedPaths(base, target, paths).map((c) => [c.path, c.status]));
  if (changes.size === 0) throw new StackError(NO_CHANGES);
  const problems = [
    ...partitionProblems(spec, changes),
    ...branchNameProblems(spec),
    ...takenBranchProblems(spec)
  ];
  if (problems.length > 0) throw new StackError(`refusing to build:
  ${problems.join("\n  ")}`);
  const steps = buildCommits(spec, base, target, changes);
  const top = steps[steps.length - 1].commit;
  if (!rawDiff(base, top).equals(rawDiff(base, target, paths))) {
    throw new StackError("the stack does not reproduce the diff; no branches were created");
  }
  createBranches(steps);
  process.stdout.write(report(spec, base, passThrough, summary, steps));
  return 0;
}

// src/stack/check-imports.ts
var path8 = __toESM(require("path"), 1);
var SOURCE = /\.(?:[cm]?[jt]sx?|svelte|vue)$/;
var FROM = /\b(?:import|export)\s+(?:type\s+)?([\p{L}\p{N}_$*{}\s,]*?)\s*from\s*(['"])([^'"\n]+)\2/gu;
var BARE = /\bimport\s*(?:\(\s*)?(['"])([^'"\n]+)\1/g;
var DECLARED = /\bexport\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function\*?|class|type|interface|enum|namespace)\s+([\p{L}\p{N}_$]+)/gu;
var LISTED = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g;
var STAR = /\bexport\s+\*\s+from\b/;
var EMITTED_JS = /\.[cm]?js$/;
var CANDIDATES = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".svelte",
  ".vue",
  ".d.ts",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/index.svelte"
];
function bracedNames(clause, side) {
  const match = /\{([^}]*)\}/.exec(clause);
  if (!match) return [];
  const names = [];
  for (let item of match[1].split(",")) {
    item = item.trim();
    if (item.startsWith("type ")) item = item.slice(5).trim();
    if (item === "") continue;
    const parts = item.split(" as ");
    names.push(parts[side === 0 ? 0 : parts.length - 1].trim());
  }
  return names;
}
function exportedNames(text) {
  const names = /* @__PURE__ */ new Set();
  for (const match of text.matchAll(DECLARED)) names.add(match[1]);
  for (const match of text.matchAll(LISTED)) {
    for (const name of bracedNames(`{${match[1]}}`, -1)) names.add(name);
  }
  return { names, hasStar: STAR.test(text) };
}
function normalize3(file) {
  const normal = path8.posix.normalize(file);
  return normal.length > 1 && normal.endsWith("/") ? normal.slice(0, -1) : normal;
}
function resolveImport(source, importer, aliases, tree) {
  let target;
  if (source.startsWith(".")) {
    target = normalize3(path8.posix.join(path8.posix.dirname(importer), source));
  } else {
    const alias = aliases.find((candidate) => source.startsWith(candidate.prefix));
    if (!alias) return { target: null, found: true };
    const directory = alias.directory.replace(/\/+$/, "");
    const rest = source.slice(alias.prefix.length);
    target = normalize3(directory === "" ? rest : `${directory}/${rest}`);
  }
  const stems = [target];
  if (EMITTED_JS.test(target)) stems.push(target.replace(EMITTED_JS, ""));
  for (const stem of stems) {
    for (const suffix of CANDIDATES) {
      if (tree.has(stem + suffix)) return { target: stem + suffix, found: true };
    }
  }
  return { target, found: false };
}
function compileIgnores(patterns) {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern);
    } catch (error) {
      throw new StackError(`--ignore ${pattern}: ${error.message}`);
    }
  });
}
function importsOf(text) {
  return [
    ...[...text.matchAll(FROM)].map((match) => ({ clause: match[1], source: match[3] })),
    ...[...text.matchAll(BARE)].map((match) => ({ clause: "", source: match[2] }))
  ];
}
function show(ref, file) {
  return git(["show", `${ref}:${file}`]);
}
function fileProblems(ref, file, tree, changed, aliases, ignores) {
  const problems = [];
  for (const { clause, source } of importsOf(show(ref, file))) {
    if (ignores.some((pattern) => pattern.test(source))) continue;
    const { target, found } = resolveImport(source, file, aliases, tree);
    if (!found) {
      problems.push(`${ref}: ${file} imports ${source}, which does not exist at this step`);
      continue;
    }
    if (target === null || !changed.has(target) || target.endsWith(".svelte")) continue;
    const wanted = bracedNames(clause, 0);
    if (wanted.length === 0) continue;
    const { names, hasStar } = exportedNames(show(ref, target));
    if (hasStar) continue;
    for (const name of wanted) {
      if (!names.has(name)) {
        problems.push(
          `${ref}: ${file} imports ${name} from ${source}, which ${target} does not export at this step`
        );
      }
    }
  }
  return problems;
}
function cmdCheckImports({ specFile, aliases, ignores }) {
  const patterns = compileIgnores(ignores);
  const spec = loadSpec(specFile, { requireDiffArgs: false });
  const base = stackBase(spec);
  const top = branchName(spec, spec.steps[spec.steps.length - 1]);
  const changed = new Set(changedPaths(base, top, []).map((change) => change.path));
  let problems = 0;
  for (const step of spec.steps) {
    const ref = branchName(spec, step);
    const tree = new Set(nulSplit(git(["ls-tree", "-r", "--full-tree", "--name-only", "-z", ref])));
    const files = [...changed].filter((file) => tree.has(file) && SOURCE.test(file)).sort();
    for (const file of files) {
      for (const line of fileProblems(ref, file, tree, changed, aliases, patterns)) {
        process.stdout.write(`${line}
`);
        problems += 1;
      }
    }
  }
  process.stdout.write(`${problems} problem(s)
`);
  return problems > 0 ? 1 : 0;
}

// src/stack/table.ts
var import_fs5 = require("fs");
var path9 = __toESM(require("path"), 1);
var SERVE_EVENT = /Review ready at (\S+)|Review complete/g;
function serveStatus(specDir, slug) {
  const completed = `completed (\`${slug}.review.xml\`)`;
  let log;
  try {
    log = (0, import_fs5.readFileSync)(path9.join(specDir, `${slug}.serve.log`), "utf8");
  } catch {
    return (0, import_fs5.existsSync)(path9.join(specDir, `${slug}.review.xml`)) ? completed : "not started";
  }
  const last = [...log.matchAll(SERVE_EVENT)].pop();
  if (last === void 0) return "not ready, see log";
  return last[1] ?? completed;
}
function cell(text) {
  return text.replace(/\|/g, "\\|").replace(/\s*\r?\n\s*/g, " ");
}
function cmdTable(specFile) {
  const spec = loadSpec(specFile, { requireDiffArgs: false });
  const specDir = path9.dirname(path9.resolve(specFile));
  const base = stackBase(spec);
  const rows = ["| # | Step | Description | Diff | Review URL |", "|---|---|---|---|---|"];
  let previous = base;
  spec.steps.forEach((step, index) => {
    const ref = branchName(spec, step);
    const size = diffstat(shortstat(previous, ref));
    const status = serveStatus(specDir, step.slug);
    rows.push(`| ${index + 1} | \`${ref}\` | ${cell(step.description)} | ${size} | ${status} |`);
    previous = ref;
  });
  rows.push(`| | **Total** | | **${diffstat(shortstat(base, previous))}** | |`);
  process.stdout.write(`${rows.join("\n")}
`);
  return 0;
}

// src/stack/cli.ts
var USAGE = `usage: stack.cjs resolve <git-diff-args...>
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
        M	src/retry.ts

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

Every other option (-w, -U10, -M, ...) changes how a diff is shown, not what
changed: it stays out of the stack and is passed through to each step's diff
arguments, spelled as given. Untracked files are not part of a git diff. Refused:
--no-index, -R, more than two revisions, --cached with a range, --merge-base with
no revision, and output formats self-review cannot load (--stat, --name-only, ...).

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
var UsageError = class extends Error {
};
function parseCheckImports(args) {
  const specs = [];
  const aliases = [];
  const ignores = [];
  for (let i = 0; i < args.length; i += 1) {
    const option = /^(--alias|--ignore)(?:=(.*))?$/s.exec(args[i]);
    if (!option) {
      if (args[i].startsWith("-")) throw new UsageError(`unknown option ${args[i]}`);
      specs.push(args[i]);
      continue;
    }
    const [, name, inline] = option;
    const value = inline ?? args[i += 1];
    if (value === void 0) throw new UsageError(`${name} needs a value`);
    if (name === "--ignore") {
      ignores.push(value);
      continue;
    }
    const separator = value.indexOf("=");
    if (separator < 1) throw new UsageError(`--alias needs PREFIX=DIR, got '${value}'`);
    aliases.push({ prefix: value.slice(0, separator), directory: value.slice(separator + 1) });
  }
  if (specs.length !== 1) throw new UsageError("check-imports takes one spec file");
  return { specFile: specs[0], aliases, ignores };
}
function main(argv) {
  const [command, ...args] = argv;
  try {
    if (command === "resolve") return cmdResolve(args);
    if (command === "build" && args.length === 1) return cmdBuild(args[0]);
    if (command === "check-imports") return cmdCheckImports(parseCheckImports(args));
    if (command === "table" && args.length === 1) return cmdTable(args[0]);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`stack.cjs ${command}: ${error.message}

${USAGE}
`);
      return 2;
    }
    if (!(error instanceof StackError)) throw error;
    process.stderr.write(`${error.message}
`);
    return 1;
  }
  const help = command === "-h" || command === "--help";
  (help ? process.stdout : process.stderr).write(`${USAGE}
`);
  return help ? 0 : 2;
}
process.exitCode = main(process.argv.slice(2));
