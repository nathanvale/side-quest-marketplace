/**
 * File statistics utilities
 *
 * Provides utilities for calculating file age and size with proper error handling.
 * Extracted from kit plugin to eliminate duplication.
 */

import { existsSync, statSync } from "node:fs";

/**
 * Get the age of a file in hours.
 *
 * Returns null if the file doesn't exist or can't be stat'd.
 * Useful for cache invalidation and staleness checks.
 *
 * @param filePath - Path to the file
 * @returns Age in hours, or null if file doesn't exist
 *
 * @example
 * ```typescript
 * const age = getFileAgeHours("PROJECT_INDEX.json");
 * if (age !== null && age > 24) {
 *   console.log("Index is stale, regenerating...");
 * }
 * ```
 */
export function getFileAgeHours(filePath: string): number | null {
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const stats = statSync(filePath);
		const ageMs = Date.now() - stats.mtimeMs;
		return ageMs / (1000 * 60 * 60); // Convert to hours
	} catch {
		return null;
	}
}

/**
 * Get a human-readable file size in MB (e.g., "1.23").
 *
 * Returns null if the file doesn't exist or can't be stat'd.
 * Always formats to 2 decimal places.
 *
 * @param filePath - Path to the file
 * @returns Size as string in MB format, or null if file doesn't exist
 *
 * @example
 * ```typescript
 * const size = getFileSizeMB("large-file.json");
 * console.log(`File size: ${size} MB`);
 * // Output: "File size: 1.23 MB"
 * ```
 */
export function getFileSizeMB(filePath: string): string | null {
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const stats = statSync(filePath);
		const mb = stats.size / (1024 * 1024);
		return mb.toFixed(2);
	} catch {
		return null;
	}
}

/**
 * Check if a file is stale (older than maxAgeHours).
 *
 * Returns true if the file doesn't exist or is older than the threshold.
 * Useful for cache validation and regeneration logic.
 *
 * @param filePath - Path to the file
 * @param maxAgeHours - Maximum age in hours before considering file stale
 * @returns true if file is stale or doesn't exist, false otherwise
 *
 * @example
 * ```typescript
 * if (isFileStale("cache.json", 24)) {
 *   regenerateCache();
 * }
 * ```
 */
export function isFileStale(filePath: string, maxAgeHours: number): boolean {
	const age = getFileAgeHours(filePath);
	// File doesn't exist or is older than threshold
	return age === null || age > maxAgeHours;
}
