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

import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "@logtape/logtape";
import { createCorrelationId, type SUBSYSTEMS } from "./logger.js";

/**
 * AsyncLocalStorage for automatic correlation ID propagation across async boundaries.
 * This enables automatic parent-child relationship tracking without manual propagation.
 */
const asyncLocalStorage = new AsyncLocalStorage<{
	cid: string;
	parentCid?: string;
}>();

/**
 * Get the current correlation context from AsyncLocalStorage.
 * Returns undefined if not running within an observe/observeSync context.
 *
 * This is useful for manual correlation tracking in code that doesn't use observe/observeSync.
 */
export function getCurrentContext():
	| { cid: string; parentCid?: string }
	| undefined {
	return asyncLocalStorage.getStore();
}

/** Message format required for MetricsCollector compatibility */
const MCP_TOOL_RESPONSE = "MCP tool response" as const;

/** Standard latency buckets in milliseconds for histogram tracking */
const LATENCY_BUCKETS = [
	10, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
] as const;

/** SLO-aligned histogram buckets in seconds (aligned with SLO thresholds) */
const SLO_HISTOGRAM_BUCKETS = [1, 5, 10, 30, 60] as const;

/** In-memory metrics storage */
interface MetricLabels {
	[key: string]: string | number | boolean;
}

interface CounterData {
	name: string;
	labels: MetricLabels;
	value: number;
}

interface HistogramObservation {
	value: number;
	timestamp: number;
}

interface HistogramData {
	name: string;
	labels: MetricLabels;
	observations: HistogramObservation[];
	/** Incremental bucket counts for O(1) bucket queries */
	buckets: number[];
}

/** Maximum number of observations to retain per histogram (FIFO cleanup) */
const MAX_HISTOGRAM_OBSERVATIONS = 1000;

/** Time-to-live for histogram observations in milliseconds (24 hours) */
const HISTOGRAM_TTL_MS = 24 * 60 * 60 * 1000;

/** In-memory counter storage */
const counters = new Map<string, CounterData>();

/** In-memory histogram storage */
const histograms = new Map<string, HistogramData>();

/**
 * Generate a stable key for metric lookup based on name and labels.
 * Labels are sorted by key to ensure consistency.
 */
function getMetricKey(name: string, labels: MetricLabels): string {
	const sortedLabels = Object.keys(labels)
		.sort()
		.map((key) => `${key}=${labels[key]}`)
		.join(",");
	return `${name}{${sortedLabels}}`;
}

/**
 * Increment a counter metric.
 *
 * @param name - Metric name (e.g., "operations_total")
 * @param labels - Labels to attach to the metric (e.g., { tool: "templates:load", success: true })
 * @param value - Value to add to counter (default: 1)
 *
 * @example
 * ```typescript
 * incrementCounter("operations_total", { tool: "templates:load", success: true });
 * incrementCounter("bytes_processed", { source: "inbox" }, 1024);
 * ```
 */
export function incrementCounter(
	name: string,
	labels: MetricLabels,
	value = 1,
): void {
	const key = getMetricKey(name, labels);
	const existing = counters.get(key);

	if (existing) {
		existing.value += value;
	} else {
		counters.set(key, { name, labels, value });
	}
}

/**
 * Cleanup old observations from a histogram based on TTL and max size.
 * Implements FIFO eviction to prevent unbounded memory growth.
 *
 * @param histogram - Histogram data to cleanup
 */
function cleanupHistogramObservations(histogram: HistogramData): void {
	const now = Date.now();
	const cutoffTime = now - HISTOGRAM_TTL_MS;

	// Remove observations older than TTL
	histogram.observations = histogram.observations.filter(
		(obs) => obs.timestamp >= cutoffTime,
	);

	// If still over max size, remove oldest observations (FIFO)
	if (histogram.observations.length > MAX_HISTOGRAM_OBSERVATIONS) {
		const excess = histogram.observations.length - MAX_HISTOGRAM_OBSERVATIONS;
		histogram.observations = histogram.observations.slice(excess);
	}

	// Recalculate buckets after cleanup
	recalculateBuckets(histogram);
}

/**
 * Recalculate histogram buckets from observations.
 * Used after cleanup or when creating a new histogram.
 *
 * @param histogram - Histogram data to recalculate
 */
function recalculateBuckets(histogram: HistogramData): void {
	histogram.buckets = new Array(SLO_HISTOGRAM_BUCKETS.length).fill(0);

	for (const obs of histogram.observations) {
		updateBucketsForValue(histogram.buckets, obs.value);
	}
}

/**
 * Update bucket counts for a single value (incremental update).
 * This maintains cumulative bucket counts efficiently.
 *
 * @param buckets - Bucket array to update
 * @param value - Value to add to buckets
 */
function updateBucketsForValue(buckets: number[], value: number): void {
	// Find the first bucket this value fits into
	for (let i = 0; i < SLO_HISTOGRAM_BUCKETS.length; i++) {
		const boundary = SLO_HISTOGRAM_BUCKETS[i];
		if (boundary !== undefined && value <= boundary) {
			// Increment this bucket and all subsequent buckets (cumulative)
			for (let j = i; j < SLO_HISTOGRAM_BUCKETS.length; j++) {
				buckets[j] = (buckets[j] ?? 0) + 1;
			}
			break;
		}
	}
}

/**
 * Observe a value in a histogram metric.
 * Histograms track distributions of values using SLO-aligned buckets.
 *
 * This implementation includes:
 * - FIFO cleanup: Keeps max 1000 recent observations per metric
 * - TTL-based cleanup: Removes observations older than 24 hours
 * - O(1) incremental bucket updates: No recalculation on query
 *
 * @param name - Metric name (e.g., "operation_duration_seconds")
 * @param value - Value to observe (in seconds for duration metrics)
 * @param labels - Labels to attach to the metric
 *
 * @example
 * ```typescript
 * observeHistogram("operation_duration_seconds", 2.5, { tool: "templates:load" });
 * observeHistogram("file_size_bytes", 1024, { type: "pdf" });
 * ```
 */
export function observeHistogram(
	name: string,
	value: number,
	labels: MetricLabels,
): void {
	const key = getMetricKey(name, labels);
	const existing = histograms.get(key);
	const observation: HistogramObservation = {
		value,
		timestamp: Date.now(),
	};

	if (existing) {
		existing.observations.push(observation);
		// Incremental bucket update (O(1) instead of O(n))
		updateBucketsForValue(existing.buckets, value);

		// Cleanup if needed (TTL or max size exceeded)
		const needsCleanup =
			existing.observations.length > MAX_HISTOGRAM_OBSERVATIONS ||
			observation.timestamp - existing.observations[0]!.timestamp >
				HISTOGRAM_TTL_MS;

		if (needsCleanup) {
			cleanupHistogramObservations(existing);
		}
	} else {
		const buckets = new Array(SLO_HISTOGRAM_BUCKETS.length).fill(0);
		updateBucketsForValue(buckets, value);

		histograms.set(key, {
			name,
			labels,
			observations: [observation],
			buckets,
		});
	}
}

/**
 * Get all counter metrics.
 *
 * @returns Array of counter data
 */
export function getCounters(): CounterData[] {
	return Array.from(counters.values());
}

/**
 * Get all histogram metrics.
 *
 * @returns Array of histogram data
 */
export function getHistograms(): HistogramData[] {
	return Array.from(histograms.values());
}

/**
 * Get histogram bucket counts for a specific metric.
 * Returns counts of observations that fall into each SLO-aligned bucket.
 *
 * This is now O(1) instead of O(n²) because buckets are maintained incrementally.
 *
 * @param name - Metric name
 * @param labels - Labels to filter by
 * @returns Object with bucket counts and bucket boundaries
 */
export function getHistogramBuckets(
	name: string,
	labels: MetricLabels,
): { buckets: number[]; boundaries: readonly number[] } {
	const key = getMetricKey(name, labels);
	const histogram = histograms.get(key);

	if (!histogram) {
		return {
			buckets: new Array(SLO_HISTOGRAM_BUCKETS.length).fill(0),
			boundaries: SLO_HISTOGRAM_BUCKETS,
		};
	}

	// Return pre-calculated buckets (O(1) instead of O(n²))
	return { buckets: [...histogram.buckets], boundaries: SLO_HISTOGRAM_BUCKETS };
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetMetrics(): void {
	counters.clear();
	histograms.clear();
}

/**
 * Get the appropriate latency bucket for a duration value.
 * Returns a string representing the bucket range for histogram aggregation.
 *
 * @param durationMs - Duration in milliseconds
 * @returns Bucket label (e.g., "0-10ms", "10-50ms", "10000+ms")
 */
function getLatencyBucket(durationMs: number): string {
	for (let i = 0; i < LATENCY_BUCKETS.length; i++) {
		const bucket = LATENCY_BUCKETS[i];
		if (bucket !== undefined && durationMs <= bucket) {
			const prevBucket = i === 0 ? 0 : (LATENCY_BUCKETS[i - 1] ?? 0);
			return `${prevBucket}-${bucket}ms`;
		}
	}
	const lastBucket = LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1];
	return `${lastBucket ?? 10000}+ms`;
}

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

	// Run operation within AsyncLocalStorage context for automatic propagation
	return asyncLocalStorage.run({ cid, parentCid }, async () => {
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

	// Run operation within AsyncLocalStorage context for automatic propagation
	return asyncLocalStorage.run({ cid, parentCid }, () => {
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
