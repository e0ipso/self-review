#!/usr/bin/env node

/**
 * Script: create-feature-branch.cjs
 * Purpose: Create a git feature branch for a plan execution
 * Usage: node create-feature-branch.cjs <plan-id-or-path>
 *
 * Exit codes:
 *   0 = Success (branch created, already exists, or not on main/master)
 *   1 = Error (not git repo, uncommitted changes, plan not found)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolvePlan } = require('./shared-utils.cjs');

// Color functions for output
const _printError = message => {
  console.error(`ERROR: ${message}`);
};

const _printSuccess = message => {
  console.log(`✓ ${message}`);
};

const _printWarning = message => {
  console.log(`⚠ ${message}`);
};

const _printInfo = message => {
  console.log(message);
};

/**
 * Execute a git command and return the output
 * @param {string} command - Git command to execute
 * @returns {string|null} Command output or null on error
 */
const _execGit = command => {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (_error) {
    return null;
  }
};

/**
 * Check if current directory is inside a git repository
 * @returns {boolean}
 */
const _isGitRepo = () => {
  const result = _execGit('git rev-parse --is-inside-work-tree');
  return result === 'true';
};

/**
 * Get current git branch name
 * @returns {string|null}
 */
const _getCurrentBranch = () => {
  return _execGit('git rev-parse --abbrev-ref HEAD');
};

/**
 * Check if working tree has uncommitted changes
 * @returns {boolean}
 */
const _hasUncommittedChanges = () => {
  const status = _execGit('git status --porcelain');
  return status !== null && status.length > 0;
};

/**
 * Check if a branch exists locally or remotely
 * @param {string} branchName - Branch name to check
 * @returns {boolean}
 */
const _branchExists = branchName => {
  // Check local branches
  const localBranches = _execGit('git branch --list');
  if (
    localBranches &&
    localBranches
      .split('\n')
      .some(b => b.trim().replace('* ', '') === branchName)
  ) {
    return true;
  }

  // Check remote branches
  const remoteBranches = _execGit('git branch -r --list');
  if (
    remoteBranches &&
    remoteBranches.split('\n').some(b => b.trim().includes(branchName))
  ) {
    return true;
  }

  return false;
};

/**
 * Sanitize plan name for use in branch name
 * @param {string} planName - Original plan name from directory
 * @returns {string} Sanitized branch name segment
 */
const _sanitizeBranchName = planName => {
  return planName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 60); // Max 60 chars
};

/**
 * Extract plan name from plan directory
 * @param {string} planDir - Full path to plan directory
 * @returns {string} Plan name portion (e.g., "update-docs" from "58--update-docs")
 */
const _extractPlanName = planDir => {
  const dirName = path.basename(planDir);
  // Match pattern: {id}--{name}
  const match = dirName.match(/^\d+--(.+)$/);
  return match ? match[1] : dirName;
};

// Main function
const _main = (startPath = process.cwd()) => {
  // Check arguments
  if (process.argv.length < 3) {
    _printError('Missing plan ID argument');
    console.log('Usage: node create-feature-branch.cjs <plan-id-or-path>');
    console.log('Example: node create-feature-branch.cjs 58');
    process.exit(1);
  }

  const inputId = process.argv[2];

  // Step 1: Check if this is a git repository
  if (!_isGitRepo()) {
    _printError('Not a git repository');
    process.exit(1);
  }

  // Step 2: Resolve the plan
  const resolved = resolvePlan(inputId, startPath);

  if (!resolved) {
    _printError(`Plan "${inputId}" not found or invalid`);
    process.exit(1);
  }

  const { planDir, planId } = resolved;
  _printInfo(`Found plan: ${path.basename(planDir)}`);

  // Step 3: Check current branch
  const currentBranch = _getCurrentBranch();

  if (!currentBranch) {
    _printError('Could not determine current git branch');
    process.exit(1);
  }

  if (currentBranch !== 'main' && currentBranch !== 'master') {
    _printWarning(`Not on main/master branch (current: ${currentBranch})`);
    _printInfo('Proceeding without creating a new branch');
    process.exit(0);
  }

  // Step 4: Check for uncommitted changes
  if (_hasUncommittedChanges()) {
    _printError('Uncommitted changes detected in working tree');
    _printInfo(
      'Please commit or stash your changes before creating a feature branch'
    );
    process.exit(1);
  }

  // Step 5: Build branch name
  const planName = _extractPlanName(planDir);
  const sanitizedName = _sanitizeBranchName(planName);
  const branchName = `feature/${planId}--${sanitizedName}`;

  // Step 6: Check if branch already exists
  if (_branchExists(branchName)) {
    _printWarning(`Branch "${branchName}" already exists`);
    _printInfo('Proceeding with existing branch');
    process.exit(0);
  }

  // Step 7: Create and checkout the branch
  const createResult = _execGit(`git checkout -b "${branchName}"`);

  if (createResult === null) {
    _printError(`Failed to create branch "${branchName}"`);
    process.exit(1);
  }

  _printSuccess(`Created and switched to branch: ${branchName}`);
  process.exit(0);
};

// Run the script
if (require.main === module) {
  _main();
}

module.exports = {
  _main,
  _sanitizeBranchName,
  _extractPlanName,
};
