/**
 * Concurrency utilities for safe concurrent operations.
 *
 * Provides primitives for file locking and transactional operations
 * with automatic rollback support.
 *
 * ## File Locking
 *
 * Prevents race conditions when multiple processes try to modify
 * the same resource (e.g., registries, config files).
 *
 * ```typescript
 * import { withFileLock } from "@sidequest/core/concurrency";
 *
 * await withFileLock("classifier-registry", async () => {
 *   const registry = await readRegistry();
 *   registry.items.push(newItem);
 *   await writeRegistry(registry);
 * });
 * ```
 *
 * ## Transactions
 *
 * Executes a series of operations atomically, with automatic rollback
 * on failure. Ensures all-or-nothing semantics for multi-step operations.
 *
 * ```typescript
 * import { executeTransaction } from "@sidequest/core/concurrency";
 *
 * const result = await executeTransaction([
 *   {
 *     name: "create-file",
 *     execute: async () => { await writeFile(path, content); return path; },
 *     rollback: async (path) => { await unlink(path).catch(() => {}); }
 *   },
 *   {
 *     name: "update-config",
 *     execute: async () => { await updateConfig(); },
 *     rollback: async () => { await restoreConfig(); }
 *   }
 * ]);
 *
 * if (!result.success) {
 *   console.error(`Failed at ${result.failedAt}:`, result.error);
 * }
 * ```
 *
 * @module core/concurrency
 */

export {
	type CleanupResult,
	cleanupStaleLocks,
	type FileLockLogger,
	type FileLockOptions,
	getDefaultLockDir,
	withFileLock,
} from "./file-lock.js";

export {
	executeTransaction,
	type RollbackOperation,
	Transaction,
	type TransactionLogger,
	type TransactionResult,
} from "./transaction.js";
