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
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import pLimit from "p-limit";
import { executeLogger } from "../../shared/logger";
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
// Write Serialization
// =============================================================================

/** Limit to 1 concurrent write operation (prevents registry corruption from race conditions) */
const writeLimit = pLimit(1);

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

	/**
	 * Get all processed items.
	 *
	 * @returns Array of all processed items
	 */
	getAllItems(): ProcessedItem[];

	/**
	 * Mark an operation as in-progress (Layer 2 defense).
	 *
	 * @param item - Item with inProgress flag
	 */
	markInProgress(item: ProcessedItem & { inProgress?: boolean }): void;

	/**
	 * Clear in-progress flag for a hash.
	 *
	 * @param hash - SHA256 hash to clear
	 */
	clearInProgress(hash: string): void;

	/**
	 * Remove an item from the registry by hash.
	 * Call save() after to persist the change.
	 *
	 * @param hash - SHA256 hash of file to remove
	 * @returns true if item was found and removed, false if not found
	 */
	removeItem(hash: string): boolean;

	/**
	 * Remove an item and save atomically.
	 * Combines removeItem() + save() with write serialization.
	 *
	 * @param hash - SHA256 hash of file to remove
	 * @returns true if item was found and removed, false if not found
	 */
	removeAndSave(hash: string): Promise<boolean>;

	/**
	 * Clear all items from the registry.
	 * Call save() after to persist the change.
	 */
	clear(): void;
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
 * Options for creating a registry manager.
 */
export interface RegistryOptions {
	/**
	 * If true (default), registry only tracks attachment processing.
	 * If false, tracks all processed inbox items.
	 */
	restrictToAttachments?: boolean;
}

/**
 * Create a registry manager for a vault.
 *
 * @param vaultPath - Path to the Obsidian vault root
 * @param options - Registry configuration options
 * @returns Registry manager instance
 */
export function createRegistry(
	vaultPath: string,
	options: RegistryOptions = {},
): RegistryManager {
	const { restrictToAttachments = true } = options;
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
	 * Internal save implementation without write serialization.
	 * This is used by removeAndSave which already uses writeLimit.
	 */
	async function _saveInternal(): Promise<void> {
		const tempPath = `${registryPath}.tmp`;
		const lockStartTime = Date.now();

		// Acquire lock before writing
		await acquireLock(lockPath);

		const lockWaitTime = Date.now() - lockStartTime;
		if (lockWaitTime > 100) {
			log.warn("Long lock wait time", {
				waitMs: lockWaitTime,
				path: registryPath,
			});
		}

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
			renameSync(tempPath, registryPath);

			log.debug("Registry saved", {
				items: items.size,
				path: registryPath,
				lockWaitMs: lockWaitTime,
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
	 * Save registry to disk using atomic write pattern.
	 *
	 * Writes to a temporary file first, then atomically renames to the target path.
	 * This prevents corruption if the process crashes mid-write.
	 *
	 * Uses write serialization via p-limit to prevent concurrent writes.
	 */
	async function save(): Promise<void> {
		return writeLimit(async () => _saveInternal());
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
	 * Validate that an item's type matches the expected type for the registry scope.
	 * When restrictRegistryToAttachments is true, allows both "attachment" and "note" types.
	 * "note" type is used for Type A documents where markdown is the source of truth.
	 *
	 * @param item - Item to validate
	 * @param restrictToAttachments - If true, only attachment and note items allowed
	 * @throws If item type doesn't match expected scope
	 */
	function validateItemType(
		item: ProcessedItem,
		restrictToAttachments: boolean,
	): void {
		if (restrictToAttachments) {
			// In attachment-only mode, item must have movedAttachment
			if (!item.movedAttachment) {
				throw new Error(
					"Registry restricted to attachments: item must have movedAttachment field",
				);
			}
			// If itemType is explicitly set, enforce it (allow "attachment" or "note")
			if (
				item.itemType &&
				item.itemType !== "attachment" &&
				item.itemType !== "note"
			) {
				throw new Error(
					`Registry restricted to attachments: itemType must be "attachment" or "note", got "${item.itemType}"`,
				);
			}
		}
	}

	/**
	 * Mark a file as processed.
	 * Validates required fields before insertion.
	 *
	 * @throws If sourceHash is not a 64-character hex string
	 * @throws If sourcePath is empty
	 * @throws If processedAt is not a valid ISO8601 timestamp
	 * @throws If item type doesn't match registry scope (when restrictRegistryToAttachments enabled)
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

		// Validate item type matches registry scope
		validateItemType(item, restrictToAttachments);

		items.set(item.sourceHash, item);
		log.debug("Item marked processed", {
			hash: `${item.sourceHash.slice(0, 8)}...`,
			path: item.sourcePath,
			itemType: item.itemType ?? "attachment",
		});
	}

	/**
	 * Get processed item by hash.
	 */
	function getItem(hash: string): ProcessedItem | undefined {
		return items.get(hash);
	}

	/**
	 * Get all processed items.
	 */
	function getAllItems(): ProcessedItem[] {
		return Array.from(items.values());
	}

	/**
	 * Mark operation as in-progress.
	 */
	function markInProgress(
		item: ProcessedItem & { inProgress?: boolean },
	): void {
		items.set(item.sourceHash, item as ProcessedItem);
		log.debug("Item marked in-progress", {
			hash: `${item.sourceHash.slice(0, 8)}...`,
			path: item.sourcePath,
		});
	}

	/**
	 * Clear in-progress flag for a hash.
	 */
	function clearInProgress(hash: string): void {
		const item = items.get(hash);
		if (item) {
			const updated: ProcessedItem = {
				sourceHash: item.sourceHash,
				sourcePath: item.sourcePath,
				processedAt: item.processedAt,
				createdNote: item.createdNote,
				movedAttachment: item.movedAttachment,
				orphanedInStaging: item.orphanedInStaging,
				inProgress: false,
			};
			items.set(hash, updated);
			log.debug("Cleared in-progress flag", {
				hash: `${hash.slice(0, 8)}...`,
			});
		}
	}

	/**
	 * Remove an item from the registry.
	 * Call save() after to persist the change.
	 */
	function removeItem(hash: string): boolean {
		const existed = items.has(hash);
		if (existed) {
			items.delete(hash);
			log.debug("Item removed from registry", {
				hash: `${hash.slice(0, 8)}...`,
			});
		}
		return existed;
	}

	/**
	 * Remove an item and save atomically.
	 * Uses write serialization to prevent race conditions.
	 */
	async function removeAndSave(hash: string): Promise<boolean> {
		return writeLimit(async () => {
			const existed = removeItem(hash);
			if (existed) {
				await _saveInternal();
			}
			return existed;
		});
	}

	/**
	 * Clear all items from the registry.
	 * Call save() after to persist the change.
	 */
	function clear(): void {
		const count = items.size;
		items.clear();
		log.debug("Registry cleared", { itemsRemoved: count });
	}

	return {
		load,
		save,
		isProcessed,
		markProcessed,
		getItem,
		getAllItems,
		markInProgress,
		clearInProgress,
		removeItem,
		removeAndSave,
		clear,
	};
}
