/**
 * Transaction abstraction with rollback support
 *
 * Executes a series of operations atomically, with automatic rollback
 * on failure. Ensures all-or-nothing semantics for multi-step operations.
 *
 * This module wraps @sidequest/core/concurrency with para-obsidian-specific
 * instrumentation and logging.
 *
 * @module shared/transaction
 */

import {
	type RollbackOperation as CoreRollbackOperation,
	Transaction as CoreTransaction,
	type TransactionResult as CoreTransactionResult,
	executeTransaction as coreExecuteTransaction,
} from "@sidequest/core/concurrency";
import { observe } from "./instrumentation.js";
import { txLogger } from "./logger.js";

/**
 * Re-export types from core for backward compatibility
 */
export type RollbackOperation = CoreRollbackOperation;
export type TransactionResult<T> = CoreTransactionResult<T>;

/**
 * Transaction executor with automatic rollback on failure.
 *
 * Wraps core Transaction with para-obsidian instrumentation.
 *
 * @example
 * ```ts
 * const tx = new Transaction();
 *
 * // Add operations
 * tx.add({
 *   name: 'create-file',
 *   execute: async () => {
 *     await writeFile(path, content);
 *     return { path };
 *   },
 *   rollback: async ({ path }) => {
 *     await unlink(path).catch(() => {});
 *   }
 * });
 *
 * // Execute with automatic rollback
 * const result = await tx.execute<string>();
 * if (!result.success) {
 *   console.error(`Transaction failed at ${result.failedAt}: ${result.error}`);
 * }
 * ```
 */
export class Transaction {
	private coreTransaction: CoreTransaction;
	private operationNames: string[] = [];

	constructor() {
		this.coreTransaction = new CoreTransaction({
			logger: {
				debug: (message, context) =>
					txLogger.debug`${message} ${JSON.stringify(context ?? {})}`,
				error: (message, context) =>
					txLogger.error`${message} ${JSON.stringify(context ?? {})}`,
			},
		});
	}

	/**
	 * Add an operation to the transaction
	 *
	 * @param operation - Operation with execute and rollback functions
	 */
	add(operation: RollbackOperation): void {
		this.operationNames.push(operation.name);
		this.coreTransaction.add(operation);
	}

	/**
	 * Execute all operations sequentially.
	 * Rolls back on any failure.
	 *
	 * @returns Transaction result with success flag and data/error
	 */
	async execute<T = void>(): Promise<TransactionResult<T>> {
		return observe(
			txLogger,
			"tx:execute",
			async () => {
				return this.coreTransaction.execute<T>();
			},
			{
				context: {
					operationCount: this.pendingCount,
					operationNames: this.operationNames,
				},
				isSuccess: (result) => result.success,
			},
		);
	}

	/**
	 * Clear all operations without executing
	 */
	clear(): void {
		this.coreTransaction.clear();
		this.operationNames = [];
	}

	/**
	 * Get number of pending operations
	 */
	get pendingCount(): number {
		return this.coreTransaction.pendingCount;
	}

	/**
	 * Get number of completed operations
	 */
	get completedCount(): number {
		return this.coreTransaction.completedCount;
	}
}

/**
 * Convenience function to execute a transaction in one call
 *
 * @param operations - Array of rollback operations
 * @returns Transaction result
 *
 * @example
 * ```ts
 * const result = await executeTransaction([
 *   { name: 'op1', execute: async () => {}, rollback: async () => {} },
 *   { name: 'op2', execute: async () => {}, rollback: async () => {} }
 * ]);
 * ```
 */
export async function executeTransaction<T = void>(
	operations: readonly RollbackOperation[],
): Promise<TransactionResult<T>> {
	return observe(
		txLogger,
		"tx:executeTransaction",
		async () => {
			return coreExecuteTransaction<T>(operations, {
				logger: {
					debug: (message, context) =>
						txLogger.debug`${message} ${JSON.stringify(context ?? {})}`,
					error: (message, context) =>
						txLogger.error`${message} ${JSON.stringify(context ?? {})}`,
				},
			});
		},
		{
			context: {
				operationCount: operations.length,
				operationNames: operations.map((op) => op.name),
			},
			isSuccess: (result) => result.success,
		},
	);
}
