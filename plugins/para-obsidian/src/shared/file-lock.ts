/**
 * File locking for concurrent operations
 *
 * Prevents race conditions when multiple processes try to modify
 * the same resource (e.g., classifier registry). Uses filesystem-based
 * locks with stale lock detection and automatic cleanup.
 *
 * This module wraps @sidequest/core/concurrency with para-obsidian-specific
 * instrumentation and logging.
 *
 * @module shared/file-lock
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	cleanupStaleLocks as coreCleanupStaleLocks,
	withFileLock as coreWithFileLock,
} from "@side-quest/core/concurrency";
import { observe } from "./instrumentation.js";
import { lockLogger } from "./logger.js";

/** Para-obsidian-specific lock directory */
const LOCK_DIR = join(tmpdir(), "para-obsidian-locks");

/**
 * Execute an operation with exclusive file lock.
 * Prevents concurrent modifications to the same resource.
 *
 * @param resourceId - Unique identifier for the resource to lock
 * @param operation - Operation to execute while holding the lock
 * @returns Result of the operation
 * @throws Error if lock cannot be acquired within timeout
 *
 * @example
 * ```ts
 * // Prevent concurrent registry updates
 * await withFileLock('classifier-registry', async () => {
 *   const registry = await readRegistry();
 *   registry.classifiers.push(newClassifier);
 *   await writeRegistry(registry);
 * });
 * ```
 */
export async function withFileLock<T>(
	resourceId: string,
	operation: () => Promise<T>,
): Promise<T> {
	return observe(
		lockLogger,
		"lock:withFileLock",
		async () => {
			// Delegate to core implementation with para-obsidian-specific lock dir
			return coreWithFileLock(resourceId, operation, {
				lockDir: LOCK_DIR,
				logger: {
					debug: (message, context) =>
						lockLogger.debug`${message} ${JSON.stringify(context ?? {})}`,
					error: (message, context) =>
						lockLogger.error`${message} ${JSON.stringify(context ?? {})}`,
				},
			});
		},
		{ context: { resourceId } },
	);
}

/**
 * Clean up stale lock files.
 * Removes locks for processes that are no longer running.
 *
 * @example
 * ```ts
 * // Cleanup on application start
 * await cleanupStaleLocks();
 * ```
 */
export async function cleanupStaleLocks(): Promise<{
	cleanedCount: number;
	totalFiles: number;
}> {
	return observe(
		lockLogger,
		"lock:cleanupStaleLocks",
		async () => {
			// Delegate to core implementation with para-obsidian-specific lock dir
			return coreCleanupStaleLocks({
				lockDir: LOCK_DIR,
				logger: {
					debug: (message, context) =>
						lockLogger.debug`${message} ${JSON.stringify(context ?? {})}`,
				},
			});
		},
		{
			context: {},
			isSuccess: () => true, // Always succeeds (best-effort cleanup)
		},
	);
}
