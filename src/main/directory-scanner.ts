// src/main/directory-scanner.ts
// Recursively scans a directory and produces DiffFile[] treating all files as new additions.

import { readdir, stat } from 'fs/promises';
import { join, relative, basename, dirname } from 'path';
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

/**
 * Scan a single file and return DiffFile[] with the file treated as a new addition.
 *
 * @param filePath - Absolute path to the file to scan
 * @returns Parsed DiffFile array (single element)
 */
export async function scanFile(filePath: string): Promise<DiffFile[]> {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      console.error(`Error: "${filePath}" is not a file`);
      return [];
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error accessing file "${filePath}": ${error.message}`);
    } else {
      console.error(`Error accessing file "${filePath}": unknown error`);
    }
    return [];
  }

  const fileName = basename(filePath);
  const rootDir = dirname(filePath);
  const diffText = generateSyntheticDiffs([fileName], rootDir);
  return parseDiff(diffText);
}
