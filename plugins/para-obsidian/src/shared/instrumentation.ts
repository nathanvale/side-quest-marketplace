/**
 * Observability and Instrumentation Module
 *
 * LOGGING POLICY:
 *
 * Log Levels:
 * - debug: Detailed diagnostic info for development/troubleshooting (e.g., internal state, function entry/exit)
 * - info: High-level operation lifecycle events (e.g., scan started, file processed, operation completed)
 * - warn: Recoverable issues or performance degradation (e.g., slow operations, fallback used, threshold exceeded)
 * - error: Operation failures that prevent expected outcome (e.g., file not found, LLM timeout, validation failure)
 *
 * Required Fields (ALL logs):
 * - cid: Correlation ID for linking related operations
 * - timestamp: ISO 8601 timestamp for event ordering
 * - event: Descriptive event name (lowercase_snake_case, e.g., "scan_started", "file_processed")
 *
 * Format:
 * - ALWAYS use native LogTape structured logging: logger.info("Message", { event: "...", cid, ... })
 * - NEVER use logJson() - it returns a string, causing LogTape to see {} as placeholders
 * - Use observe()/observeSync() for automatic instrumentation of operations
 *
 * Security & Privacy:
 * - NEVER log user content (prompts, file contents, extracted text)
 * - NEVER log sensitive data (credentials, tokens, personal info)
 * - OK to log: filenames, durations, counts, error codes, operation types
 * - Use sanitization when logging user-provided strings (see sanitizeForLog())
 *
 * Correlation Tracking:
 * - Session-level: sessionCid (passed through scan/execute operations)
 * - Operation-level: cid (unique per file/suggestion processing)
 * - Use parentCid in observe() to link nested operations
 *
 * @module shared/instrumentation
 */

import type { Logger } from "@logtape/logtape";
import {
	getCurrentContext as coreGetCurrentContext,
	createTraceContext,
	getLatencyBucket,
	incrementCounter,
	observeHistogram,
	runWithContext,
	type TraceContext,
} from "@sidequest/core/instrumentation";
import { createCorrelationId, type SUBSYSTEMS } from "./logger.js";

/**
 * Get the current correlation context from AsyncLocalStorage.
 * Returns undefined if not running within an observe/observeSync context.
 *
 * This is useful for manual correlation tracking in code that doesn't use observe/observeSync.
 *
 * Now delegates to core's context utilities for cross-plugin trace propagation.
 */
export function getCurrentContext():
	| { cid: string; parentCid?: string }
	| undefined {
	const ctx = coreGetCurrentContext();
	if (!ctx) return undefined;
	return { cid: ctx.cid, parentCid: ctx.parentCid };
}

// Re-export core context utilities for plugins that want full TraceContext
export {
	createTraceContext,
	coreGetCurrentContext as getCoreContext,
	runWithContext,
	type TraceContext,
};

/** Message format required for MetricsCollector compatibility */
const MCP_TOOL_RESPONSE = "MCP tool response" as const;

/** Internal fields that cannot be overridden by context */
type ReservedFields =
	| "cid"
	| "tool"
	| "durationMs"
	| "latencyBucket"
	| "success"
	| "timestamp";

/** Error codes for incident triage and categorization */
export type ErrorCode =
	| "NETWORK_ERROR"
	| "TIMEOUT"
	| "NOT_FOUND"
	| "VALIDATION"
	| "PERMISSION"
	| "CONFLICT"
	| "INTERNAL";

/** Error category for alerting and retry logic */
export type ErrorCategory = "transient" | "permanent" | "configuration";

/**
 * Categorize an error by its type/message for incident triage.
 * Returns a structured error code that can be used for filtering and alerting.
 */
export function categorizeError(error: unknown): ErrorCode {
	if (!(error instanceof Error)) return "INTERNAL";

	const msg = error.message.toLowerCase();

	// Network errors (transient)
	if (
		msg.includes("econnrefused") ||
		msg.includes("enotfound") ||
		msg.includes("network") ||
		msg.includes("fetch failed")
	) {
		return "NETWORK_ERROR";
	}

	// Timeout errors (transient)
	if (msg.includes("timeout") || msg.includes("timed out")) {
		return "TIMEOUT";
	}

	// Not found errors (permanent)
	if (
		msg.includes("not found") ||
		msg.includes("enoent") ||
		msg.includes("no such file")
	) {
		return "NOT_FOUND";
	}

	// Validation errors (permanent)
	if (
		msg.includes("invalid") ||
		msg.includes("validation") ||
		msg.includes("must be") ||
		msg.includes("required")
	) {
		return "VALIDATION";
	}

	// Permission errors (configuration)
	if (
		msg.includes("permission") ||
		msg.includes("eacces") ||
		msg.includes("eperm") ||
		msg.includes("unauthorized")
	) {
		return "PERMISSION";
	}

	// Conflict errors (permanent)
	if (msg.includes("conflict") || msg.includes("already exists")) {
		return "CONFLICT";
	}

	return "INTERNAL";
}

/**
 * Get the error category for retry/alerting logic.
 * - transient: Retry may succeed (network, timeout)
 * - permanent: Retry will not help (not found, validation, conflict)
 * - configuration: Requires config change (permission)
 */
export function getErrorCategory(error: unknown): ErrorCategory {
	const code = categorizeError(error);

	switch (code) {
		case "NETWORK_ERROR":
		case "TIMEOUT":
			return "transient";
		case "PERMISSION":
			return "configuration";
		default:
			return "permanent";
	}
}

/** Branded type enforcing subsystem prefix pattern */
type ToolName = `${(typeof SUBSYSTEMS)[number]}:${string}`;

/**
 * Options for observe/observeSync utilities.
 */
export interface ObserveOptions<T> {
	/** Custom success check for non-throwing failures (e.g., functions returning error objects) */
	isSuccess?: (result: T) => boolean;
	/** Additional context to log (cannot override internal fields) */
	context?: Omit<Record<string, unknown>, ReservedFields>;
	/** Parent correlation ID for trace hierarchy - links nested operations */
	parentCid?: string;
}

/**
 * Safe logging wrapper that prevents logging failures from crashing operations.
 * All logger calls are wrapped in try-catch with console fallback.
 *
 * @param fn - Logging function to execute
 */
function safeLog(fn: () => void): void {
	try {
		fn();
	} catch (error) {
		// Fallback to console if logging fails
		try {
			console.error("[instrumentation] Logging failed:", error);
		} catch {
			// Silent fallback - logging is completely broken
		}
	}
}

/**
 * Adds observability to async operations WITHOUT changing return type.
 * Uses "MCP tool response" message format for MetricsCollector compatibility.
 *
 * Automatic correlation tracking:
 * - Uses AsyncLocalStorage for automatic parent-child CID propagation
 * - Manual parentCid in options takes precedence over AsyncLocalStorage
 * - All nested operations automatically inherit the current operation's CID as parent
 *
 * Required properties for session summaries:
 * - tool: Tool name with subsystem prefix
 * - durationMs: Execution time in milliseconds
 * - latencyBucket: Histogram bucket for percentile tracking (e.g., "0-10ms", "100-250ms")
 * - success: Operation success flag
 *
 * @template T - The return type of the operation
 * @param logger - Subsystem logger to use (e.g., templatesLogger)
 * @param tool - Tool name with subsystem prefix: "subsystem:operationName"
 * @param operation - Async function to instrument
 * @param options - Optional success criteria and additional context
 * @returns Original return value (transparent to callers)
 * @throws Re-throws any error from the operation after logging
 *
 * @example
 * ```typescript
 * const templates = await observe(
 *   templatesLogger,
 *   "templates:loadTemplates",
 *   async () => loadFromDisk(vaultPath),
 *   { context: { vaultPath } }
 * );
 * ```
 */
export async function observe<T>(
	logger: Logger,
	tool: ToolName,
	operation: () => Promise<T>,
	options?: ObserveOptions<T>,
): Promise<T> {
	const cid = createCorrelationId();
	// Priority: explicit parentCid > AsyncLocalStorage > undefined
	const currentContext = getCurrentContext();
	const parentCid = options?.parentCid ?? currentContext?.cid;
	const startTime = Date.now();

	// Create trace context for automatic propagation via core utilities
	const traceContext = createTraceContext({ cid, parentCid });

	// Run operation within core's context for automatic propagation
	return runWithContext(traceContext, async () => {
		try {
			const result = await operation();
			const durationMs = Math.max(0, Date.now() - startTime);
			const success = options?.isSuccess ? options.isSuccess(result) : true;

			safeLog(() => {
				logger.info(MCP_TOOL_RESPONSE, {
					cid,
					...(parentCid && { parentCid }),
					tool,
					durationMs,
					latencyBucket: getLatencyBucket(durationMs),
					success,
					timestamp: new Date().toISOString(),
					...options?.context,
				});
			});

			// Record metrics
			incrementCounter("operations_total", { tool, success });
			observeHistogram("operation_duration_seconds", durationMs / 1000, {
				tool,
			});

			return result;
		} catch (error: unknown) {
			const durationMs = Math.max(0, Date.now() - startTime);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			const errorCode = categorizeError(error);
			const errorCategory = getErrorCategory(error);

			safeLog(() => {
				logger.error(MCP_TOOL_RESPONSE, {
					cid,
					...(parentCid && { parentCid }),
					tool,
					durationMs,
					latencyBucket: getLatencyBucket(durationMs),
					success: false,
					timestamp: new Date().toISOString(),
					error: errorMessage,
					errorCode,
					errorCategory,
					stack: errorStack,
					...options?.context,
				});
			});

			// Record metrics (error case)
			incrementCounter("operations_total", { tool, success: false });
			observeHistogram("operation_duration_seconds", durationMs / 1000, {
				tool,
			});

			throw error;
		}
	});
}

/**
 * Sync version for non-async operations.
 * Same behavior as observe() but for synchronous functions.
 *
 * Automatic correlation tracking:
 * - Uses AsyncLocalStorage for automatic parent-child CID propagation
 * - Manual parentCid in options takes precedence over AsyncLocalStorage
 * - All nested operations automatically inherit the current operation's CID as parent
 *
 * @throws Re-throws any error from the operation after logging
 */
export function observeSync<T>(
	logger: Logger,
	tool: ToolName,
	operation: () => T,
	options?: ObserveOptions<T>,
): T {
	const cid = createCorrelationId();
	// Priority: explicit parentCid > AsyncLocalStorage > undefined
	const currentContext = getCurrentContext();
	const parentCid = options?.parentCid ?? currentContext?.cid;
	const startTime = Date.now();

	// Create trace context for automatic propagation via core utilities
	const traceContext = createTraceContext({ cid, parentCid });

	// Run operation within core's context for automatic propagation
	return runWithContext(traceContext, () => {
		try {
			const result = operation();
			const durationMs = Math.max(0, Date.now() - startTime);
			const success = options?.isSuccess ? options.isSuccess(result) : true;

			safeLog(() => {
				logger.info(MCP_TOOL_RESPONSE, {
					cid,
					...(parentCid && { parentCid }),
					tool,
					durationMs,
					latencyBucket: getLatencyBucket(durationMs),
					success,
					timestamp: new Date().toISOString(),
					...options?.context,
				});
			});

			// Record metrics
			incrementCounter("operations_total", { tool, success });
			observeHistogram("operation_duration_seconds", durationMs / 1000, {
				tool,
			});

			return result;
		} catch (error: unknown) {
			const durationMs = Math.max(0, Date.now() - startTime);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			const errorCode = categorizeError(error);
			const errorCategory = getErrorCategory(error);

			safeLog(() => {
				logger.error(MCP_TOOL_RESPONSE, {
					cid,
					...(parentCid && { parentCid }),
					tool,
					durationMs,
					latencyBucket: getLatencyBucket(durationMs),
					success: false,
					timestamp: new Date().toISOString(),
					error: errorMessage,
					errorCode,
					errorCategory,
					stack: errorStack,
					...options?.context,
				});
			});

			// Record metrics (error case)
			incrementCounter("operations_total", { tool, success: false });
			observeHistogram("operation_duration_seconds", durationMs / 1000, {
				tool,
			});

			throw error;
		}
	});
}

// Re-export metrics functions from core for backward compatibility
export {
	type CounterData,
	getCounters,
	getHistogramBuckets,
	getHistograms,
	type HistogramData,
	type HistogramObservation,
	incrementCounter,
	type MetricLabels,
	observeHistogram,
	resetMetrics,
} from "@sidequest/core/instrumentation";
