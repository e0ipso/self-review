// Native defaults for the optional configuration effects boundary.
import { existsSync } from 'fs';
import { homedir } from 'os';
import { readFileWithinBudgetSync } from './bounded-read';
import type { ConfigEffects } from './config';

export const nativeConfigEffects: ConfigEffects = {
  exists: existsSync,
  read: readFileWithinBudgetSync,
  homeDir: homedir,
  cwd: () => process.cwd(),
};
