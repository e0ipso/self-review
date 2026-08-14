// Re-export from canonical source — see packages/core/src/git.ts
export {
  runGitDiff,
  getRepoRoot,
  validateGitAvailable,
  getRepoRootAsync,
  runGitDiffAsync,
  readGitBlobAsync,
  getUntrackedFilesAsync,
  generateUntrackedDiffs,
} from '../../packages/core/src/git';
