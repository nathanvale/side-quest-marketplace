/**
 * Concurrency utilities for safe parallel operations
 *
 * @module concurrency
 */

export {
	cleanupStaleLocks,
	withFileLock,
} from "./file-lock.js";

export {
	executeTransaction,
	type RollbackOperation,
	Transaction,
	type TransactionResult,
} from "./transaction.js";
