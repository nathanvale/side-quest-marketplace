/**
 * Operation observability utilities for wrapping functions with timing and logging.
 *
 * Provides two API styles:
 *
 * 1. **Simple API** (`observe`/`observeSync`): Basic timing and logging with callbacks.
 *    Best for simple operations without correlation tracking.
 *
 * 2. **Context-aware API** (`observeWithContext`/`observeSyncWithContext`): Full
 *    W3C Trace Context support with automatic correlation ID propagation.
 *    Best for distributed tracing and multi-operation workflows.
 *
 * @module core/instrumentation/observe
 */

import {
	createTraceContext,
	getCurrentContext,
	runWithContext,
	type TraceContext,
} from "./context.js";
import { categorizeError } from "./error-category.js";
import { getLatencyBucket } from "./metrics.js";

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

// =============================================================================
// Context-aware Observability API
// =============================================================================

/**
 * Extended options for context-aware observe functions.
 *
 * @template T - The return type of the observed operation
 */
export interface ObserveWithContextOptions<T> {
	/**
	 * Custom success check for non-throwing failures.
	 * Use this when your function returns an error object instead of throwing.
	 */
	isSuccess?: (result: T) => boolean;

	/**
	 * Additional context to include in log messages.
	 * These properties are merged with the automatic trace context.
	 */
	context?: Record<string, unknown>;

	/**
	 * Explicit parent correlation ID.
	 * If not provided, inherits from AsyncLocalStorage context.
	 */
	parentCid?: string;

	/**
	 * Session-level correlation ID.
	 * If not provided, inherits from AsyncLocalStorage context.
	 */
	sessionCid?: string;
}

/**
 * Logger interface for context-aware observe functions.
 *
 * Accepts any logger that provides `info` and `error` methods.
 * Compatible with LogTape, pino, winston, console, etc.
 */
export interface ContextAwareLogger {
	/**
	 * Log an informational message with structured properties.
	 */
	info(message: string, properties: Record<string, unknown>): void;

	/**
	 * Log an error message with structured properties.
	 */
	error(message: string, properties: Record<string, unknown>): void;
}

/**
 * Adds observability to async operations with automatic trace context propagation.
 *
 * This is the recommended API for operations that need distributed tracing.
 * It automatically:
 * - Creates a new span (correlation ID) for the operation
 * - Links to parent span via AsyncLocalStorage or explicit parentCid
 * - Propagates context to nested operations
 * - Records timing, latency buckets, and error categorization
 *
 * @template T - The return type of the operation
 * @param logger - Logger instance for structured logging
 * @param operation - Operation name for log messages (e.g., "inbox:scan")
 * @param fn - Async function to instrument
 * @param options - Optional configuration for success criteria and context
 * @returns Original return value (transparent to callers)
 * @throws Re-throws any error from the operation after logging
 *
 * @example
 * ```typescript
 * // Basic usage - inherits context from parent
 * const result = await observeWithContext(
 *   logger,
 *   "inbox:processFile",
 *   async () => processFile(path),
 *   { context: { filePath: path } }
 * );
 *
 * // Nested operations automatically get linked spans
 * await observeWithContext(logger, "inbox:scan", async () => {
 *   // This operation's cid becomes the parent for nested calls
 *   await observeWithContext(logger, "inbox:processFile", async () => {
 *     // getCurrentContext() returns { cid: "...", parentCid: "scan's cid" }
 *   });
 * });
 * ```
 */
export async function observeWithContext<T>(
	logger: ContextAwareLogger,
	operation: string,
	fn: () => Promise<T>,
	options?: ObserveWithContextOptions<T>,
): Promise<T> {
	// Create trace context, inheriting from current context if available
	const currentContext = getCurrentContext();
	const traceContext = createTraceContext({
		parentCid: options?.parentCid ?? currentContext?.cid,
		sessionCid: options?.sessionCid ?? currentContext?.sessionCid,
	});

	const startTime = Date.now();

	// Run operation within trace context for automatic propagation
	return runWithContext(traceContext, async () => {
		try {
			const result = await fn();
			const durationMs = Math.max(0, Date.now() - startTime);
			const success = options?.isSuccess ? options.isSuccess(result) : true;

			logger.info(`${operation} ${success ? "succeeded" : "failed"}`, {
				cid: traceContext.cid,
				...(traceContext.parentCid && { parentCid: traceContext.parentCid }),
				...(traceContext.sessionCid && { sessionCid: traceContext.sessionCid }),
				operation,
				durationMs,
				latencyBucket: getLatencyBucket(durationMs),
				success,
				timestamp: new Date().toISOString(),
				...options?.context,
			});

			return result;
		} catch (error: unknown) {
			const durationMs = Math.max(0, Date.now() - startTime);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			const { category, code } = categorizeError(error);

			logger.error(`${operation} failed`, {
				cid: traceContext.cid,
				...(traceContext.parentCid && { parentCid: traceContext.parentCid }),
				...(traceContext.sessionCid && { sessionCid: traceContext.sessionCid }),
				operation,
				durationMs,
				latencyBucket: getLatencyBucket(durationMs),
				success: false,
				timestamp: new Date().toISOString(),
				error: errorMessage,
				errorCode: code,
				errorCategory: category,
				stack: errorStack,
				...options?.context,
			});

			throw error;
		}
	});
}

/**
 * Sync version of observeWithContext for non-async operations.
 *
 * Same behavior as `observeWithContext()` but for synchronous functions.
 *
 * @template T - The return type of the operation
 * @param logger - Logger instance for structured logging
 * @param operation - Operation name for log messages
 * @param fn - Sync function to instrument
 * @param options - Optional configuration for success criteria and context
 * @returns Original return value (transparent to callers)
 * @throws Re-throws any error from the operation after logging
 *
 * @example
 * ```typescript
 * const config = observeSyncWithContext(
 *   logger,
 *   "config:parse",
 *   () => JSON.parse(configString),
 *   { context: { configPath } }
 * );
 * ```
 */
export function observeSyncWithContext<T>(
	logger: ContextAwareLogger,
	operation: string,
	fn: () => T,
	options?: ObserveWithContextOptions<T>,
): T {
	// Create trace context, inheriting from current context if available
	const currentContext = getCurrentContext();
	const traceContext = createTraceContext({
		parentCid: options?.parentCid ?? currentContext?.cid,
		sessionCid: options?.sessionCid ?? currentContext?.sessionCid,
	});

	const startTime = Date.now();

	// Run operation within trace context for automatic propagation
	return runWithContext(traceContext, () => {
		try {
			const result = fn();
			const durationMs = Math.max(0, Date.now() - startTime);
			const success = options?.isSuccess ? options.isSuccess(result) : true;

			logger.info(`${operation} ${success ? "succeeded" : "failed"}`, {
				cid: traceContext.cid,
				...(traceContext.parentCid && { parentCid: traceContext.parentCid }),
				...(traceContext.sessionCid && { sessionCid: traceContext.sessionCid }),
				operation,
				durationMs,
				latencyBucket: getLatencyBucket(durationMs),
				success,
				timestamp: new Date().toISOString(),
				...options?.context,
			});

			return result;
		} catch (error: unknown) {
			const durationMs = Math.max(0, Date.now() - startTime);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			const { category, code } = categorizeError(error);

			logger.error(`${operation} failed`, {
				cid: traceContext.cid,
				...(traceContext.parentCid && { parentCid: traceContext.parentCid }),
				...(traceContext.sessionCid && { sessionCid: traceContext.sessionCid }),
				operation,
				durationMs,
				latencyBucket: getLatencyBucket(durationMs),
				success: false,
				timestamp: new Date().toISOString(),
				error: errorMessage,
				errorCode: code,
				errorCategory: category,
				stack: errorStack,
				...options?.context,
			});

			throw error;
		}
	});
}

/**
 * Get the current trace context.
 *
 * Re-exported from context module for convenience.
 * Returns undefined if not running within an observe context.
 */
export { getCurrentContext, type TraceContext };
