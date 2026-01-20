import { describe, expect, test } from "bun:test";
import type { RollbackOperation } from "./transaction.js";
import { executeTransaction, Transaction } from "./transaction.js";

/**
 * Helper to create a simple operation for testing
 */
function createOperation(
	name: string,
	executeResult: unknown,
	onRollback?: () => unknown,
): RollbackOperation {
	return {
		name,
		execute: async () => executeResult,
		rollback: async () => {
			await onRollback?.();
		},
	};
}

/**
 * Helper to create a failing operation for testing
 */
function createFailingOperation(
	name: string,
	errorMessage: string,
	onRollback?: () => unknown,
): RollbackOperation {
	return {
		name,
		execute: async () => {
			throw new Error(errorMessage);
		},
		rollback: async () => {
			await onRollback?.();
		},
	};
}

/**
 * Helper to create an operation that tracks execution order
 */
function createTrackedOperation(
	name: string,
	executeResult: unknown,
	tracker: string[],
	onRollback?: () => void,
): RollbackOperation {
	return {
		name,
		execute: async () => {
			tracker.push(name);
			return executeResult;
		},
		rollback: async () => {
			onRollback?.();
		},
	};
}

describe("transaction", () => {
	describe("Transaction", () => {
		test("executes operations sequentially", async () => {
			const tx = new Transaction();
			const order: string[] = [];

			tx.add(createTrackedOperation("op1", "result1", order));
			tx.add(createTrackedOperation("op2", "result2", order));

			const result = await tx.execute<string>();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe("result2");
			}
			expect(order).toEqual(["op1", "op2"]);
		});

		test("returns success with last operation result", async () => {
			const tx = new Transaction();

			tx.add(createOperation("op1", { value: 1 }));
			tx.add(createOperation("op2", { value: 2 }));

			const result = await tx.execute<{ value: number }>();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ value: 2 });
			}
		});

		test("rolls back on failure", async () => {
			const tx = new Transaction();
			const rollbacks: string[] = [];

			tx.add(createOperation("op1", "result1", () => rollbacks.push("op1")));
			tx.add(
				createFailingOperation("op2", "op2 failed", () =>
					rollbacks.push("op2"),
				),
			);
			tx.add(createOperation("op3", "result3", () => rollbacks.push("op3")));

			const result = await tx.execute();

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toBe("op2 failed");
				expect(result.failedAt).toBe("op2");
			}
			// Only op1 should be rolled back (op2 failed, op3 never ran)
			expect(rollbacks).toEqual(["op1"]);
		});

		test("rollback receives operation result", async () => {
			const tx = new Transaction();
			let capturedResult: unknown;

			tx.add({
				name: "create-file",
				execute: async () => ({ path: "/tmp/test.txt", created: true }),
				rollback: async (result) => {
					capturedResult = result;
				},
			});

			tx.add({
				name: "fail",
				execute: async () => {
					throw new Error("Intentional failure");
				},
				rollback: async () => {},
			});

			await tx.execute();

			expect(capturedResult).toEqual({ path: "/tmp/test.txt", created: true });
		});

		test("rolls back in reverse order", async () => {
			const tx = new Transaction();
			const rollbackOrder: string[] = [];

			tx.add(
				createOperation("op1", undefined, () => rollbackOrder.push("op1")),
			);
			tx.add(
				createOperation("op2", undefined, () => rollbackOrder.push("op2")),
			);
			tx.add(
				createFailingOperation("op3", "fail", () => rollbackOrder.push("op3")),
			);

			await tx.execute();

			// Reverse order: op2, then op1 (op3 never completed)
			expect(rollbackOrder).toEqual(["op2", "op1"]);
		});

		test("continues rollback even if rollback fails", async () => {
			const tx = new Transaction();
			const rollbacks: string[] = [];

			tx.add(createOperation("op1", undefined, () => rollbacks.push("op1")));
			tx.add(
				createOperation("op2", undefined, () => {
					rollbacks.push("op2-start");
					throw new Error("Rollback failed");
				}),
			);
			tx.add(
				createFailingOperation("op3", "Execute failed", () =>
					rollbacks.push("op3"),
				),
			);

			await tx.execute();

			// All rollbacks attempted despite op2 rollback failing
			expect(rollbacks).toEqual(["op2-start", "op1"]);
		});

		test("clear removes all operations", () => {
			const tx = new Transaction();

			tx.add(createOperation("op1", undefined));
			tx.add(createOperation("op2", undefined));

			expect(tx.pendingCount).toBe(2);
			tx.clear();
			expect(tx.pendingCount).toBe(0);
		});

		test("tracks pending and completed counts", async () => {
			const tx = new Transaction();

			expect(tx.pendingCount).toBe(0);
			expect(tx.completedCount).toBe(0);

			tx.add(createOperation("op1", undefined));
			tx.add(createOperation("op2", undefined));

			expect(tx.pendingCount).toBe(2);
			expect(tx.completedCount).toBe(0);

			await tx.execute();

			expect(tx.completedCount).toBe(2);
		});

		test("handles empty transaction", async () => {
			const tx = new Transaction();
			const result = await tx.execute();

			expect(result.success).toBe(true);
		});

		test("accepts logger option", async () => {
			const logs: Array<{ type: string; message: string }> = [];
			const logger = {
				debug: (message: string) => logs.push({ type: "debug", message }),
				error: (message: string) => logs.push({ type: "error", message }),
			};

			const tx = new Transaction({ logger });
			tx.add(createOperation("op1", "result"));

			await tx.execute();

			expect(logs.some((l) => l.type === "debug")).toBe(true);
		});
	});

	describe("executeTransaction", () => {
		test("executes transaction in one call", async () => {
			const executed: string[] = [];

			const result = await executeTransaction<string>([
				createTrackedOperation("op1", "result1", executed),
				createTrackedOperation("op2", "result2", executed),
			]);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe("result2");
			}
			expect(executed).toEqual(["op1", "op2"]);
		});

		test("handles failure with rollback", async () => {
			const rollbacks: string[] = [];

			const result = await executeTransaction([
				createOperation("op1", undefined, () => rollbacks.push("op1")),
				createFailingOperation("op2", "failed", () => rollbacks.push("op2")),
			]);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toBe("failed");
				expect(result.failedAt).toBe("op2");
			}
			expect(rollbacks).toEqual(["op1"]);
		});

		test("accepts logger option", async () => {
			const logs: Array<{ type: string; message: string }> = [];
			const logger = {
				debug: (message: string) => logs.push({ type: "debug", message }),
				error: (message: string) => logs.push({ type: "error", message }),
			};

			await executeTransaction([createOperation("op1", "result")], { logger });

			expect(logs.some((l) => l.type === "debug")).toBe(true);
		});
	});

	describe("complex scenarios", () => {
		test("handles file operations with rollback", async () => {
			const files: Set<string> = new Set();

			const operations: RollbackOperation[] = [
				{
					name: "create-file-1",
					execute: async () => {
						files.add("file1.txt");
						return { path: "file1.txt" };
					},
					rollback: async (result) => {
						const { path } = result as { path: string };
						files.delete(path);
					},
				},
				{
					name: "create-file-2",
					execute: async () => {
						files.add("file2.txt");
						return { path: "file2.txt" };
					},
					rollback: async (result) => {
						const { path } = result as { path: string };
						files.delete(path);
					},
				},
				{
					name: "validate",
					execute: async () => {
						// Simulate validation failure
						throw new Error("Validation failed");
					},
					rollback: async () => {},
				},
			];

			const result = await executeTransaction(operations);

			expect(result.success).toBe(false);
			// All files should be cleaned up
			expect(files.size).toBe(0);
		});

		test("handles async rollback operations", async () => {
			const tx = new Transaction();
			const delays: number[] = [];

			tx.add(
				createOperation("op1", undefined, async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					delays.push(1);
				}),
			);
			tx.add(createFailingOperation("op2", "fail"));

			const start = Date.now();
			await tx.execute();
			const duration = Date.now() - start;

			// Rollback should have waited for async operation
			expect(delays).toEqual([1]);
			expect(duration).toBeGreaterThanOrEqual(10);
		});
	});
});
