/**
 * Concurrency utilities for safe concurrent operations.
 *
 * Provides primitives for file locking, transactional operations,
 * resource pooling, rate limiting, and timeout management for async operations.
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
 * ## Resource Pooling
 *
 * Cache expensive resources that should be created once per key.
 * Prevents duplicate creation even when called concurrently.
 *
 * ```typescript
 * import { ResourcePool } from "@sidequest/core/concurrency";
 *
 * const parserPool = new ResourcePool<string, Parser>();
 *
 * export async function getParser(language: string): Promise<Parser> {
 *   return parserPool.getOrCreate(language, async (lang) => {
 *     const parser = new Parser();
 *     const grammar = await loadGrammar(lang);
 *     parser.setLanguage(grammar);
 *     return parser;
 *   });
 * }
 * ```
 *
 * ## Rate Limiting
 *
 * Enforce minimum delay between operations to respect API rate limits.
 *
 * ```typescript
 * import { RateLimiter } from "@sidequest/core/concurrency";
 *
 * const limiter = new RateLimiter(2000); // 2s between requests
 *
 * for (const url of urls) {
 *   await limiter.wait();
 *   await fetch(url);
 * }
 * ```
 *
 * ## Timeouts
 *
 * Wrap async operations with timeouts to prevent hanging indefinitely.
 *
 * ```typescript
 * import { withTimeout } from "@sidequest/core/concurrency";
 *
 * try {
 *   const result = await withTimeout(fetchData(), 5000);
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.error(`Timed out after ${error.timeoutMs}ms`);
 *   }
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
	type ParallelChunkOptions,
	processInParallelChunks,
} from "./parallel.js";
export { RateLimiter } from "./rate-limiter.js";
export { ResourcePool } from "./resource-pool.js";
export {
	createTimeoutPromise,
	TimeoutError,
	withTimeout,
} from "./timeout.js";
export {
	executeTransaction,
	type RollbackOperation,
	Transaction,
	type TransactionLogger,
	type TransactionResult,
} from "./transaction.js";
