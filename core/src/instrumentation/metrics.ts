/**
 * Metrics collection utilities for counters and histograms.
 *
 * Provides in-memory metric storage with:
 * - **Counters**: Track event counts with labels
 * - **Histograms**: Track value distributions with SLO-aligned buckets
 * - **Memory Management**: FIFO cleanup, TTL-based expiration
 * - **Performance**: O(1) bucket updates, efficient queries
 *
 * @module core/instrumentation/metrics
 */

/** Standard latency buckets in milliseconds for histogram tracking */
const LATENCY_BUCKETS = [
	10, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
] as const;

/** SLO-aligned histogram buckets in seconds (aligned with SLO thresholds) */
const SLO_HISTOGRAM_BUCKETS = [1, 5, 10, 30, 60] as const;

/** In-memory metrics storage */
export interface MetricLabels {
	[key: string]: string | number | boolean;
}

export interface CounterData {
	name: string;
	labels: MetricLabels;
	value: number;
}

export interface HistogramObservation {
	value: number;
	timestamp: number;
}

export interface HistogramData {
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
export function getLatencyBucket(durationMs: number): string {
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
