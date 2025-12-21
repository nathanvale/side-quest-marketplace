/**
 * Resource usage metrics capture.
 *
 * Provides memory and heap metrics for observability.
 * Used to track resource consumption during long-running operations
 * like inbox scanning and execution.
 *
 * @module shared/resource-metrics
 */

/**
 * Snapshot of process resource usage at a point in time.
 */
export interface ResourceMetrics {
	/** Heap memory used (MB) */
	heapUsedMB: number;
	/** Total heap size (MB) */
	heapTotalMB: number;
	/** External memory allocated (MB) */
	externalMB: number;
	/** ISO timestamp of capture */
	timestamp: string;
}

/**
 * Capture current process memory metrics.
 *
 * Rounds values to integers for readability.
 *
 * @returns Resource metrics snapshot
 *
 * @example
 * ```typescript
 * const metrics = captureResourceMetrics();
 * logger.info`Memory: ${metrics.heapUsedMB}MB / ${metrics.heapTotalMB}MB`;
 * ```
 */
export function captureResourceMetrics(): ResourceMetrics {
	const mem = process.memoryUsage();
	return {
		heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
		heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
		externalMB: Math.round(mem.external / 1024 / 1024),
		timestamp: new Date().toISOString(),
	};
}
