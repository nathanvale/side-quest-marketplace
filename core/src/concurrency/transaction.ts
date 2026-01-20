/**
 * Transaction abstraction with rollback support.
 *
 * Executes a series of operations atomically, with automatic rollback
 * on failure. Ensures all-or-nothing semantics for multi-step operations.
 *
 * ## Features
 *
 * - **Sequential execution** of operations
 * - **Automatic rollback** in reverse order on failure
 * - **State capture** for rollback operations
 * - **Resilient rollback** - continues even if individual rollbacks fail
 *
 * @module core/concurrency/transaction
 */

/**
 * Rollback operation definition.
 *
 * Each operation has an execute function and a corresponding rollback function.
 * The rollback function receives the result of execute() to enable state-based cleanup.
 */
export interface RollbackOperation {
	/** Operation name for logging and error reporting */
	readonly name: string;

	/**
	 * Execute the operation.
	 * May return state needed for rollback (e.g., created file path).
	 */
	readonly execute: () => Promise<unknown>;

	/**
	 * Rollback the operation.
	 * Receives the result from execute() for state-based cleanup.
	 */
	readonly rollback: (result?: unknown) => Promise<void>;
}

/**
 * Transaction execution result (discriminated union).
 */
export type TransactionResult<T> =
	| { readonly success: true; readonly data: T }
	| {
			readonly success: false;
			readonly error: Error;
			readonly failedAt: string;
	  };

/**
 * Logger interface for transaction operations.
 */
export interface TransactionLogger {
	debug?(message: string, context?: Record<string, unknown>): void;
	error?(message: string, context?: Record<string, unknown>): void;
}

/**
 * Transaction executor with automatic rollback on failure.
 *
 * Executes operations sequentially, capturing state for rollback.
 * On failure, rolls back all completed operations in reverse order.
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 *
 * // Add operations
 * tx.add({
 *   name: "create-file",
 *   execute: async () => {
 *     await writeFile(path, content);
 *     return { path }; // State for rollback
 *   },
 *   rollback: async ({ path }) => {
 *     await unlink(path).catch(() => {});
 *   }
 * });
 *
 * tx.add({
 *   name: "update-registry",
 *   execute: async () => {
 *     const old = await readRegistry();
 *     await writeRegistry(newData);
 *     return { old }; // State for rollback
 *   },
 *   rollback: async ({ old }) => {
 *     await writeRegistry(old);
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
	private operations: RollbackOperation[] = [];
	private completed: Array<{ op: RollbackOperation; result: unknown }> = [];
	private logger?: TransactionLogger;

	/**
	 * Create a new transaction.
	 *
	 * @param options - Optional configuration
	 */
	constructor(options?: { logger?: TransactionLogger }) {
		this.logger = options?.logger;
	}

	/**
	 * Add an operation to the transaction.
	 *
	 * Operations are executed in the order they are added.
	 *
	 * @param operation - Operation with execute and rollback functions
	 */
	add(operation: RollbackOperation): void {
		this.operations.push(operation);
	}

	/**
	 * Execute all operations sequentially.
	 *
	 * On success, returns the result of the last operation.
	 * On failure, automatically rolls back all completed operations
	 * in reverse order, then returns the error.
	 *
	 * @template T - Type of the final operation result
	 * @returns Transaction result with success flag and data/error
	 */
	async execute<T = void>(): Promise<TransactionResult<T>> {
		this.logger?.debug?.("Transaction starting", {
			operationCount: this.operations.length,
			operationNames: this.operations.map((op) => op.name),
		});

		try {
			let lastResult: unknown;

			for (const op of this.operations) {
				this.logger?.debug?.("Executing operation", { name: op.name });
				const result = await op.execute();
				this.completed.push({ op, result });
				lastResult = result;
			}

			this.logger?.debug?.("Transaction succeeded", {
				completedCount: this.completed.length,
			});

			return { success: true, data: lastResult as T };
		} catch (error) {
			const failedOp = this.operations[this.completed.length];

			this.logger?.error?.("Transaction failed, rolling back", {
				failedAt: failedOp?.name || "unknown",
				completedCount: this.completed.length,
				error: error instanceof Error ? error.message : String(error),
			});

			await this.rollback();

			return {
				success: false,
				error: error as Error,
				failedAt: failedOp?.name || "unknown",
			};
		}
	}

	/**
	 * Rollback all completed operations in reverse order.
	 *
	 * Called automatically on execute() failure.
	 * Continues rolling back even if individual rollbacks fail.
	 */
	private async rollback(): Promise<void> {
		// Rollback in reverse order
		for (const { op, result } of this.completed.reverse()) {
			try {
				this.logger?.debug?.("Rolling back operation", { name: op.name });
				await op.rollback(result);
			} catch (rollbackError) {
				// Log but continue - we want to rollback as much as possible
				this.logger?.error?.("Rollback failed for operation", {
					name: op.name,
					error:
						rollbackError instanceof Error
							? rollbackError.message
							: String(rollbackError),
				});
			}
		}
		this.completed = [];
	}

	/**
	 * Clear all operations without executing.
	 *
	 * Useful for reusing a Transaction instance.
	 */
	clear(): void {
		this.operations = [];
		this.completed = [];
	}

	/**
	 * Get number of pending operations.
	 */
	get pendingCount(): number {
		return this.operations.length;
	}

	/**
	 * Get number of completed operations.
	 */
	get completedCount(): number {
		return this.completed.length;
	}
}

/**
 * Convenience function to execute a transaction in one call.
 *
 * @template T - Type of the final operation result
 * @param operations - Array of rollback operations
 * @param options - Optional configuration
 * @returns Transaction result
 *
 * @example
 * ```typescript
 * const result = await executeTransaction<string>([
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
 * if (result.success) {
 *   console.log("All operations completed:", result.data);
 * } else {
 *   console.error(`Failed at ${result.failedAt}:`, result.error);
 * }
 * ```
 */
export async function executeTransaction<T = void>(
	operations: readonly RollbackOperation[],
	options?: { logger?: TransactionLogger },
): Promise<TransactionResult<T>> {
	const tx = new Transaction(options);
	for (const op of operations) {
		tx.add(op);
	}
	return tx.execute<T>();
}
