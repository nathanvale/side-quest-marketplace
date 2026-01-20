import { describe, expect, test } from "bun:test";
import { createTimeoutPromise, TimeoutError, withTimeout } from "./timeout.js";

// Helper to create a delayed promise
function delay<T>(ms: number, value: T): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Helper to create a promise that never resolves
function neverResolves(): Promise<never> {
	return new Promise(() => {
		// Never resolve or reject
	});
}

describe("timeout", () => {
	describe("TimeoutError", () => {
		test("has correct name and message", () => {
			const error = new TimeoutError("Test timeout", 5000);

			expect(error.name).toBe("TimeoutError");
			expect(error.message).toBe("Test timeout");
			expect(error.timeoutMs).toBe(5000);
		});

		test("is instanceof Error", () => {
			const error = new TimeoutError("Test timeout", 5000);

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(TimeoutError);
		});

		test("has stack trace", () => {
			const error = new TimeoutError("Test timeout", 5000);

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain("TimeoutError");
		});
	});

	describe("createTimeoutPromise", () => {
		test("rejects with TimeoutError after timeout", async () => {
			const promise = createTimeoutPromise(10);

			await expect(promise).rejects.toThrow(TimeoutError);
			await expect(promise).rejects.toThrow("Operation timed out after 10ms");
		});

		test("uses custom error message", async () => {
			const promise = createTimeoutPromise(10, "Custom timeout message");

			await expect(promise).rejects.toThrow("Custom timeout message");
		});

		test("includes timeout duration in error", async () => {
			try {
				await createTimeoutPromise(10);
				throw new Error("Should have thrown TimeoutError");
			} catch (error) {
				expect(error).toBeInstanceOf(TimeoutError);
				expect((error as TimeoutError).timeoutMs).toBe(10);
			}
		});

		test("rejects immediately with zero timeout", async () => {
			const start = Date.now();
			const promise = createTimeoutPromise(0);

			await expect(promise).rejects.toThrow(TimeoutError);

			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(50); // Should be nearly instant
		});
	});

	describe("withTimeout", () => {
		test("returns result when operation completes before timeout", async () => {
			const promise = delay(10, "success");

			const result = await withTimeout(promise, 100);

			expect(result).toBe("success");
		});

		test("returns correct type for complex values", async () => {
			const promise = delay(10, { value: 42, nested: { data: "test" } });

			const result = await withTimeout(promise, 100);

			expect(result).toEqual({ value: 42, nested: { data: "test" } });
		});

		test("throws TimeoutError when operation exceeds timeout", async () => {
			const promise = delay(100, "too slow");

			await expect(withTimeout(promise, 10)).rejects.toThrow(TimeoutError);
			await expect(withTimeout(promise, 10)).rejects.toThrow(
				"Operation timed out after 10ms",
			);
		});

		test("uses custom error message", async () => {
			const promise = delay(100, "too slow");

			await expect(
				withTimeout(promise, 10, "API call timed out"),
			).rejects.toThrow("API call timed out");
		});

		test("preserves original error if operation fails before timeout", async () => {
			const promise = Promise.reject(new Error("Original error"));

			await expect(withTimeout(promise, 100)).rejects.toThrow("Original error");
		});

		test("timeout error includes timeout duration", async () => {
			const promise = neverResolves();

			try {
				await withTimeout(promise, 10);
				throw new Error("Should have thrown TimeoutError");
			} catch (error) {
				expect(error).toBeInstanceOf(TimeoutError);
				expect((error as TimeoutError).timeoutMs).toBe(10);
			}
		});

		test("handles promise that never resolves", async () => {
			const promise = neverResolves();

			await expect(withTimeout(promise, 10)).rejects.toThrow(TimeoutError);
		});

		test("handles zero timeout", async () => {
			const promise = delay(10, "result");

			await expect(withTimeout(promise, 0)).rejects.toThrow(TimeoutError);
		});

		test("handles negative timeout", async () => {
			const promise = delay(10, "result");

			// setTimeout with negative values clamps to 0 in most JavaScript runtimes
			await expect(withTimeout(promise, -1)).rejects.toThrow(TimeoutError);
		});

		test("race condition: operation completes just before timeout", async () => {
			// Operation takes ~50ms, timeout is 60ms
			const promise = delay(50, "just in time");

			const result = await withTimeout(promise, 60);

			expect(result).toBe("just in time");
		});

		test("race condition: operation completes just after timeout", async () => {
			// Operation takes ~60ms, timeout is 50ms
			const promise = delay(60, "too late");

			await expect(withTimeout(promise, 50)).rejects.toThrow(TimeoutError);
		});

		test("multiple concurrent withTimeout calls", async () => {
			const fast = delay(10, "fast");
			const slow = delay(100, "slow");

			const results = await Promise.allSettled([
				withTimeout(fast, 50),
				withTimeout(slow, 50),
			]);

			expect(results[0].status).toBe("fulfilled");
			expect((results[0] as PromiseFulfilledResult<string>).value).toBe("fast");

			expect(results[1].status).toBe("rejected");
			expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(
				TimeoutError,
			);
		});

		test("timeout with async function that yields", async () => {
			const operation = async () => {
				await delay(10, undefined);
				await delay(10, undefined);
				return "done";
			};

			const result = await withTimeout(operation(), 50);

			expect(result).toBe("done");
		});

		test("timeout with operation that throws asynchronously", async () => {
			const operation = async () => {
				await delay(10, undefined);
				throw new Error("Async error");
			};

			await expect(withTimeout(operation(), 50)).rejects.toThrow("Async error");
		});
	});

	describe("integration patterns", () => {
		test("Promise.race with multiple timeout promises", async () => {
			const operation = delay(100, "result");
			const shortTimeout = createTimeoutPromise(20, "Short timeout");
			const longTimeout = createTimeoutPromise(50, "Long timeout");

			const result = await Promise.race([
				operation,
				shortTimeout,
				longTimeout,
			]).catch((error) => error);

			expect(result).toBeInstanceOf(TimeoutError);
			expect((result as TimeoutError).message).toBe("Short timeout");
		});

		test("nested withTimeout calls", async () => {
			const innerOperation = delay(10, "inner");
			const outerOperation = async () => {
				const result = await withTimeout(innerOperation, 50);
				return `outer(${result})`;
			};

			const result = await withTimeout(outerOperation(), 100);

			expect(result).toBe("outer(inner)");
		});

		test("timeout with retry pattern", async () => {
			let attempts = 0;
			const operation = async () => {
				attempts++;
				if (attempts < 3) {
					await delay(100, undefined); // Too slow
					return "success";
				}
				return "success"; // Fast on 3rd attempt
			};

			// First two attempts time out
			await expect(withTimeout(operation(), 50)).rejects.toThrow(TimeoutError);
			await expect(withTimeout(operation(), 50)).rejects.toThrow(TimeoutError);

			// Third attempt succeeds
			const result = await withTimeout(operation(), 50);
			expect(result).toBe("success");
			expect(attempts).toBe(3);
		});
	});
});
