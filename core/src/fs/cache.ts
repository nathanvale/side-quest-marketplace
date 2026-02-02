/**
 * Cache directory utilities
 *
 * Provides utilities for managing per-repository cache directories.
 * Generic cache management that can be used by any plugin needing persistent caching.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ensure a cache directory exists for a given repository and cache name.
 *
 * Creates the directory structure if it doesn't exist.
 * Safe to call multiple times - idempotent operation.
 *
 * @param repoPath - Absolute path to the repository root
 * @param cacheName - Name of the cache subdirectory (e.g., "vector_db", "ast_cache")
 * @returns The absolute path to the cache directory
 *
 * @example
 * ```typescript
 * const cacheDir = ensureCacheDir("/path/to/repo", "vector_db");
 * // Returns: /path/to/repo/.kit/vector_db
 * ```
 */
export function ensureCacheDir(repoPath: string, cacheName: string): string {
	const cacheDir = join(repoPath, ".kit", cacheName);

	// Ensure directory exists
	if (!existsSync(cacheDir)) {
		mkdirSync(cacheDir, { recursive: true });
	}

	return cacheDir;
}

/**
 * Check if a cache directory has been populated with files.
 *
 * Returns false if the directory doesn't exist or is empty.
 * Useful for determining if a cache needs to be built or rebuilt.
 *
 * @param cacheDir - Absolute path to the cache directory
 * @returns true if cache directory exists and contains at least one file
 *
 * @example
 * ```typescript
 * const cacheDir = ensureCacheDir(repoPath, "vector_db");
 * if (!isCachePopulated(cacheDir)) {
 *   console.log("Cache is empty, building index...");
 *   buildIndex();
 * }
 * ```
 */
export function isCachePopulated(cacheDir: string): boolean {
	// If cache directory doesn't exist, it's not populated
	if (!existsSync(cacheDir)) {
		return false;
	}

	// Check if there are files in the cache directory
	try {
		const files = readdirSync(cacheDir);
		return files.length > 0;
	} catch {
		return false;
	}
}

/**
 * Get basic statistics about a cache directory.
 *
 * Returns null if the directory doesn't exist.
 * Useful for cache health checks and debugging.
 *
 * @param cacheDir - Absolute path to the cache directory
 * @returns Object with fileCount and totalBytes, or null if directory doesn't exist
 *
 * @example
 * ```typescript
 * const stats = getCacheStats(cacheDir);
 * if (stats) {
 *   console.log(`Cache has ${stats.fileCount} files (${stats.totalBytes} bytes)`);
 * }
 * ```
 */
export function getCacheStats(
	cacheDir: string,
): { fileCount: number; totalBytes: number } | null {
	if (!existsSync(cacheDir)) {
		return null;
	}

	try {
		const files = readdirSync(cacheDir);
		let totalBytes = 0;

		for (const file of files) {
			try {
				const filePath = join(cacheDir, file);
				const stats = statSync(filePath);
				if (stats.isFile()) {
					totalBytes += stats.size;
				}
			} catch {}
		}

		return {
			fileCount: files.length,
			totalBytes,
		};
	} catch {
		return null;
	}
}
