/**
 * Performance thresholds for inbox processing operations.
 *
 * Used for alerting and monitoring to detect performance regressions.
 * When operations exceed these thresholds, warnings are logged.
 *
 * @module inbox/shared/thresholds
 */

/**
 * Performance threshold definitions for various operations.
 *
 * These values represent maximum expected durations before warnings
 * should be emitted. They're based on typical production performance
 * under normal load.
 */
export const PERFORMANCE_THRESHOLDS = {
	/** Maximum expected scan duration in ms (60 seconds) */
	scanTotalMs: 60_000,

	/** Maximum expected execute duration in ms (30 seconds) */
	executeTotalMs: 30_000,

	/** Maximum expected LLM call duration in ms (10 seconds) */
	llmCallMs: 10_000,

	/** Maximum expected file extraction duration in ms (5 seconds) */
	extractionMs: 5_000,

	/** Maximum expected enrichment duration in ms (5 seconds) */
	enrichmentMs: 5_000,

	/** Maximum acceptable error rate (10%) */
	errorRate: 0.1,

	/** Maximum acceptable LLM failure rate (20%) */
	llmFailureRate: 0.2,
} as const;

export type ThresholdKey = keyof typeof PERFORMANCE_THRESHOLDS;

/**
 * Result of checking a metric against its threshold.
 */
export interface ThresholdCheckResult {
	/** Whether the metric exceeded the threshold */
	exceeded: boolean;
	/** The threshold value that was checked against */
	threshold: number;
	/** Percentage of threshold used (100 = at threshold, 150 = 50% over) */
	percentage: number;
}

/**
 * Check if a metric exceeds its threshold and return diagnostic info.
 *
 * @param key - The threshold key to check against
 * @param value - The measured value to check
 * @returns Threshold check result with exceeded flag and percentage
 *
 * @example
 * ```typescript
 * const check = checkThreshold('scanTotalMs', 75_000);
 * if (check.exceeded) {
 *   logger.warn(`Scan slow: ${check.percentage}% of threshold`);
 * }
 * ```
 */
export function checkThreshold(
	key: ThresholdKey,
	value: number,
): ThresholdCheckResult {
	const threshold = PERFORMANCE_THRESHOLDS[key];
	const exceeded = value > threshold;
	const percentage = Math.round((value / threshold) * 100);

	return { exceeded, threshold, percentage };
}
