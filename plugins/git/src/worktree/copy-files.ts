/**
 * File copy engine for worktree creation.
 *
 * Copies gitignored files from the main worktree to a new worktree based on
 * glob patterns from `.worktrees.json`. Handles two modes:
 *
 * - **Root patterns** (e.g., `.env`, `.env.*`): matched at the repo root only
 * - **Recursive patterns** (e.g., `** /CLAUDE.md`): matched throughout the tree,
 *   preserving directory structure
 *
 * @module worktree/copy-files
 */

import fs from "node:fs";
import path from "node:path";
import {
	copyFileSync,
	ensureParentDirSync,
	pathExistsSync,
	walkDirectory,
} from "@side-quest/core/fs";
import { globFilesSync, matchGlob } from "@side-quest/core/glob";

/**
 * Copy files from source to destination based on glob patterns.
 *
 * Patterns are split into two categories:
 * - Root patterns (no `** /` prefix): globbed at the source root
 * - Recursive patterns (`** /` prefix): walked recursively with exclusions
 *
 * @param source - Absolute path to the main worktree (git root)
 * @param dest - Absolute path to the new worktree
 * @param patterns - Glob patterns from config.copy
 * @param excludeDirs - Directory names to skip during recursive walk
 * @returns Number of files copied
 */
export function copyWorktreeFiles(
	source: string,
	dest: string,
	patterns: readonly string[],
	excludeDirs: readonly string[],
): number {
	let copied = 0;

	const rootPatterns: string[] = [];
	const recursivePatterns: string[] = [];

	for (const pattern of patterns) {
		if (pattern.startsWith("**/")) {
			recursivePatterns.push(pattern);
		} else {
			rootPatterns.push(pattern);
		}
	}

	// Handle root patterns via glob
	for (const pattern of rootPatterns) {
		const matches = globFilesSync(pattern, { cwd: source, dot: true });
		for (const match of matches) {
			const relativePath = path.relative(source, match);
			// Skip if the match is inside an excluded directory
			if (isExcluded(relativePath, excludeDirs)) continue;

			const destPath = path.join(dest, relativePath);
			ensureParentDirSync(destPath);
			copyFileSync(match, destPath);
			copied++;
		}
	}

	// Handle root patterns that point to directories (e.g., ".claude")
	for (const pattern of rootPatterns) {
		if (pattern.includes("*")) continue; // skip globs, already handled
		const fullPath = path.join(source, pattern);
		if (!pathExistsSync(fullPath)) continue;

		try {
			if (fs.statSync(fullPath).isDirectory()) {
				copied += copyDirectory(
					fullPath,
					path.join(dest, pattern),
					excludeDirs,
				);
			}
		} catch {
			// Not accessible, skip
		}
	}

	// Handle recursive patterns via walkDirectory
	if (recursivePatterns.length > 0) {
		walkDirectory(
			source,
			(fullPath, relativePath, _entry) => {
				for (const pattern of recursivePatterns) {
					if (matchGlob(pattern, relativePath)) {
						const destPath = path.join(dest, relativePath);
						ensureParentDirSync(destPath);
						copyFileSync(fullPath, destPath);
						copied++;
						break; // Don't double-copy if multiple patterns match
					}
				}
			},
			{
				skipDirs: [...excludeDirs],
				skipHidden: false, // We need hidden files like .claude
			},
		);
	}

	return copied;
}

/**
 * Recursively copy a directory, respecting exclusions.
 *
 * @param srcDir - Source directory
 * @param destDir - Destination directory
 * @param excludeDirs - Directory names to skip
 * @returns Number of files copied
 */
function copyDirectory(
	srcDir: string,
	destDir: string,
	excludeDirs: readonly string[],
): number {
	let copied = 0;
	walkDirectory(
		srcDir,
		(fullPath, relativePath) => {
			const destPath = path.join(destDir, relativePath);
			ensureParentDirSync(destPath);
			copyFileSync(fullPath, destPath);
			copied++;
		},
		{
			skipDirs: [...excludeDirs],
			skipHidden: false,
		},
	);
	return copied;
}

/** Check if a relative path starts with an excluded directory. */
function isExcluded(
	relativePath: string,
	excludeDirs: readonly string[],
): boolean {
	const parts = relativePath.split(path.sep);
	return parts.some((part) => excludeDirs.includes(part));
}
