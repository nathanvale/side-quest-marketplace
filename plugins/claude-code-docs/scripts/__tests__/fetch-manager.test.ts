import { describe, expect, mock, test } from "bun:test";
import { FetchManager } from "../lib/fetch-manager";

describe("FetchManager", () => {
	describe("fetchWithRetry", () => {
		test("successfully fetches on first attempt", async () => {
			const mockFetch = mock(() =>
				Promise.resolve({
					ok: true,
					text: () => Promise.resolve("success"),
				}),
			);
			globalThis.fetch = mockFetch as never;

			const manager = new FetchManager({
				maxRetries: 3,
				baseDelay: 100,
				maxDelay: 1000,
				rateLimit: 50,
			});

			const result = await manager.fetchWithRetry("https://example.com/test");

			expect(result).toBe("success");
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		test("retries on 500 error and eventually succeeds", async () => {
			let attemptCount = 0;
			const mockFetch = mock(() => {
				attemptCount++;
				if (attemptCount < 3) {
					return Promise.resolve({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
					});
				}
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve("success after retries"),
				});
			});
			globalThis.fetch = mockFetch as never;

			const manager = new FetchManager({
				maxRetries: 3,
				baseDelay: 10,
				maxDelay: 100,
				rateLimit: 5,
			});

			const result = await manager.fetchWithRetry("https://example.com/test");

			expect(result).toBe("success after retries");
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		test("does not retry on 404 error", async () => {
			const mockFetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 404,
					statusText: "Not Found",
				}),
			);
			globalThis.fetch = mockFetch as never;

			const manager = new FetchManager({
				maxRetries: 3,
				baseDelay: 10,
				maxDelay: 100,
				rateLimit: 5,
			});

			await expect(
				manager.fetchWithRetry("https://example.com/test"),
			).rejects.toThrow(/404 Not Found/);

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		test("throws after max retries exceeded", async () => {
			const mockFetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 503,
					statusText: "Service Unavailable",
				}),
			);
			globalThis.fetch = mockFetch as never;

			const manager = new FetchManager({
				maxRetries: 3,
				baseDelay: 10,
				maxDelay: 100,
				rateLimit: 5,
			});

			await expect(
				manager.fetchWithRetry("https://example.com/test"),
			).rejects.toThrow(/503 Service Unavailable/);

			expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
		});

		test("handles network errors with retries", async () => {
			let attemptCount = 0;
			const mockFetch = mock(() => {
				attemptCount++;
				if (attemptCount < 2) {
					return Promise.reject(new Error("Network error"));
				}
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve("success after network error"),
				});
			});
			globalThis.fetch = mockFetch as never;

			const manager = new FetchManager({
				maxRetries: 3,
				baseDelay: 10,
				maxDelay: 100,
				rateLimit: 5,
			});

			const result = await manager.fetchWithRetry("https://example.com/test");

			expect(result).toBe("success after network error");
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});

	describe("exponentialBackoff", () => {
		test("calculates delay with exponential backoff", () => {
			const manager = new FetchManager({
				maxRetries: 3,
				baseDelay: 1000,
				maxDelay: 10000,
				rateLimit: 200,
			});

			const delay0 = manager.exponentialBackoff(0);
			const delay1 = manager.exponentialBackoff(1);
			const delay2 = manager.exponentialBackoff(2);

			// Delay should increase exponentially
			expect(delay0).toBeGreaterThanOrEqual(1000);
			expect(delay0).toBeLessThanOrEqual(2000); // 1000 * 2^0 + jitter

			expect(delay1).toBeGreaterThanOrEqual(2000);
			expect(delay1).toBeLessThanOrEqual(3000); // 1000 * 2^1 + jitter

			expect(delay2).toBeGreaterThanOrEqual(4000);
			expect(delay2).toBeLessThanOrEqual(5000); // 1000 * 2^2 + jitter
		});

		test("respects maxDelay cap", () => {
			const manager = new FetchManager({
				maxRetries: 10,
				baseDelay: 1000,
				maxDelay: 5000,
				rateLimit: 200,
			});

			const delay = manager.exponentialBackoff(10); // Would be very large without cap

			expect(delay).toBeLessThanOrEqual(6000); // maxDelay + jitter
		});
	});
});
