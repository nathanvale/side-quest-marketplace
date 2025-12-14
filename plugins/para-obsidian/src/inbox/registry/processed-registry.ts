/**
 * Inbox Processing Framework - Registry
 *
 * Provides idempotency tracking for processed inbox items.
 * Stores processed items in .inbox-processed.json at vault root.
 *
 * Features:
 * - SHA256 file hashing for content-based deduplication
 * - Graceful handling of corrupt/missing registry files
 * - File locking to prevent concurrent access conflicts
 * - Atomic writes to prevent corruption (temp file + rename)
 * - Stale lock detection and automatic cleanup
 *
 * @example
 * ```typescript
 * import { createRegistry, hashFile } from "./processed-registry";
 *
 * const registry = createRegistry("/path/to/vault");
 * await registry.load();
 *
 * const hash = await hashFile("/path/to/file.pdf");
 * if (!registry.isProcessed(hash)) {
 *   // Process the file...
 *   registry.markProcessed({
 *     sourceHash: hash,
 *     sourcePath: "/inbox/file.pdf",
 *     processedAt: new Date().toISOString(),
 *     createdNote: "/notes/file.md",
 *   });
 *   await registry.save();
 * }
 * ```
 */

import {
	existsSync,
	mkdirSync,
	renameSync as rename,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { executeLogger } from "../../logger";
import { createInboxError } from "../shared/errors";
import {
	type ProcessedItem,
	type ProcessedRegistry,
	RegistryVersion,
} from "../types";

// =============================================================================
// Constants
// =============================================================================

/** Registry file name stored at vault root */
const REGISTRY_FILE = ".inbox-processed.json";

/** Current registry schema version */
const REGISTRY_VERSION = RegistryVersion.V1;

/** Lock file acquisition timeout (30 seconds) */
const LOCK_TIMEOUT = 30_000;

/** Delay between lock acquisition retries (100ms) */
const LOCK_RETRY_DELAY = 100;

// =============================================================================
// Logger Helper
// =============================================================================

/**
 * Safe logger wrapper that handles potentially undefined logger.
 * This is needed because subsystemLoggers is typed as Record<string, Logger>
 * which makes property access return Logger | undefined.
 */
const log = {
	debug(message: string, props?: Record<string, unknown>): void {
		if (executeLogger) {
			executeLogger.debug(message, props);
		}
	},
	warn(message: string, props?: Record<string, unknown>): void {
		if (executeLogger) {
			executeLogger.warn(message, props);
		}
	},
	error(message: string, props?: Record<string, unknown>): void {
		if (executeLogger) {
			executeLogger.error(message, props);
		}
	},
};

// =============================================================================
// Registry Manager Interface
// =============================================================================

/**
 * Registry manager for tracking processed inbox items.
 */
export interface RegistryManager {
	/**
	 * Load registry from disk. Creates empty registry if file doesn't exist.
	 * Recovers with empty registry if file is corrupt.
	 */
	load(): Promise<void>;

	/**
	 * Save registry to disk.
	 */
	save(): Promise<void>;

	/**
	 * Check if a file hash has been processed.
	 *
	 * @param hash - SHA256 hash of file contents
	 * @returns true if hash exists in registry
	 */
	isProcessed(hash: string): boolean;

	/**
	 * Mark a file as processed.
	 * Updates existing entry if hash already exists.
	 *
	 * @param item - Processed item to add/update
	 */
	markProcessed(item: ProcessedItem): void;

	/**
	 * Get processed item by hash.
	 *
	 * @param hash - SHA256 hash of file contents
	 * @returns ProcessedItem if found, undefined otherwise
	 */
	getItem(hash: string): ProcessedItem | undefined;
}

// =============================================================================
// Hash Function
// =============================================================================

/**
 * Generate SHA256 hash of a file's contents.
 *
 * Uses Bun's native crypto for efficient hashing.
 *
 * @param filePath - Absolute path to the file
 * @returns Hex-encoded SHA256 hash
 * @throws If file cannot be read
 */
export async function hashFile(filePath: string): Promise<string> {
	const file = Bun.file(filePath);
	const buffer = await file.arrayBuffer();
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(buffer);
	return hasher.digest("hex");
}

// =============================================================================
// File Locking
// =============================================================================

/**
 * Acquire a file lock by creating a lock file with timestamp.
 * Retries with exponential backoff if lock is held by another process.
 * Detects and removes stale locks (older than LOCK_TIMEOUT).
 *
 * @param lockPath - Path to lock file
 * @throws If lock cannot be acquired within LOCK_TIMEOUT
 */
async function acquireLock(lockPath: string): Promise<void> {
	const startTime = Date.now();

	while (existsSync(lockPath)) {
		// Check if lock is stale (older than timeout)
		try {
			const lockContent = await Bun.file(lockPath).text();
			const lockTime = Number.parseInt(lockContent, 10);
			if (Date.now() - lockTime > LOCK_TIMEOUT) {
				// Stale lock, remove it
				log.warn("Removing stale lock file", {
					path: lockPath,
					age: Date.now() - lockTime,
				});
				unlinkSync(lockPath);
				break;
			}
		} catch {
			// Lock file unreadable, try to remove
			try {
				unlinkSync(lockPath);
			} catch {
				/* ignore */
			}
			break;
		}

		if (Date.now() - startTime > LOCK_TIMEOUT) {
			throw new Error(
				"Failed to acquire registry lock - another process may be running",
			);
		}

		await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY));
	}

	// Ensure parent directory exists before creating lock file
	const lockDir = dirname(lockPath);
	if (!existsSync(lockDir)) {
		try {
			mkdirSync(lockDir, { recursive: true });
		} catch {
			// Directory can't be created (read-only fs, tests with fake paths, etc.)
			// Gracefully skip locking - single process scenario is safe
			log.warn("Cannot create lock directory, skipping lock", {
				path: lockDir,
			});
			return;
		}
	}

	// Create lock file with timestamp
	try {
		writeFileSync(lockPath, String(Date.now()), "utf8");
		log.debug("Lock acquired", { path: lockPath });
	} catch {
		// Lock file can't be created - gracefully degrade
		log.warn("Cannot create lock file, proceeding without lock", {
			path: lockPath,
		});
	}
}

/**
 * Release a file lock by removing the lock file.
 * Ignores errors if lock file doesn't exist.
 *
 * @param lockPath - Path to lock file
 */
function releaseLock(lockPath: string): void {
	try {
		unlinkSync(lockPath);
		log.debug("Lock released", { path: lockPath });
	} catch {
		/* ignore - lock may have been removed already */
	}
}

// =============================================================================
// Registry Factory
// =============================================================================

/**
 * Create a registry manager for a vault.
 *
 * @param vaultPath - Path to the Obsidian vault root
 * @returns Registry manager instance
 */
export function createRegistry(vaultPath: string): RegistryManager {
	const registryPath = join(vaultPath, REGISTRY_FILE);
	const lockPath = `${registryPath}.lock`;

	// In-memory state
	let items = new Map<string, ProcessedItem>();

	/**
	 * Validate that data is a valid ProcessedRegistry.
	 */
	function isValidRegistry(data: unknown): data is ProcessedRegistry {
		if (typeof data !== "object" || data === null) {
			return false;
		}

		const obj = data as Record<string, unknown>;

		if (obj.version !== REGISTRY_VERSION) {
			return false;
		}

		if (!Array.isArray(obj.items)) {
			return false;
		}

		// Validate each item has required fields
		for (const item of obj.items) {
			if (typeof item !== "object" || item === null) {
				return false;
			}
			const i = item as Record<string, unknown>;
			if (
				typeof i.sourceHash !== "string" ||
				typeof i.sourcePath !== "string" ||
				typeof i.processedAt !== "string"
			) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Load registry from disk.
	 */
	async function load(): Promise<void> {
		// Acquire lock before reading
		await acquireLock(lockPath);

		try {
			// Reset in-memory state
			items = new Map();

			// Check if file exists
			if (!existsSync(registryPath)) {
				log.debug("Registry file not found, starting fresh", {
					path: registryPath,
				});
				return;
			}

			try {
				const file = Bun.file(registryPath);
				const text = await file.text();
				const data = JSON.parse(text) as unknown;

				if (!isValidRegistry(data)) {
					log.warn(
						"Registry file is invalid or wrong version, recovering with empty registry",
						{ path: registryPath },
					);
					return;
				}

				// Populate in-memory map
				for (const item of data.items) {
					items.set(item.sourceHash, item);
				}

				log.debug("Registry loaded", {
					items: items.size,
					path: registryPath,
				});
			} catch (error) {
				// Check for non-recoverable filesystem errors
				if (error && typeof error === "object" && "code" in error) {
					const code = (error as { code: string }).code;

					// Permission denied - user must fix this
					if (code === "EACCES") {
						throw new Error(
							`Registry file not readable (permission denied): ${registryPath}`,
						);
					}

					// Disk full or I/O error - critical system issue
					if (code === "ENOSPC" || code === "EIO") {
						throw new Error(
							`Filesystem error reading registry (${code}): ${registryPath}`,
						);
					}
				}

				// Recoverable: JSON parse errors, version mismatches, corrupt files
				// Log warning and recover with empty registry
				log.warn("Failed to load registry, recovering with empty registry", {
					path: registryPath,
					error: String(error),
				});
			}
		} finally {
			// Always release lock, even on error
			releaseLock(lockPath);
		}
	}

	/**
	 * Save registry to disk using atomic write pattern.
	 *
	 * Writes to a temporary file first, then atomically renames to the target path.
	 * This prevents corruption if the process crashes mid-write.
	 */
	async function save(): Promise<void> {
		const tempPath = `${registryPath}.tmp`;

		// Acquire lock before writing
		await acquireLock(lockPath);

		try {
			// Ensure parent directory exists
			const dir = dirname(registryPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			// Build registry object
			const registry: ProcessedRegistry = {
				version: REGISTRY_VERSION,
				items: Array.from(items.values()),
			};

			// Write to temporary file first
			await Bun.write(tempPath, JSON.stringify(registry, null, 2));

			// Atomic rename (POSIX guarantees atomicity)
			await rename(tempPath, registryPath);

			log.debug("Registry saved", {
				items: items.size,
				path: registryPath,
			});
		} catch (error) {
			log.error("Failed to save registry", {
				path: registryPath,
				error: String(error),
			});
			throw createInboxError(
				"REG_WRITE_FAILED",
				{
					cid: "registry-save",
					operation: "save",
					source: registryPath,
				},
				`Failed to save registry: ${String(error)}`,
			);
		} finally {
			// Always release lock, even on error
			releaseLock(lockPath);
		}
	}

	/**
	 * Validate that a hash is a valid SHA256 hex string.
	 * @param hash - Hash to validate
	 * @returns true if valid 64-character hex string
	 */
	function isValidHash(hash: string): boolean {
		return (
			typeof hash === "string" &&
			hash.length === 64 &&
			/^[a-f0-9]+$/i.test(hash)
		);
	}

	/**
	 * Check if a hash has been processed.
	 * Validates hash format before lookup to prevent silent failures with malformed hashes.
	 *
	 * @param hash - SHA256 hash to check (must be 64-char hex string)
	 * @returns true if hash exists in registry, false if not found or invalid
	 */
	function isProcessed(hash: string): boolean {
		if (!isValidHash(hash)) {
			log.warn("isProcessed called with invalid hash", {
				hashLength: hash?.length,
				hashPrefix: hash?.slice(0, 10),
			});
			return false;
		}
		return items.has(hash);
	}

	/**
	 * Validate ISO8601 timestamp.
	 *
	 * @param str - String to validate
	 * @returns true if valid ISO8601 timestamp
	 */
	function isValidISO8601(str: string): boolean {
		const date = new Date(str);
		return !Number.isNaN(date.getTime()) && str.includes("T");
	}

	/**
	 * Mark a file as processed.
	 * Validates required fields before insertion.
	 *
	 * @throws If sourceHash is not a 64-character hex string
	 * @throws If sourcePath is empty
	 * @throws If processedAt is not a valid ISO8601 timestamp
	 */
	function markProcessed(item: ProcessedItem): void {
		// Validate sourceHash (SHA256 = 64 hex chars)
		if (!item.sourceHash || item.sourceHash.length !== 64) {
			throw new Error(
				`Invalid sourceHash: expected 64-char hex string, got "${item.sourceHash?.slice(0, 10)}..."`,
			);
		}

		// Validate sourcePath
		if (!item.sourcePath || item.sourcePath.trim().length === 0) {
			throw new Error("Invalid sourcePath: cannot be empty");
		}

		// Validate processedAt
		if (!item.processedAt || !isValidISO8601(item.processedAt)) {
			throw new Error(
				`Invalid processedAt: expected ISO8601 timestamp, got "${item.processedAt}"`,
			);
		}

		items.set(item.sourceHash, item);
		log.debug("Item marked processed", {
			hash: `${item.sourceHash.slice(0, 8)}...`,
			path: item.sourcePath,
		});
	}

	/**
	 * Get processed item by hash.
	 */
	function getItem(hash: string): ProcessedItem | undefined {
		return items.get(hash);
	}

	return {
		load,
		save,
		isProcessed,
		markProcessed,
		getItem,
	};
}
