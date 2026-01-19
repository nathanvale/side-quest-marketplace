/**
 * Transaction abstraction with rollback support
 *
 * Executes a series of operations atomically, with automatic rollback
 * on failure. Ensures all-or-nothing semantics for multi-step operations.
 *
 * @module concurrency/transaction
 */

/**
 * Rollback operation definition
 */
export interface RollbackOperation {
	/** Operation name for logging */
	readonly name: string;
	/** Execute the operation, optionally returning rollback state */
	readonly execute: () => Promise<unknown>;
	/** Rollback the operation using captured state */
	readonly rollback: (result?: unknown) => Promise<void>;
}

/**
 * Transaction execution result (discriminated union)
 */
export type TransactionResult<T> =
	| { readonly success: true; readonly data: T }
	| {
			readonly success: false;
			readonly error: Error;
			readonly failedAt: string;
	  };

/**
 * Transaction executor with automatic rollback on failure.
 *
 * Executes operations sequentially, capturing rollback state.
 * On failure, rolls back all completed operations in reverse order.
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
	private operations: RollbackOperation[] = [];
	private completed: Array<{ op: RollbackOperation; result: unknown }> = [];

	/**
	 * Add an operation to the transaction
	 *
	 * @param operation - Operation with execute and rollback functions
	 */
	add(operation: RollbackOperation): void {
		this.operations.push(operation);
	}

	/**
	 * Execute all operations sequentially.
	 * Rolls back on any failure.
	 *
	 * @returns Transaction result with success flag and data/error
	 */
	async execute<T = void>(): Promise<TransactionResult<T>> {
		try {
			let lastResult: unknown;

			for (const op of this.operations) {
				const result = await op.execute();
				this.completed.push({ op, result });
				lastResult = result;
			}

			return { success: true, data: lastResult as T };
		} catch (error) {
			const failedOp = this.operations[this.completed.length];
			await this.rollback();
			return {
				success: false,
				error: error as Error,
				failedAt: failedOp?.name || "unknown",
			};
		}
	}

	/**
	 * Manually rollback all completed operations.
	 * Called automatically on execute() failure.
	 */
	private async rollback(): Promise<void> {
		// Rollback in reverse order
		for (const { op, result } of this.completed.reverse()) {
			try {
				await op.rollback(result);
			} catch (rollbackError) {
				// Log rollback errors but continue rolling back other operations
				// In core, we don't have logger, so we'll just emit to stderr
				const errorMessage =
					rollbackError instanceof Error
						? rollbackError.message
						: String(rollbackError);
				console.error(
					`Rollback failed for operation "${op.name}": ${errorMessage}`,
				);
			}
		}
		this.completed = [];
	}

	/**
	 * Clear all operations without executing
	 */
	clear(): void {
		this.operations = [];
		this.completed = [];
	}

	/**
	 * Get number of pending operations
	 */
	get pendingCount(): number {
		return this.operations.length;
	}

	/**
	 * Get number of completed operations
	 */
	get completedCount(): number {
		return this.completed.length;
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
	const tx = new Transaction();
	for (const op of operations) {
		tx.add(op);
	}
	return tx.execute<T>();
}
