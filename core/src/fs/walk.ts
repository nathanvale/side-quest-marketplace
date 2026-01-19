/**
 * Directory walking utilities for recursive file traversal.
 *
 * Provides a generic directory walker with filtering options to avoid
 * duplicating recursive traversal logic across modules.
 *
 * @module fs/walk
 */

import path from "node:path";
import { isDirectorySync, isFileSync, readDir } from "./index.js";

/**
 * Options for directory walking.
 */
export interface WalkDirectoryOptions {
	/**
	 * Directory names to skip during traversal.
	 * Common examples: ["node_modules", ".git", "dist"]
	 */
	readonly skipDirs?: ReadonlyArray<string>;

	/**
	 * Whether to skip hidden files/directories (starting with ".").
	 * Defaults to true.
	 */
	readonly skipHidden?: boolean;
}

/**
 * Callback function invoked for each file found during directory walk.
 *
 * @param fullPath - Absolute path to the file
 * @param relativePath - Path relative to the root directory
 * @param entry - Filename (basename)
 */
export type FileVisitor = (
	fullPath: string,
	relativePath: string,
	entry: string,
) => void;

/**
 * Recursively walks a directory tree and calls a visitor function for each file.
 *
 * This utility prevents code duplication across modules that need recursive
 * directory traversal. It handles:
 * - Skipping hidden files/directories (configurable)
 * - Skipping specified directories (e.g., node_modules)
 * - Error handling for unreadable directories
 *
 * @param rootDir - Absolute path to the root directory to walk
 * @param onFile - Callback function called for each file found
 * @param options - Walk options (skipDirs, skipHidden)
 *
 * @example
 * ```typescript
 * const markdownFiles: string[] = [];
 * walkDirectory('/vault', (fullPath, relativePath, entry) => {
 *   if (entry.endsWith('.md')) {
 *     markdownFiles.push(relativePath);
 *   }
 * }, { skipDirs: ['Attachments', '.obsidian'] });
 * ```
 *
 * @example
 * ```typescript
 * // Count all files by extension
 * const extensions = new Map<string, number>();
 * walkDirectory(process.cwd(), (_, __, filename) => {
 *   const ext = path.extname(filename);
 *   extensions.set(ext, (extensions.get(ext) || 0) + 1);
 * }, { skipHidden: true, skipDirs: ['node_modules', 'dist'] });
 * ```
 */
export function walkDirectory(
	rootDir: string,
	onFile: FileVisitor,
	options: WalkDirectoryOptions = {},
): void {
	const { skipDirs = [], skipHidden = true } = options;
	const skipDirSet = new Set(skipDirs);

	function walk(currentDir: string): void {
		try {
			for (const entry of readDir(currentDir)) {
				// Skip hidden files/folders if configured
				if (skipHidden && entry.startsWith(".")) continue;

				// Skip specified directories
				if (skipDirSet.has(entry)) continue;

				const fullPath = path.join(currentDir, entry);
				if (isDirectorySync(fullPath)) {
					walk(fullPath);
				} else if (isFileSync(fullPath)) {
					const relativePath = path.relative(rootDir, fullPath);
					onFile(fullPath, relativePath, entry);
				}
			}
		} catch {
			// Skip directories we can't read (permission issues, etc.)
		}
	}

	walk(rootDir);
}
