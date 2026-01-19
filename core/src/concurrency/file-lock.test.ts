import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupStaleLocks, withFileLock } from "./file-lock.js";

describe("withFileLock", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `test-file-lock-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("executes operation with lock", async () => {
		const resourceId = "test-resource";
		let executed = false;

		await withFileLock(resourceId, async () => {
			executed = true;
		});

		expect(executed).toBe(true);
	});

	test("returns operation result", async () => {
		const result = await withFileLock("test-resource", async () => {
			return "success";
		});

		expect(result).toBe("success");
	});

	test("prevents concurrent access to same resource", async () => {
		const resourceId = "test-resource";
		const executionOrder: number[] = [];

		// Start two operations concurrently
		const operation1 = withFileLock(resourceId, async () => {
			executionOrder.push(1);
			await new Promise((resolve) => setTimeout(resolve, 100));
			executionOrder.push(2);
		});

		// Give first operation time to acquire lock
		await new Promise((resolve) => setTimeout(resolve, 10));

		const operation2 = withFileLock(resourceId, async () => {
			executionOrder.push(3);
		});

		await Promise.all([operation1, operation2]);

		// Second operation should only execute after first completes
		expect(executionOrder).toEqual([1, 2, 3]);
	});

	test("allows concurrent access to different resources", async () => {
		const executionOrder: number[] = [];

		const operation1 = withFileLock("resource-1", async () => {
			executionOrder.push(1);
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		const operation2 = withFileLock("resource-2", async () => {
			executionOrder.push(2);
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		await Promise.all([operation1, operation2]);

		// Both should execute concurrently (both start before either finishes)
		expect(executionOrder).toContain(1);
		expect(executionOrder).toContain(2);
	});

	test("releases lock on success", async () => {
		const resourceId = "test-resource";

		await withFileLock(resourceId, async () => {
			// Do nothing
		});

		// Second operation should succeed immediately (no timeout)
		const startTime = Date.now();
		await withFileLock(resourceId, async () => {
			// Do nothing
		});
		const duration = Date.now() - startTime;

		// Should be fast since lock was released
		expect(duration).toBeLessThan(1000);
	});

	test("releases lock on error", async () => {
		const resourceId = "test-resource";

		try {
			await withFileLock(resourceId, async () => {
				throw new Error("Operation failed");
			});
		} catch {
			// Expected
		}

		// Second operation should succeed (lock was released)
		let executed = false;
		await withFileLock(resourceId, async () => {
			executed = true;
		});

		expect(executed).toBe(true);
	});

	test("throws original error after releasing lock", async () => {
		const expectedError = new Error("Operation failed");

		try {
			await withFileLock("test-resource", async () => {
				throw expectedError;
			});
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBe(expectedError);
		}
	});

	test("detects and removes stale locks", async () => {
		const lockDir = join(tmpdir(), "sidequest-locks");
		await mkdir(lockDir, { recursive: true });

		// Create a lock file with a non-existent PID
		const staleLockPath = join(lockDir, "test-stale.lock");
		await writeFile(staleLockPath, "99999999"); // PID that doesn't exist

		// Operation should succeed despite stale lock
		let executed = false;
		await withFileLock("test-stale", async () => {
			executed = true;
		});

		expect(executed).toBe(true);
	});

	test("handles resource IDs with special characters", async () => {
		const resourceId = "test/resource:with-special.chars";

		let executed = false;
		await withFileLock(resourceId, async () => {
			executed = true;
		});

		expect(executed).toBe(true);
	});
});

describe("cleanupStaleLocks", () => {
	let lockDir: string;

	beforeEach(async () => {
		lockDir = join(tmpdir(), "sidequest-locks");
		await mkdir(lockDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(lockDir, { recursive: true, force: true });
	});

	test("removes stale lock files", async () => {
		// Create a stale lock (non-existent PID)
		const staleLockPath = join(lockDir, "test-stale.lock");
		await writeFile(staleLockPath, "99999999");

		const result = await cleanupStaleLocks();

		expect(result.cleanedCount).toBe(1);
		expect(result.totalFiles).toBe(1);

		// Verify lock was removed
		const lockExists = await readFile(staleLockPath, "utf-8").catch(() => null);
		expect(lockExists).toBe(null);
	});

	test("keeps valid lock files", async () => {
		// Create a valid lock (current process PID)
		const validLockPath = join(lockDir, "test-valid.lock");
		await writeFile(validLockPath, String(process.pid));

		const result = await cleanupStaleLocks();

		expect(result.cleanedCount).toBe(0);
		expect(result.totalFiles).toBe(1);

		// Verify lock still exists
		const lockContent = await readFile(validLockPath, "utf-8");
		expect(lockContent).toBe(String(process.pid));
	});

	test("handles empty lock directory", async () => {
		const result = await cleanupStaleLocks();

		expect(result.cleanedCount).toBe(0);
		expect(result.totalFiles).toBe(0);
	});

	test("handles non-existent lock directory", async () => {
		await rm(lockDir, { recursive: true, force: true });

		const result = await cleanupStaleLocks();

		expect(result.cleanedCount).toBe(0);
		expect(result.totalFiles).toBe(0);
	});

	test("ignores non-lock files", async () => {
		// Create a non-lock file
		const nonLockPath = join(lockDir, "not-a-lock.txt");
		await writeFile(nonLockPath, "some content");

		const result = await cleanupStaleLocks();

		expect(result.cleanedCount).toBe(0);
		expect(result.totalFiles).toBe(1);
	});

	test("cleans multiple stale locks", async () => {
		// Create multiple stale locks
		await writeFile(join(lockDir, "stale1.lock"), "99999991");
		await writeFile(join(lockDir, "stale2.lock"), "99999992");
		await writeFile(join(lockDir, "stale3.lock"), "99999993");

		const result = await cleanupStaleLocks();

		expect(result.cleanedCount).toBe(3);
		expect(result.totalFiles).toBe(3);
	});

	test("cleans only stale locks when mixed with valid", async () => {
		// Create mix of stale and valid locks
		await writeFile(join(lockDir, "stale.lock"), "99999999");
		await writeFile(join(lockDir, "valid.lock"), String(process.pid));

		const result = await cleanupStaleLocks();

		expect(result.cleanedCount).toBe(1);
		expect(result.totalFiles).toBe(2);

		// Verify valid lock still exists
		const validLockContent = await readFile(
			join(lockDir, "valid.lock"),
			"utf-8",
		);
		expect(validLockContent).toBe(String(process.pid));
	});
});
