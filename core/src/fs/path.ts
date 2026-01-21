/**
 * Path utilities - expanding tildes and normalizing paths
 *
 * Extracted from plugins/kit/src/validators.ts to consolidate shared utilities.
 */

import { homedir } from "node:os";
import { isAbsolute, normalize, resolve } from "node:path";

/**
 * Expand tilde (~) in paths to the user's home directory.
 *
 * Handles three cases:
 * - `~` → User's home directory
 * - `~/path` → Home directory + path
 * - Everything else → Passthrough unchanged
 *
 * @param inputPath - Path that may contain tilde
 * @returns Expanded absolute path
 *
 * @example
 * expandTilde('~/code') // => '/Users/nathan/code'
 * expandTilde('~') // => '/Users/nathan'
 * expandTilde('/absolute/path') // => '/absolute/path'
 * expandTilde('relative/path') // => 'relative/path'
 */
export function expandTilde(inputPath: string): string {
	if (inputPath.startsWith("~/")) {
		return inputPath.replace("~", homedir());
	}
	if (inputPath === "~") {
		return homedir();
	}
	return inputPath;
}

/**
 * Normalize and resolve a path, expanding tilde and making it absolute.
 *
 * Combines multiple operations:
 * 1. Expand tilde (~) to home directory
 * 2. Resolve relative paths to absolute
 * 3. Normalize path separators and .. sequences
 *
 * @param inputPath - Path to normalize
 * @param basePath - Base path for relative paths (default: process.cwd())
 * @returns Normalized absolute path
 *
 * @example
 * normalizePath('~/code') // => '/Users/nathan/code'
 * normalizePath('src') // => '/current/working/dir/src'
 * normalizePath('src', '/custom/base') // => '/custom/base/src'
 * normalizePath('/a/b/../c') // => '/a/c'
 * normalizePath('/a//b///c') // => '/a/b/c'
 */
export function normalizePath(inputPath: string, basePath?: string): string {
	const expanded = expandTilde(inputPath);
	const resolved = isAbsolute(expanded)
		? expanded
		: resolve(basePath ?? process.cwd(), expanded);
	return normalize(resolved);
}

/**
 * Normalize a path fragment for comparison.
 *
 * Converts backslashes to forward slashes (Windows compatibility)
 * and removes trailing slashes for consistent matching.
 *
 * Used for directory matching and path comparisons.
 *
 * @param input - Path fragment to normalize
 * @returns Normalized path with forward slashes, no trailing slash
 *
 * @example
 * normalizePathFragment('Projects\\Alpha') // => 'Projects/Alpha' (Windows)
 * normalizePathFragment('Projects/Alpha/') // => 'Projects/Alpha'
 * normalizePathFragment('Projects//Alpha///') // => 'Projects//Alpha' (preserves internal slashes)
 */
export function normalizePathFragment(input: string): string {
	return input.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Check if a file path matches any of the given directories.
 *
 * Performs normalized comparisons to handle:
 * - Windows backslashes
 * - Trailing slashes
 * - Subdirectory matching
 *
 * If no directories provided, matches all paths.
 *
 * @param file - File path to check
 * @param dirs - Optional array of directory paths to match against
 * @returns true if file is in any of the directories or subdirectories
 *
 * @example
 * matchesDir('Projects/Alpha/note.md', ['Projects']) // => true
 * matchesDir('Projects/Alpha', ['Projects']) // => true (exact match)
 * matchesDir('Areas/Work', ['Projects']) // => false
 * matchesDir('anything', undefined) // => true (no filter)
 * matchesDir('anything', []) // => true (empty filter)
 */
export function matchesDir(
	file: string,
	dirs?: ReadonlyArray<string>,
): boolean {
	if (!dirs || dirs.length === 0) return true;
	const normalizedFile = normalizePathFragment(file);
	return dirs.some((dir) => {
		const normalizedDir = normalizePathFragment(dir);
		return (
			normalizedFile === normalizedDir ||
			normalizedFile.startsWith(`${normalizedDir}/`)
		);
	});
}
