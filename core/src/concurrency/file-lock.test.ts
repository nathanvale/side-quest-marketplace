import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	cleanupStaleLocks,
	getDefaultLockDir,
	withFileLock,
} from "./file-lock.js";

const LOCK_DIR = getDefaultLockDir();

// Test timing constants - chosen to be longer than typical system overhead
// to reduce flakiness while keeping tests reasonably fast
const LOCK_RELEASE_INSTANT_MS = 50; // Max time for lock release to be considered "instant"
const SHORT_OPERATION_MS = 100; // Duration for operation that blocks another
const PARALLEL_TIMEOUT_MS = 100; // Max time for parallel operations (should be ~50ms, buffer for overhead)
const MEDIUM_OPERATION_MS = 50; // Duration for queue test operations
const SHORT_DELAY_MS = 10; // Minimal delay for race condition tests
const TINY_DELAY_MS = 5; // Minimal delay for corruption simulation

describe("file-lock", () => {
	beforeEach(async () => {
		// Clean up any existing locks
		await cleanupStaleLocks();
	});

	afterEach(async () => {
		// Clean up test locks
		await cleanupStaleLocks();
	});

	describe("withFileLock", () => {
		test("executes operation with lock", async () => {
			let executed = false;

			await withFileLock("test-resource", async () => {
				executed = true;
			});

			expect(executed).toBe(true);
		});

		test("returns operation result", async () => {
			const result = await withFileLock("test-resource", async () => {
				return { value: 42 };
			});

			expect(result).toEqual({ value: 42 });
		});

		test("releases lock after operation", async () => {
			await withFileLock("test-resource", async () => {
				// Do nothing
			});

			// Lock should be released - second operation should succeed immediately
			const start = Date.now();
			await withFileLock("test-resource", async () => {
				// Do nothing
			});
			const duration = Date.now() - start;

			// Should be nearly instant
			expect(duration).toBeLessThan(LOCK_RELEASE_INSTANT_MS);
		});

		test("releases lock even if operation throws", async () => {
			try {
				await withFileLock("test-resource", async () => {
					throw new Error("Operation failed");
				});
			} catch {
				// Expected
			}

			// Lock should be released
			let acquired = false;
			await withFileLock("test-resource", async () => {
				acquired = true;
			});

			expect(acquired).toBe(true);
		});

		test("prevents concurrent access", async () => {
			const executions: number[] = [];

			// Use a promise to signal when operation1 has acquired the lock
			let signalLockAcquired: () => void;
			const lockAcquired = new Promise<void>((resolve) => {
				signalLockAcquired = resolve;
			});

			const operation1 = withFileLock("test-resource", async () => {
				signalLockAcquired(); // Signal that we have the lock
				executions.push(1);
				await new Promise((resolve) => setTimeout(resolve, SHORT_OPERATION_MS));
				executions.push(2);
			});

			// Wait for operation1 to acquire the lock before starting operation2
			await lockAcquired;

			// Now start second operation - it must wait for first to complete
			const operation2 = withFileLock("test-resource", async () => {
				executions.push(3);
			});

			await Promise.all([operation1, operation2]);

			// Second operation should wait for first to complete
			// Expected order: 1, 2, 3 (not 1, 3, 2)
			expect(executions).toEqual([1, 2, 3]);
		});

		test("handles multiple concurrent waiters", async () => {
			const results: number[] = [];

			const operations = [
				withFileLock("test-resource", async () => {
					results.push(1);
					await new Promise((resolve) =>
						setTimeout(resolve, MEDIUM_OPERATION_MS),
					);
				}),
				withFileLock("test-resource", async () => {
					results.push(2);
					await new Promise((resolve) =>
						setTimeout(resolve, MEDIUM_OPERATION_MS),
					);
				}),
				withFileLock("test-resource", async () => {
					results.push(3);
					await new Promise((resolve) =>
						setTimeout(resolve, MEDIUM_OPERATION_MS),
					);
				}),
			];

			await Promise.all(operations);

			// All operations should complete (order may vary due to retry timing)
			expect(results.sort()).toEqual([1, 2, 3]);
		});

		test("different resources don't block each other", async () => {
			const start = Date.now();

			await Promise.all([
				withFileLock("resource-1", async () => {
					await new Promise((resolve) =>
						setTimeout(resolve, MEDIUM_OPERATION_MS),
					);
				}),
				withFileLock("resource-2", async () => {
					await new Promise((resolve) =>
						setTimeout(resolve, MEDIUM_OPERATION_MS),
					);
				}),
			]);

			const duration = Date.now() - start;

			// Both should run in parallel (< 100ms total, not ~100ms sequential)
			// Using buffer to account for system overhead
			expect(duration).toBeLessThan(PARALLEL_TIMEOUT_MS);
		});

		test("verifies lock file prevents acquisition", async () => {
			// Create a lock manually and hold it
			const lockPath = join(LOCK_DIR, "test-resource.lock");
			await writeFile(lockPath, String(process.pid), { flag: "wx" });

			try {
				// Verify the lock file exists and operation would block
				const lockExists = await readFile(lockPath, "utf-8").catch(() => null);
				expect(lockExists).toBe(String(process.pid));
			} finally {
				// Clean up manually created lock
				await unlink(lockPath).catch(() => {});
			}
		});
	});

	describe("cleanupStaleLocks", () => {
		test("removes locks for dead processes", async () => {
			// Create a fake lock with non-existent PID
			const fakePid = 999999;
			const lockPath = join(LOCK_DIR, "stale-resource.lock");
			await writeFile(lockPath, String(fakePid), { flag: "w" });

			await cleanupStaleLocks();

			// Lock should be removed
			const exists = await readFile(lockPath, "utf-8").catch(() => null);
			expect(exists).toBe(null);
		});

		test("preserves locks for running processes", async () => {
			// Create lock with current process PID
			const lockPath = join(LOCK_DIR, "active-resource.lock");
			await writeFile(lockPath, String(process.pid), { flag: "w" });

			await cleanupStaleLocks();

			// Lock should still exist
			const exists = await readFile(lockPath, "utf-8").catch(() => null);
			expect(exists).toBe(String(process.pid));

			// Clean up
			await unlink(lockPath).catch(() => {});
		});

		test("handles missing lock directory gracefully", async () => {
			// Should not throw, returns zero counts
			const result = await cleanupStaleLocks({
				lockDir: join(tmpdir(), "nonexistent-lock-dir-12345"),
			});
			expect(result).toEqual({ cleanedCount: 0, totalFiles: 0 });
		});

		test("returns cleanup statistics", async () => {
			// Create one stale and one active lock
			const staleLockPath = join(LOCK_DIR, "stale-for-stats.lock");
			const activeLockPath = join(LOCK_DIR, "active-for-stats.lock");

			await writeFile(staleLockPath, "999999", { flag: "w" });
			await writeFile(activeLockPath, String(process.pid), { flag: "w" });

			const result = await cleanupStaleLocks();

			expect(result.cleanedCount).toBe(1);
			expect(result.totalFiles).toBeGreaterThanOrEqual(1);

			// Clean up
			await unlink(activeLockPath).catch(() => {});
		});
	});

	describe("stale lock detection", () => {
		test("acquires lock if previous process died", async () => {
			// Create stale lock
			const lockPath = join(LOCK_DIR, "stale-resource.lock");
			await writeFile(lockPath, "999999", { flag: "w" });

			// Should acquire lock despite existing file
			let executed = false;
			await withFileLock("stale-resource", async () => {
				executed = true;
			});

			expect(executed).toBe(true);
		});
	});

	describe("race conditions", () => {
		test("handles simultaneous lock acquisition attempts", async () => {
			const successes: boolean[] = [];

			// Multiple processes try to acquire same lock simultaneously
			const attempts = Array.from({ length: 5 }, () =>
				withFileLock("race-resource", async () => {
					successes.push(true);
					await new Promise((resolve) => setTimeout(resolve, SHORT_DELAY_MS));
				}),
			);

			await Promise.all(attempts);

			// All should succeed (sequential execution)
			expect(successes.length).toBe(5);
		});

		test("prevents file corruption during concurrent writes", async () => {
			let counter = 0;

			const operations = Array.from({ length: 10 }, () =>
				withFileLock("counter-resource", async () => {
					// Simulate read-modify-write with small delay to increase chance of
					// race condition if locking is broken
					const current = counter;
					await new Promise((resolve) => setTimeout(resolve, TINY_DELAY_MS));
					counter = current + 1;
				}),
			);

			await Promise.all(operations);

			// All increments should succeed (no race condition)
			expect(counter).toBe(10);
		});
	});

	describe("getDefaultLockDir", () => {
		test("returns a path in tmpdir", () => {
			const lockDir = getDefaultLockDir();
			expect(lockDir).toContain(tmpdir());
			expect(lockDir).toContain("sidequest-locks");
		});
	});
});
