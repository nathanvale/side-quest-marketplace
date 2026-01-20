/**
 * Observability and instrumentation utilities.
 *
 * Provides:
 * - **observe/observeSync**: Wrap operations with timing and logging
 * - **error categorization**: Classify errors for retry logic and alerting
 * - **metrics**: In-memory counters and histograms with SLO-aligned buckets
 *
 * @module core/instrumentation
 */

export {
	categorizeError,
	type ErrorCategory,
	type ErrorCode,
	getErrorCategory,
} from "./error-category.js";
export {
	type CounterData,
	getCounters,
	getHistogramBuckets,
	getHistograms,
	getLatencyBucket,
	type HistogramData,
	type HistogramObservation,
	incrementCounter,
	type MetricLabels,
	observeHistogram,
	resetMetrics,
} from "./metrics.js";
export {
	type ObserveLogger,
	type ObserveOptions,
	observe,
	observeSync,
} from "./observe.js";
