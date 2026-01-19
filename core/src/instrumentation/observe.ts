/**
 * Operation observability utilities for wrapping functions with timing and logging.
 *
 * Provides `observe` and `observeSync` helpers that transparently add timing,
 * logging, and error handling to async and sync operations without changing
 * their return types.
 *
 * @module core/instrumentation/observe
 */

import { categorizeError } from "./error-category.js";

/**
 * Simple logger interface for observe utilities.
 *
 * Accepts any logger that provides `info` and `error` methods with structured
 * properties. Compatible with console, pino, winston, LogTape, etc.
 */
export interface ObserveLogger {
	/**
	 * Log an informational message with optional structured properties.
	 */
	info(message: string, properties?: Record<string, unknown>): void;

	/**
	 * Log an error message with optional structured properties.
	 */
	error(message: string, properties?: Record<string, unknown>): void;
}

/**
 * Options for observe/observeSync utilities.
 *
 * @template T - The return type of the observed operation
 */
export interface ObserveOptions<T> {
	/**
	 * Callback invoked on successful operation completion.
	 * Receives the result and duration in milliseconds.
	 */
	onSuccess?(result: T, durationMs: number): void;

	/**
	 * Callback invoked on operation failure.
	 * Receives the error and duration in milliseconds.
	 */
	onError?(error: unknown, durationMs: number): void;
}

/**
 * Adds observability to async operations without changing return type.
 *
 * Wraps an async function with:
 * - Timing (duration in milliseconds)
 * - Automatic success/error logging
 * - Error categorization (transient/permanent/configuration)
 * - Optional callbacks for custom handling
 *
 * Propagates errors after logging, so the caller sees the original error.
 *
 * @template T - The return type of the operation
 * @param logger - Logger instance for structured logging
 * @param operation - Operation name for log messages
 * @param fn - Async function to instrument
 * @param options - Optional callbacks for success/error cases
 * @returns Original return value (transparent to callers)
 * @throws Re-throws any error from the operation after logging
 *
 * @example
 * ```typescript
 * const result = await observe(
 *   logger,
 *   "loadConfig",
 *   async () => readFile("config.json"),
 *   {
 *     onSuccess: (config, ms) => metrics.recordLatency("config_load", ms),
 *     onError: (err, ms) => alerts.notify(`Config load failed: ${err}`)
 *   }
 * );
 * ```
 */
export async function observe<T>(
	logger: ObserveLogger,
	operation: string,
	fn: () => Promise<T>,
	options?: ObserveOptions<T>,
): Promise<T> {
	const startTime = Date.now();

	try {
		const result = await fn();
		const durationMs = Math.max(0, Date.now() - startTime);

		logger.info(`${operation} succeeded`, { durationMs });
		options?.onSuccess?.(result, durationMs);

		return result;
	} catch (error: unknown) {
		const durationMs = Math.max(0, Date.now() - startTime);
		const errorMessage = error instanceof Error ? error.message : String(error);
		const { category, code } = categorizeError(error);

		logger.error(`${operation} failed`, {
			error: errorMessage,
			errorCode: code,
			errorCategory: category,
			durationMs,
		});

		options?.onError?.(error, durationMs);

		throw error;
	}
}

/**
 * Sync version of observe for non-async operations.
 *
 * Same behavior as `observe()` but for synchronous functions.
 *
 * @template T - The return type of the operation
 * @param logger - Logger instance for structured logging
 * @param operation - Operation name for log messages
 * @param fn - Sync function to instrument
 * @param options - Optional callbacks for success/error cases
 * @returns Original return value (transparent to callers)
 * @throws Re-throws any error from the operation after logging
 *
 * @example
 * ```typescript
 * const config = observeSync(
 *   logger,
 *   "parseConfig",
 *   () => JSON.parse(configString),
 *   {
 *     onError: (err) => console.error("Parse failed:", err)
 *   }
 * );
 * ```
 */
export function observeSync<T>(
	logger: ObserveLogger,
	operation: string,
	fn: () => T,
	options?: ObserveOptions<T>,
): T {
	const startTime = Date.now();

	try {
		const result = fn();
		const durationMs = Math.max(0, Date.now() - startTime);

		logger.info(`${operation} succeeded`, { durationMs });
		options?.onSuccess?.(result, durationMs);

		return result;
	} catch (error: unknown) {
		const durationMs = Math.max(0, Date.now() - startTime);
		const errorMessage = error instanceof Error ? error.message : String(error);
		const { category, code } = categorizeError(error);

		logger.error(`${operation} failed`, {
			error: errorMessage,
			errorCode: code,
			errorCategory: category,
			durationMs,
		});

		options?.onError?.(error, durationMs);

		throw error;
	}
}
