import { stripGitRepoEnv } from '../core/src/test-support/git-env';

// Git hands hook processes a GIT_DIR and GIT_INDEX_FILE pointing at the
// repository the hook is running in, and every git this suite spawns —
// directly or through the bundled helper — would inherit them and act on
// that repository instead of on its own temp directory (SR-0055).
stripGitRepoEnv();
