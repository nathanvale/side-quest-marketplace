import { describe, expect, test } from "bun:test";
import { RateLimiter } from "./rate-limiter.js";

describe("RateLimiter", () => {
	describe("constructor", () => {
		test("uses default delay when not specified", () => {
			const limiter = new RateLimiter();
			expect(limiter.getTimeUntilReady()).toBe(0);
		});

		test("accepts custom delay value", () => {
			const limiter = new RateLimiter(5000);
			expect(limiter.getTimeUntilReady()).toBe(0);
		});
	});

	describe("wait", () => {
		test("allows first request immediately", async () => {
			const limiter = new RateLimiter(1000);
			const start = Date.now();
			await limiter.wait();
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(50); // Should be nearly instant
		});

		test("delays subsequent requests", async () => {
			const limiter = new RateLimiter(100); // Short delay for testing
			await limiter.wait(); // First request
			const start = Date.now();
			await limiter.wait(); // Second request should wait
			const elapsed = Date.now() - start;
			expect(elapsed).toBeGreaterThanOrEqual(90); // Should wait ~100ms (with tolerance)
		});

		test("respects minimum delay between multiple requests", async () => {
			const limiter = new RateLimiter(50);
			const timestamps: number[] = [];

			// Make 3 requests
			for (let i = 0; i < 3; i++) {
				await limiter.wait();
				timestamps.push(Date.now());
			}

			// Check intervals between requests
			for (let i = 1; i < timestamps.length; i++) {
				const current = timestamps[i];
				const previous = timestamps[i - 1];
				if (current !== undefined && previous !== undefined) {
					const interval = current - previous;
					expect(interval).toBeGreaterThanOrEqual(45); // ~50ms with tolerance
				}
			}
		});

		test("handles concurrent calls sequentially", async () => {
			const limiter = new RateLimiter(100);
			const timestamps: number[] = [];

			// Launch 3 wait calls sequentially (not concurrent)
			// Note: RateLimiter is designed for sequential use, not concurrent
			await limiter.wait();
			timestamps.push(Date.now());

			await limiter.wait();
			timestamps.push(Date.now());

			await limiter.wait();
			timestamps.push(Date.now());

			// Verify proper spacing
			const ts0 = timestamps[0];
			const ts1 = timestamps[1];
			const ts2 = timestamps[2];

			if (ts0 !== undefined && ts1 !== undefined && ts2 !== undefined) {
				const gap1 = ts1 - ts0;
				const gap2 = ts2 - ts1;

				expect(gap1).toBeGreaterThanOrEqual(90); // ~100ms with tolerance
				expect(gap2).toBeGreaterThanOrEqual(90); // ~100ms with tolerance
			}
		});

		test("updates last request time after each wait", async () => {
			const limiter = new RateLimiter(100);

			await limiter.wait();
			const timeUntilReady1 = limiter.getTimeUntilReady();
			expect(timeUntilReady1).toBeGreaterThan(90); // ~100ms remaining

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 50));

			const timeUntilReady2 = limiter.getTimeUntilReady();
			expect(timeUntilReady2).toBeLessThan(timeUntilReady1); // Time decreased
		});
	});

	describe("reset", () => {
		test("resets limiter to allow immediate request", async () => {
			const limiter = new RateLimiter(1000);

			await limiter.wait(); // First request
			expect(limiter.getTimeUntilReady()).toBeGreaterThan(0);

			limiter.reset();
			expect(limiter.getTimeUntilReady()).toBe(0);

			// Next wait should be immediate
			const start = Date.now();
			await limiter.wait();
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(50);
		});

		test("can be called multiple times", () => {
			const limiter = new RateLimiter(100);

			limiter.reset();
			limiter.reset();
			limiter.reset();

			expect(limiter.getTimeUntilReady()).toBe(0);
		});

		test("resets after partial wait", async () => {
			const limiter = new RateLimiter(1000);

			await limiter.wait();
			await new Promise((resolve) => setTimeout(resolve, 100));

			limiter.reset();
			expect(limiter.getTimeUntilReady()).toBe(0);
		});
	});

	describe("getTimeUntilReady", () => {
		test("returns 0 initially", () => {
			const limiter = new RateLimiter(1000);
			expect(limiter.getTimeUntilReady()).toBe(0);
		});

		test("returns remaining time after wait", async () => {
			const limiter = new RateLimiter(1000);

			await limiter.wait();
			const remaining = limiter.getTimeUntilReady();

			expect(remaining).toBeGreaterThan(950); // ~1000ms remaining
			expect(remaining).toBeLessThanOrEqual(1000);
		});

		test("decreases over time", async () => {
			const limiter = new RateLimiter(1000);

			await limiter.wait();
			const remaining1 = limiter.getTimeUntilReady();

			await new Promise((resolve) => setTimeout(resolve, 100));

			const remaining2 = limiter.getTimeUntilReady();

			expect(remaining2).toBeLessThan(remaining1);
			expect(remaining2).toBeGreaterThanOrEqual(0);
		});

		test("returns 0 after delay has elapsed", async () => {
			const limiter = new RateLimiter(50);

			await limiter.wait();
			await new Promise((resolve) => setTimeout(resolve, 60));

			expect(limiter.getTimeUntilReady()).toBe(0);
		});

		test("never returns negative values", async () => {
			const limiter = new RateLimiter(10);

			await limiter.wait();
			await new Promise((resolve) => setTimeout(resolve, 100)); // Wait much longer than delay

			expect(limiter.getTimeUntilReady()).toBe(0);
		});
	});

	describe("custom delay values", () => {
		test("works with very short delays", async () => {
			const limiter = new RateLimiter(10);

			await limiter.wait();
			await limiter.wait();

			// Should complete quickly (allow for timing precision)
			expect(limiter.getTimeUntilReady()).toBeLessThanOrEqual(10);
		});

		test("works with longer delays", async () => {
			const limiter = new RateLimiter(200);

			await limiter.wait();
			const remaining = limiter.getTimeUntilReady();

			expect(remaining).toBeGreaterThan(190);
			expect(remaining).toBeLessThanOrEqual(200);
		});

		test("works with zero delay", async () => {
			const limiter = new RateLimiter(0);

			const start = Date.now();
			await limiter.wait();
			await limiter.wait();
			await limiter.wait();
			const elapsed = Date.now() - start;

			// Should all be immediate
			expect(elapsed).toBeLessThan(50);
		});
	});

	describe("integration patterns", () => {
		test("rate limiting API calls in loop", async () => {
			const limiter = new RateLimiter(50);
			const calls: number[] = [];

			for (let i = 0; i < 3; i++) {
				await limiter.wait();
				calls.push(Date.now());
			}

			// Verify spacing between calls
			for (let i = 1; i < calls.length; i++) {
				const current = calls[i];
				const previous = calls[i - 1];
				if (current !== undefined && previous !== undefined) {
					const gap = current - previous;
					expect(gap).toBeGreaterThanOrEqual(45); // ~50ms with tolerance
				}
			}
		});

		test("checking readiness before calling", async () => {
			const limiter = new RateLimiter(100);
			let callCount = 0;

			// First call should be ready
			if (limiter.getTimeUntilReady() === 0) {
				callCount++;
			}

			await limiter.wait();

			// Second call should not be ready immediately
			if (limiter.getTimeUntilReady() === 0) {
				callCount++;
			}

			// Wait for rate limit
			await new Promise((resolve) => setTimeout(resolve, 110));

			// Third call should be ready again
			if (limiter.getTimeUntilReady() === 0) {
				callCount++;
			}

			expect(callCount).toBe(2); // First and third should be ready
		});

		test("batch processing with rate limiting", async () => {
			const limiter = new RateLimiter(30);
			const items = [1, 2, 3, 4];
			const processed: number[] = [];

			for (const item of items) {
				await limiter.wait();
				processed.push(item);
			}

			expect(processed).toEqual([1, 2, 3, 4]);
			expect(processed.length).toBe(4);
		});
	});
});
