/**
 * Process resource usage metrics capture.
 *
 * Provides memory and heap metrics for observability and performance monitoring.
 * Useful for tracking resource consumption during long-running operations
 * or detecting memory leaks.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { captureResourceMetrics } from "@sidequest/core/instrumentation";
 *
 * const metrics = captureResourceMetrics();
 * console.log(`Memory: ${metrics.heapUsedMB}MB / ${metrics.heapTotalMB}MB`);
 * ```
 *
 * ## With Logger Integration
 *
 * ```typescript
 * import { captureResourceMetrics } from "@sidequest/core/instrumentation";
 * import { getLogger } from "@logtape/logtape";
 *
 * const logger = getLogger("app");
 * const startMetrics = captureResourceMetrics({ logger, operation: "scan" });
 *
 * // ... do work ...
 *
 * const endMetrics = captureResourceMetrics({ logger, operation: "scan" });
 * logger.info`Memory delta: ${endMetrics.heapUsedMB - startMetrics.heapUsedMB}MB`;
 * ```
 *
 * @module core/instrumentation/resource-metrics
 */

/**
 * Snapshot of process resource usage at a point in time.
 */
export interface ResourceMetrics {
	/** Heap memory used (MB) */
	heapUsedMB: number;
	/** Total heap size (MB) */
	heapTotalMB: number;
	/** External memory allocated (MB) - memory used by C++ objects bound to JS */
	externalMB: number;
	/** Resident Set Size (MB) - total memory allocated for the process */
	rssMB: number;
	/** ISO timestamp of capture */
	timestamp: string;
}

/**
 * Optional logger for automatic metric logging.
 */
export interface ResourceMetricsLogger {
	debug(...args: unknown[]): void;
}

/**
 * Options for capturing resource metrics.
 */
export interface CaptureResourceMetricsOptions {
	/** Optional logger to automatically log metrics when captured */
	logger?: ResourceMetricsLogger;
	/** Optional operation name for log context (e.g., "scan", "execute") */
	operation?: string;
	/** Optional correlation ID for tracing */
	cid?: string;
	/** Optional session correlation ID for tracing */
	sessionCid?: string;
}

/**
 * Capture current process memory metrics.
 *
 * Returns a snapshot of Node.js/Bun process memory usage including:
 * - Heap memory (used and total)
 * - External memory (C++ objects bound to JavaScript)
 * - Resident Set Size (total process memory)
 *
 * Values are rounded to integers for readability.
 *
 * Optionally logs metrics if a logger is provided.
 *
 * @param options - Optional logger and context for automatic logging
 * @returns Resource metrics snapshot
 *
 * @example
 * ```typescript
 * // Basic usage
 * const metrics = captureResourceMetrics();
 * console.log(`Memory: ${metrics.heapUsedMB}MB / ${metrics.heapTotalMB}MB`);
 * ```
 *
 * @example
 * ```typescript
 * // With automatic logging
 * const startMetrics = captureResourceMetrics({
 *   logger,
 *   operation: "inbox:scan",
 *   cid: "abc123",
 *   sessionCid: "session-1"
 * });
 * // Logs: "resource:capture operation=inbox:scan cid=abc123 heapUsedMB=..."
 *
 * // ... do work ...
 *
 * const endMetrics = captureResourceMetrics({
 *   logger,
 *   operation: "inbox:scan",
 *   cid: "abc123"
 * });
 * const deltaMB = endMetrics.heapUsedMB - startMetrics.heapUsedMB;
 * console.log(`Memory delta: ${deltaMB}MB`);
 * ```
 *
 * @example
 * ```typescript
 * // Tracking memory across async operation
 * async function processFiles(files: string[]) {
 *   const startMetrics = captureResourceMetrics({ logger, operation: "process" });
 *
 *   for (const file of files) {
 *     await processFile(file);
 *
 *     // Check for memory leaks
 *     const currentMetrics = captureResourceMetrics();
 *     if (currentMetrics.heapUsedMB > startMetrics.heapUsedMB * 2) {
 *       logger.warn`Possible memory leak detected`;
 *     }
 *   }
 *
 *   const endMetrics = captureResourceMetrics({ logger, operation: "process" });
 * }
 * ```
 */
export function captureResourceMetrics(
	options?: CaptureResourceMetricsOptions,
): ResourceMetrics {
	const mem = process.memoryUsage();
	const metrics: ResourceMetrics = {
		heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
		heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
		externalMB: Math.round(mem.external / 1024 / 1024),
		rssMB: Math.round(mem.rss / 1024 / 1024),
		timestamp: new Date().toISOString(),
	};

	// Auto-log if logger provided
	if (options?.logger) {
		const { logger, operation, cid, sessionCid } = options;
		const context = [
			operation && `operation=${operation}`,
			cid && `cid=${cid}`,
			sessionCid && `sessionCid=${sessionCid}`,
			`heapUsedMB=${metrics.heapUsedMB}`,
			`heapTotalMB=${metrics.heapTotalMB}`,
			`externalMB=${metrics.externalMB}`,
			`rssMB=${metrics.rssMB}`,
			`timestamp=${metrics.timestamp}`,
		]
			.filter(Boolean)
			.join(" ");

		logger.debug(`resource:capture ${context}`);
	}

	return metrics;
}

/**
 * Calculate memory delta between two snapshots.
 *
 * @param start - Starting metrics snapshot
 * @param end - Ending metrics snapshot
 * @returns Delta in MB for each metric (positive = increased, negative = decreased)
 *
 * @example
 * ```typescript
 * const start = captureResourceMetrics();
 * await processLargeFile();
 * const end = captureResourceMetrics();
 *
 * const delta = calculateResourceDelta(start, end);
 * console.log(`Heap delta: ${delta.heapUsedMB}MB`);
 * console.log(`RSS delta: ${delta.rssMB}MB`);
 * ```
 */
export function calculateResourceDelta(
	start: ResourceMetrics,
	end: ResourceMetrics,
): Omit<ResourceMetrics, "timestamp"> {
	return {
		heapUsedMB: end.heapUsedMB - start.heapUsedMB,
		heapTotalMB: end.heapTotalMB - start.heapTotalMB,
		externalMB: end.externalMB - start.externalMB,
		rssMB: end.rssMB - start.rssMB,
	};
}

/**
 * Format resource metrics as a human-readable string.
 *
 * @param metrics - Resource metrics to format
 * @returns Formatted string (e.g., "Heap: 128MB / 256MB, RSS: 512MB")
 *
 * @example
 * ```typescript
 * const metrics = captureResourceMetrics();
 * console.log(formatResourceMetrics(metrics));
 * // Output: "Heap: 128MB / 256MB, RSS: 512MB, External: 5MB"
 * ```
 */
export function formatResourceMetrics(metrics: ResourceMetrics): string {
	return `Heap: ${metrics.heapUsedMB}MB / ${metrics.heapTotalMB}MB, RSS: ${metrics.rssMB}MB, External: ${metrics.externalMB}MB`;
}
