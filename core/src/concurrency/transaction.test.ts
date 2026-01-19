import { describe, expect, test } from "bun:test";
import {
	executeTransaction,
	type RollbackOperation,
	Transaction,
} from "./transaction.js";

describe("Transaction", () => {
	test("executes single operation successfully", async () => {
		const tx = new Transaction();
		let executed = false;

		tx.add({
			name: "test-op",
			execute: async () => {
				executed = true;
			},
			rollback: async () => {},
		});

		const result = await tx.execute();

		expect(result.success).toBe(true);
		expect(executed).toBe(true);
	});

	test("executes multiple operations in order", async () => {
		const tx = new Transaction();
		const executionOrder: number[] = [];

		tx.add({
			name: "op1",
			execute: async () => {
				executionOrder.push(1);
			},
			rollback: async () => {},
		});

		tx.add({
			name: "op2",
			execute: async () => {
				executionOrder.push(2);
			},
			rollback: async () => {},
		});

		tx.add({
			name: "op3",
			execute: async () => {
				executionOrder.push(3);
			},
			rollback: async () => {},
		});

		await tx.execute();

		expect(executionOrder).toEqual([1, 2, 3]);
	});

	test("returns last operation result", async () => {
		const tx = new Transaction();

		tx.add({
			name: "op1",
			execute: async () => "first",
			rollback: async () => {},
		});

		tx.add({
			name: "op2",
			execute: async () => "last",
			rollback: async () => {},
		});

		const result = await tx.execute<string>();

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("last");
		}
	});

	test("rolls back on failure", async () => {
		const tx = new Transaction();
		const rollbackOrder: number[] = [];

		tx.add({
			name: "op1",
			execute: async () => {},
			rollback: async () => {
				rollbackOrder.push(1);
			},
		});

		tx.add({
			name: "op2",
			execute: async () => {},
			rollback: async () => {
				rollbackOrder.push(2);
			},
		});

		tx.add({
			name: "failing-op",
			execute: async () => {
				throw new Error("Operation failed");
			},
			rollback: async () => {
				rollbackOrder.push(3);
			},
		});

		const result = await tx.execute();

		expect(result.success).toBe(false);
		// Should rollback in reverse order, but failing op never completed
		expect(rollbackOrder).toEqual([2, 1]);
	});

	test("includes error details in result", async () => {
		const tx = new Transaction();
		const expectedError = new Error("Something went wrong");

		tx.add({
			name: "failing-op",
			execute: async () => {
				throw expectedError;
			},
			rollback: async () => {},
		});

		const result = await tx.execute();

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe(expectedError);
			expect(result.failedAt).toBe("failing-op");
		}
	});

	test("passes result to rollback function", async () => {
		const tx = new Transaction();
		let rollbackResult: unknown;

		tx.add({
			name: "op1",
			execute: async () => ({ value: 42 }),
			rollback: async (result) => {
				rollbackResult = result;
			},
		});

		tx.add({
			name: "failing-op",
			execute: async () => {
				throw new Error("Fail");
			},
			rollback: async () => {},
		});

		await tx.execute();

		expect(rollbackResult).toEqual({ value: 42 });
	});

	test("continues rollback even if rollback fails", async () => {
		const tx = new Transaction();
		const rollbackCalled: string[] = [];

		tx.add({
			name: "op1",
			execute: async () => {},
			rollback: async () => {
				rollbackCalled.push("op1");
			},
		});

		tx.add({
			name: "op2",
			execute: async () => {},
			rollback: async () => {
				rollbackCalled.push("op2");
				throw new Error("Rollback failed");
			},
		});

		tx.add({
			name: "op3",
			execute: async () => {},
			rollback: async () => {
				rollbackCalled.push("op3");
			},
		});

		tx.add({
			name: "failing-op",
			execute: async () => {
				throw new Error("Execute failed");
			},
			rollback: async () => {},
		});

		await tx.execute();

		// All rollbacks should be called despite op2 failing
		expect(rollbackCalled).toEqual(["op3", "op2", "op1"]);
	});

	test("clears operations and completed state", () => {
		const tx = new Transaction();

		tx.add({
			name: "op1",
			execute: async () => {},
			rollback: async () => {},
		});

		expect(tx.pendingCount).toBe(1);

		tx.clear();

		expect(tx.pendingCount).toBe(0);
		expect(tx.completedCount).toBe(0);
	});

	test("tracks pending and completed counts", async () => {
		const tx = new Transaction();

		expect(tx.pendingCount).toBe(0);
		expect(tx.completedCount).toBe(0);

		tx.add({
			name: "op1",
			execute: async () => {},
			rollback: async () => {},
		});

		tx.add({
			name: "op2",
			execute: async () => {},
			rollback: async () => {},
		});

		expect(tx.pendingCount).toBe(2);
		expect(tx.completedCount).toBe(0);

		await tx.execute();

		expect(tx.pendingCount).toBe(2); // Pending count doesn't change after execution
		expect(tx.completedCount).toBe(2);
	});

	test("resets completed count after rollback", async () => {
		const tx = new Transaction();

		tx.add({
			name: "op1",
			execute: async () => {},
			rollback: async () => {},
		});

		tx.add({
			name: "failing-op",
			execute: async () => {
				throw new Error("Fail");
			},
			rollback: async () => {},
		});

		await tx.execute();

		// After rollback, completed count should be reset
		expect(tx.completedCount).toBe(0);
	});

	test("handles empty transaction", async () => {
		const tx = new Transaction();

		const result = await tx.execute();

		expect(result.success).toBe(true);
	});
});

describe("executeTransaction", () => {
	test("executes operations successfully", async () => {
		const executionOrder: number[] = [];

		const operations: RollbackOperation[] = [
			{
				name: "op1",
				execute: async () => {
					executionOrder.push(1);
				},
				rollback: async () => {},
			},
			{
				name: "op2",
				execute: async () => {
					executionOrder.push(2);
				},
				rollback: async () => {},
			},
		];

		const result = await executeTransaction(operations);

		expect(result.success).toBe(true);
		expect(executionOrder).toEqual([1, 2]);
	});

	test("returns typed result", async () => {
		const operations: RollbackOperation[] = [
			{
				name: "op1",
				execute: async () => "success",
				rollback: async () => {},
			},
		];

		const result = await executeTransaction<string>(operations);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("success");
		}
	});

	test("handles failure with rollback", async () => {
		const rollbackCalled: string[] = [];

		const operations: RollbackOperation[] = [
			{
				name: "op1",
				execute: async () => {},
				rollback: async () => {
					rollbackCalled.push("op1");
				},
			},
			{
				name: "failing-op",
				execute: async () => {
					throw new Error("Failed");
				},
				rollback: async () => {},
			},
		];

		const result = await executeTransaction(operations);

		expect(result.success).toBe(false);
		expect(rollbackCalled).toEqual(["op1"]);
	});

	test("handles empty operations array", async () => {
		const result = await executeTransaction([]);

		expect(result.success).toBe(true);
	});
});

describe("Transaction - real-world scenarios", () => {
	test("file creation with rollback on failure", async () => {
		const tx = new Transaction();
		const createdFiles: string[] = [];
		const deletedFiles: string[] = [];

		// Simulate file creation
		tx.add({
			name: "create-file-1",
			execute: async () => {
				createdFiles.push("file1.txt");
				return { path: "file1.txt" };
			},
			rollback: async (result) => {
				const { path } = result as { path: string };
				deletedFiles.push(path);
			},
		});

		tx.add({
			name: "create-file-2",
			execute: async () => {
				createdFiles.push("file2.txt");
				return { path: "file2.txt" };
			},
			rollback: async (result) => {
				const { path } = result as { path: string };
				deletedFiles.push(path);
			},
		});

		tx.add({
			name: "create-file-3-fail",
			execute: async () => {
				throw new Error("Disk full");
			},
			rollback: async () => {},
		});

		const result = await tx.execute();

		expect(result.success).toBe(false);
		expect(createdFiles).toEqual(["file1.txt", "file2.txt"]);
		expect(deletedFiles).toEqual(["file2.txt", "file1.txt"]); // Reverse order
	});

	test("database-style transaction", async () => {
		// Simulate database records
		const records: Record<string, string> = {};

		const operations: RollbackOperation[] = [
			{
				name: "insert-user",
				execute: async () => {
					records.user = "john";
					return "user";
				},
				rollback: async (key) => {
					delete records[key as string];
				},
			},
			{
				name: "insert-profile",
				execute: async () => {
					records.profile = "john-profile";
					return "profile";
				},
				rollback: async (key) => {
					delete records[key as string];
				},
			},
			{
				name: "insert-settings",
				execute: async () => {
					throw new Error("Constraint violation");
				},
				rollback: async () => {},
			},
		];

		const result = await executeTransaction(operations);

		expect(result.success).toBe(false);
		// All records should be rolled back
		expect(Object.keys(records).length).toBe(0);
	});

	test("multi-step configuration update", async () => {
		const config = {
			feature1: false,
			feature2: false,
			feature3: false,
		};

		const operations: RollbackOperation[] = [
			{
				name: "enable-feature-1",
				execute: async () => {
					const oldValue = config.feature1;
					config.feature1 = true;
					return { key: "feature1", oldValue };
				},
				rollback: async (state) => {
					const { key, oldValue } = state as { key: string; oldValue: boolean };
					config[key as keyof typeof config] = oldValue;
				},
			},
			{
				name: "enable-feature-2",
				execute: async () => {
					const oldValue = config.feature2;
					config.feature2 = true;
					return { key: "feature2", oldValue };
				},
				rollback: async (state) => {
					const { key, oldValue } = state as { key: string; oldValue: boolean };
					config[key as keyof typeof config] = oldValue;
				},
			},
		];

		const result = await executeTransaction(operations);

		expect(result.success).toBe(true);
		expect(config.feature1).toBe(true);
		expect(config.feature2).toBe(true);
	});
});
