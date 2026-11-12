// The temporary clone owner supplies creation and both lifetime-specific removal operations.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Owns only the directory it creates. Removal is mandatory even after cancellation. */
export interface TemporaryCloneStorage {
  create(): Promise<string>;
  remove(directory: string): Promise<void>;
  removeSync(directory: string): void;
}

export const nodeTemporaryCloneStorage: TemporaryCloneStorage = {
  create: () => fs.promises.mkdtemp(path.join(os.tmpdir(), 'self-review-')),
  remove: directory => fs.promises.rm(directory, { recursive: true, force: true }),
  removeSync: directory => fs.rmSync(directory, { recursive: true, force: true }),
};
