/**
 * Timeout utilities for async operations.
 *
 * Provides Promise.race-based timeout patterns to prevent operations
 * from hanging indefinitely. Useful for external API calls, file I/O,
 * or any operation that may not have built-in timeout support.
 *
 * ## Features
 *
 * - **Promise.race timeout** - Reject if operation takes too long
 * - **Custom error type** - TimeoutError with timeout metadata
 * - **Helper utilities** - Create standalone timeout promises
 *
 * @module core/concurrency/timeout
 */

/**
 * Error thrown when an operation exceeds its timeout.
 *
 * Extends Error with timeout metadata for better debugging.
 */
export class TimeoutError extends Error {
	/**
	 * Create a timeout error.
	 *
	 * @param message - Error description
	 * @param timeoutMs - Timeout duration that was exceeded
	 */
	constructor(
		message: string,
		public readonly timeoutMs: number,
	) {
		super(message);
		this.name = "TimeoutError";
		// Maintain proper stack trace in V8 environments
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TimeoutError);
		}
	}
}

/**
 * Create a promise that rejects after the specified timeout.
 *
 * Useful for custom Promise.race scenarios where you need fine-grained
 * control over timeout behavior.
 *
 * @param timeoutMs - Timeout duration in milliseconds
 * @param message - Optional error message (default: "Operation timed out after {timeoutMs}ms")
 * @returns Promise that rejects with TimeoutError after timeout
 *
 * @example
 * ```typescript
 * const result = await Promise.race([
 *   fetchData(),
 *   createTimeoutPromise(5000, "Fetch timed out")
 * ]);
 * ```
 */
export function createTimeoutPromise(
	timeoutMs: number,
	message?: string,
): Promise<never> {
	return new Promise<never>((_, reject) => {
		setTimeout(() => {
			const errorMessage =
				message ?? `Operation timed out after ${timeoutMs}ms`;
			reject(new TimeoutError(errorMessage, timeoutMs));
		}, timeoutMs);
	});
}

/**
 * Wrap an async operation with a timeout.
 *
 * Uses Promise.race to reject if the operation takes too long.
 * The operation continues running in the background after timeout
 * (JavaScript doesn't support true cancellation), but the promise
 * will reject immediately.
 *
 * @template T - Return type of the operation
 * @param promise - Async operation to wrap
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param message - Optional error message (default: "Operation timed out after {timeoutMs}ms")
 * @returns Result of the operation if completed within timeout
 * @throws {TimeoutError} If operation exceeds timeout
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withTimeout(fetchData(), 5000);
 *
 * // Custom error message
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   "API call timed out"
 * );
 *
 * // Handle timeout errors
 * try {
 *   const result = await withTimeout(slowOperation(), 1000);
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.error(`Timed out after ${error.timeoutMs}ms`);
 *   }
 * }
 * ```
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	message?: string,
): Promise<T> {
	return Promise.race([promise, createTimeoutPromise(timeoutMs, message)]);
}
