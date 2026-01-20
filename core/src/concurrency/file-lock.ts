/**
 * File locking for concurrent operations.
 *
 * Prevents race conditions when multiple processes try to modify
 * the same resource (e.g., registries, config files). Uses filesystem-based
 * locks with stale lock detection and automatic cleanup.
 *
 * ## Features
 *
 * - **Atomic lock acquisition** using O_EXCL flag (POSIX)
 * - **Stale lock detection** via PID checking
 * - **Automatic retry** with configurable timeout
 * - **Resource isolation** via hashed filenames
 *
 * @module core/concurrency/file-lock
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Configuration options for file locking.
 */
export interface FileLockOptions {
	/**
	 * Directory to store lock files.
	 * @default os.tmpdir()/sidequest-locks
	 */
	lockDir?: string;

	/**
	 * Maximum time to wait for lock acquisition in milliseconds.
	 * @default 30000 (30 seconds)
	 */
	timeoutMs?: number;

	/**
	 * Interval between lock acquisition retries in milliseconds.
	 * @default 100
	 */
	retryIntervalMs?: number;

	/**
	 * Optional logger for debug output.
	 */
	logger?: FileLockLogger;
}

/**
 * Logger interface for file lock operations.
 */
export interface FileLockLogger {
	debug?(message: string, context?: Record<string, unknown>): void;
	error?(message: string, context?: Record<string, unknown>): void;
}

// Default configuration
const DEFAULT_LOCK_DIR = join(tmpdir(), "sidequest-locks");
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_INTERVAL_MS = 100;

/**
 * Convert a resource ID to a safe lock filename.
 * Uses SHA-256 hash to ensure uniqueness while avoiding filesystem issues.
 */
function toLockFilename(resourceId: string): string {
	const hash = createHash("sha256")
		.update(resourceId)
		.digest("hex")
		.slice(0, 16);
	return `${hash}.lock`;
}

/**
 * Check if a process is still running.
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
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to acquire a lock file with retry and stale lock detection.
 */
async function acquireLock(
	lockPath: string,
	timeoutMs: number,
	retryIntervalMs: number,
	logger?: FileLockLogger,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

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
				logger?.debug?.("Removing stale lock", {
					lockPath,
					stalePid: Number(pid),
				});
				await unlink(lockPath).catch(() => {
					// Ignore - another process may have removed it
				});
				continue;
			}

			// Wait and retry
			await sleep(retryIntervalMs);
		}
	}

	return false;
}

/**
 * Release a lock file.
 */
async function releaseLock(lockPath: string): Promise<void> {
	await unlink(lockPath).catch(() => {
		// Ignore - lock may have been removed by cleanup
	});
}

/**
 * Execute an operation with exclusive file lock.
 *
 * Prevents concurrent modifications to the same resource by acquiring
 * a filesystem-based lock before executing the operation. The lock is
 * automatically released when the operation completes or throws.
 *
 * @template T - Return type of the operation
 * @param resourceId - Unique identifier for the resource to lock
 * @param operation - Operation to execute while holding the lock
 * @param options - Lock configuration options
 * @returns Result of the operation
 * @throws Error if lock cannot be acquired within timeout
 *
 * @example
 * ```typescript
 * // Prevent concurrent registry updates
 * await withFileLock("classifier-registry", async () => {
 *   const registry = await readRegistry();
 *   registry.items.push(newItem);
 *   await writeRegistry(registry);
 * });
 *
 * // With custom options
 * await withFileLock(
 *   "config-file",
 *   async () => updateConfig(changes),
 *   { timeoutMs: 5000, logger: myLogger }
 * );
 * ```
 */
export async function withFileLock<T>(
	resourceId: string,
	operation: () => Promise<T>,
	options?: FileLockOptions,
): Promise<T> {
	const lockDir = options?.lockDir ?? DEFAULT_LOCK_DIR;
	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const retryIntervalMs = options?.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
	const logger = options?.logger;

	await mkdir(lockDir, { recursive: true });
	const lockPath = join(lockDir, toLockFilename(resourceId));

	const lockAcquireStart = Date.now();
	const acquired = await acquireLock(
		lockPath,
		timeoutMs,
		retryIntervalMs,
		logger,
	);
	const lockWaitMs = Date.now() - lockAcquireStart;

	if (!acquired) {
		throw new Error(
			`Failed to acquire lock for "${resourceId}" after ${timeoutMs}ms`,
		);
	}

	logger?.debug?.("Lock acquired", { resourceId, lockWaitMs });

	try {
		return await operation();
	} finally {
		await releaseLock(lockPath);
		logger?.debug?.("Lock released", { resourceId });
	}
}

/**
 * Result of stale lock cleanup.
 */
export interface CleanupResult {
	/** Number of stale locks removed */
	cleanedCount: number;
	/** Total number of lock files found */
	totalFiles: number;
}

/**
 * Clean up stale lock files.
 *
 * Removes locks for processes that are no longer running.
 * Useful to call on application startup to clean up after crashes.
 *
 * @param options - Lock configuration options (uses lockDir)
 * @returns Cleanup statistics
 *
 * @example
 * ```typescript
 * // Cleanup on application start
 * const result = await cleanupStaleLocks();
 * console.log(`Cleaned ${result.cleanedCount} stale locks`);
 * ```
 */
export async function cleanupStaleLocks(
	options?: FileLockOptions,
): Promise<CleanupResult> {
	const lockDir = options?.lockDir ?? DEFAULT_LOCK_DIR;
	const logger = options?.logger;

	let cleanedCount = 0;
	let totalFiles = 0;

	try {
		const files = await readdir(lockDir);
		totalFiles = files.length;

		for (const file of files) {
			if (!file.endsWith(".lock")) continue;

			const lockPath = join(lockDir, file);
			const pid = await readFile(lockPath, "utf-8").catch(() => null);

			if (pid && !isProcessRunning(Number(pid))) {
				await unlink(lockPath).catch(() => {
					// Ignore - another process may have removed it
				});
				cleanedCount++;
				logger?.debug?.("Removed stale lock", { lockPath, pid: Number(pid) });
			}
		}
	} catch {
		// Lock directory doesn't exist or not accessible
		logger?.debug?.("Lock directory not accessible", { lockDir });
	}

	return { cleanedCount, totalFiles };
}

/**
 * Get the default lock directory path.
 *
 * Useful for tests or diagnostics.
 */
export function getDefaultLockDir(): string {
	return DEFAULT_LOCK_DIR;
}
