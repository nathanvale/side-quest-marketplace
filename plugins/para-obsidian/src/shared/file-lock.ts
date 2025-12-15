/**
 * File locking for concurrent operations
 *
 * Prevents race conditions when multiple processes try to modify
 * the same resource (e.g., classifier registry). Uses filesystem-based
 * locks with stale lock detection and automatic cleanup.
 *
 * @module shared/file-lock
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCK_DIR = join(tmpdir(), "para-obsidian-locks");
const LOCK_TIMEOUT_MS = 30000; // 30 seconds
const RETRY_INTERVAL_MS = 100; // 100ms between retries

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
	await mkdir(LOCK_DIR, { recursive: true });
	const lockPath = join(LOCK_DIR, `${resourceId}.lock`);

	// Acquire lock with timeout
	const acquired = await acquireLock(lockPath);
	if (!acquired) {
		throw new Error(`Failed to acquire lock for ${resourceId}`);
	}

	try {
		return await operation();
	} finally {
		await releaseLock(lockPath);
	}
}

/**
 * Attempt to acquire a lock file.
 * Retries until timeout, checking for stale locks.
 *
 * @param lockPath - Path to lock file
 * @returns True if lock acquired, false if timeout
 */
async function acquireLock(lockPath: string): Promise<boolean> {
	const deadline = Date.now() + LOCK_TIMEOUT_MS;

	while (Date.now() < deadline) {
		try {
			// O_EXCL flag ensures atomic creation (POSIX)
			await writeFile(lockPath, String(process.pid), { flag: "wx" });
			return true;
		} catch (_error) {
			// Lock exists - check if stale
			const pid = await readFile(lockPath, "utf-8").catch(() => null);
			if (pid && !isProcessRunning(Number(pid))) {
				// Stale lock - remove and retry
				await unlink(lockPath).catch(() => {
					// Ignore - another process may have removed it
				});
				continue;
			}

			// Wait and retry
			await sleep(RETRY_INTERVAL_MS);
		}
	}

	return false;
}

/**
 * Release a lock file
 *
 * @param lockPath - Path to lock file
 */
async function releaseLock(lockPath: string): Promise<void> {
	await unlink(lockPath).catch(() => {
		// Ignore - lock may have been removed by cleanup
	});
}

/**
 * Check if a process is still running
 *
 * @param pid - Process ID to check
 * @returns True if process is running
 */
function isProcessRunning(pid: number): boolean {
	try {
		// Signal 0 doesn't kill, just checks if process exists
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
export async function cleanupStaleLocks(): Promise<void> {
	try {
		const { readdirSync } = await import("node:fs");
		const files = readdirSync(LOCK_DIR);

		for (const file of files) {
			if (!file.endsWith(".lock")) continue;

			const lockPath = join(LOCK_DIR, file);
			const pid = await readFile(lockPath, "utf-8").catch(() => null);

			if (pid && !isProcessRunning(Number(pid))) {
				await unlink(lockPath).catch(() => {
					// Ignore - another process may have removed it
				});
			}
		}
	} catch {
		// Lock directory doesn't exist or not accessible
	}
}
