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
