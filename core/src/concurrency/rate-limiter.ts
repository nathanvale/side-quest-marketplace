/**
 * Simple time-based rate limiter.
 *
 * Ensures minimum delay between operations to respect API rate limits.
 * Uses wall-clock timing rather than token bucket for simplicity.
 *
 * @example
 * ```typescript
 * import { RateLimiter } from "@sidequest/core/concurrency";
 *
 * const limiter = new RateLimiter(2000); // 2s between requests
 *
 * for (const url of urls) {
 *   await limiter.wait();
 *   await fetch(url);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Check if ready without waiting
 * const limiter = new RateLimiter(1000);
 * if (limiter.getTimeUntilReady() === 0) {
 *   await makeRequest();
 * }
 * ```
 */
export class RateLimiter {
	private lastRequestTime = 0;
	private readonly minDelayMs: number;

	/**
	 * Creates a rate limiter with specified minimum delay.
	 *
	 * @param minDelayMs - Minimum milliseconds between operations (default: 2000)
	 */
	constructor(minDelayMs = 2000) {
		this.minDelayMs = minDelayMs;
	}

	/**
	 * Waits if necessary to respect rate limit.
	 *
	 * First call returns immediately. Subsequent calls wait until
	 * minimum delay has elapsed since the last call.
	 *
	 * @returns Promise that resolves when ready to proceed
	 */
	async wait(): Promise<void> {
		const now = Date.now();
		const elapsed = now - this.lastRequestTime;
		const remaining = this.minDelayMs - elapsed;

		if (remaining > 0) {
			await new Promise((resolve) => setTimeout(resolve, remaining));
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Resets the rate limiter state.
	 *
	 * Useful for testing or when starting a new batch of operations.
	 * Next call to wait() will proceed immediately.
	 */
	reset(): void {
		this.lastRequestTime = 0;
	}

	/**
	 * Gets time until next allowed request.
	 *
	 * @returns Milliseconds until ready (0 if ready now)
	 */
	getTimeUntilReady(): number {
		const now = Date.now();
		const elapsed = now - this.lastRequestTime;
		const remaining = this.minDelayMs - elapsed;
		return Math.max(0, remaining);
	}
}
