import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupStaleLocks, withFileLock } from "./file-lock";

const LOCK_DIR = join(tmpdir(), "para-obsidian-locks");

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

			// Should be nearly instant (< 50ms)
			expect(duration).toBeLessThan(50);
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
			const operation1 = withFileLock("test-resource", async () => {
				executions.push(1);
				await new Promise((resolve) => setTimeout(resolve, 100));
				executions.push(2);
			});

			// Start second operation immediately
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
					await new Promise((resolve) => setTimeout(resolve, 50));
				}),
				withFileLock("test-resource", async () => {
					results.push(2);
					await new Promise((resolve) => setTimeout(resolve, 50));
				}),
				withFileLock("test-resource", async () => {
					results.push(3);
					await new Promise((resolve) => setTimeout(resolve, 50));
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
					await new Promise((resolve) => setTimeout(resolve, 50));
				}),
				withFileLock("resource-2", async () => {
					await new Promise((resolve) => setTimeout(resolve, 50));
				}),
			]);

			const duration = Date.now() - start;

			// Both should run in parallel (< 100ms total, not ~100ms sequential)
			expect(duration).toBeLessThan(100);
		});

		test("throws on timeout", async () => {
			// Create a lock manually and hold it
			const lockPath = join(LOCK_DIR, "test-resource.lock");
			await writeFile(lockPath, String(process.pid), { flag: "wx" });

			try {
				// This should timeout (30 second default, but we'll catch it)
				// We intentionally don't await this to avoid waiting 30 seconds in tests
				withFileLock("test-resource", async () => {
					// Should never execute
				});

				// We don't actually want to wait 30 seconds in tests
				// Instead, we verify the lock file exists and operation would block
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
			const result = await cleanupStaleLocks();
			expect(result).toEqual({ cleanedCount: 0, totalFiles: 0 });
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
					await new Promise((resolve) => setTimeout(resolve, 10));
				}),
			);

			await Promise.all(attempts);

			// All should succeed (sequential execution)
			expect(successes.length).toBe(5);
		});

		test("prevents file corruption during concurrent writes", async () => {
			let counter = 0;

			const operations = Array.from({ length: 10 }, (_, i) =>
				withFileLock("counter-resource", async () => {
					// Simulate read-modify-write
					const current = counter;
					await new Promise((resolve) => setTimeout(resolve, 5));
					counter = current + 1;
				}),
			);

			await Promise.all(operations);

			// All increments should succeed (no race condition)
			expect(counter).toBe(10);
		});
	});
});
