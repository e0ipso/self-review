// src/main/directory-scanner.ts
// Recursively scans a directory and produces DiffFile[] treating all files as new additions.

import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { DiffFile } from '../shared/types';
import { generateSyntheticDiffs } from './synthetic-diff';
import { parseDiff } from './diff-parser';

/**
 * Recursively scan a directory and return DiffFile[] with every file
 * treated as a new addition (changeType: 'added').
 *
 * @param directoryPath - Absolute path to the directory to scan
 * @returns Parsed DiffFile array for all files in the directory
 */
export async function scanDirectory(
  directoryPath: string
): Promise<DiffFile[]> {
  // Verify the path is a directory
  try {
    const dirStat = await stat(directoryPath);
    if (!dirStat.isDirectory()) {
      console.error(
        `Error: "${directoryPath}" is not a directory`
      );
      return [];
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Error accessing directory "${directoryPath}": ${error.message}`
      );
    } else {
      console.error(
        `Error accessing directory "${directoryPath}": unknown error`
      );
    }
    return [];
  }

  const filePaths: string[] = [];

  try {
    const entries = await readdir(directoryPath, {
      recursive: true,
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      // Build the full path from the entry's parentPath (or path) and name
      const parentDir = entry.parentPath ?? entry.path;
      const fullPath = join(parentDir, entry.name);
      const relativePath = relative(directoryPath, fullPath);
      filePaths.push(relativePath);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Error reading directory "${directoryPath}": ${error.message}`
      );
    } else {
      console.error(
        `Error reading directory "${directoryPath}": unknown error`
      );
    }
    return [];
  }

  // Sort for deterministic output
  filePaths.sort();

  if (filePaths.length === 0) {
    return [];
  }

  const diffText = generateSyntheticDiffs(filePaths, directoryPath);
  return parseDiff(diffText);
}
