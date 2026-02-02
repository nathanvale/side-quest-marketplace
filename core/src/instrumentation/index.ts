/**
 * Observability and instrumentation utilities.
 *
 * Provides:
 * - **observe/observeSync**: Simple timing and logging (callbacks)
 * - **observeWithContext/observeSyncWithContext**: Full W3C Trace Context support
 * - **context utilities**: AsyncLocalStorage-based correlation ID propagation
 * - **error categorization**: Classify errors for retry logic and alerting
 * - **metrics**: In-memory counters and histograms with SLO-aligned buckets
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   observeWithContext,
 *   getCurrentContext,
 *   createTraceContext,
 *   runWithContext,
 * } from "@sidequest/core/instrumentation";
 *
 * // Create session context
 * const sessionCtx = createTraceContext({ sessionCid: "my-session" });
 *
 * // Run operations with automatic trace propagation
 * await runWithContext(sessionCtx, async () => {
 *   await observeWithContext(logger, "inbox:scan", async () => {
 *     // Nested operations automatically get linked spans
 *     await observeWithContext(logger, "inbox:process", async () => {
 *       const ctx = getCurrentContext();
 *       // ctx.parentCid links to "inbox:scan"
 *     });
 *   });
 * });
 * ```
 *
 * @module core/instrumentation
 */

// Context utilities for trace propagation
export {
	createTraceContext,
	generateCorrelationId,
	getCurrentContext,
	runWithContext,
	runWithContextAsync,
	type TraceContext,
	withChildContext,
	withChildContextAsync,
} from "./context.js";

// Error categorization
export {
	categorizeError,
	type ErrorCategory,
	type ErrorCode,
	getErrorCategory,
} from "./error-category.js";
// Error pattern detection for subprocess output
export {
	detectErrorFromOutput,
	type ErrorPattern,
	isCommandNotFoundOutput,
	isTimeoutOutput,
} from "./error-patterns.js";
// Metrics
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
// Simple observe API (callbacks)
// Context-aware observe API (W3C Trace Context)
export {
	type ContextAwareLogger,
	type ObserveLogger,
	type ObserveOptions,
	type ObserveWithContextOptions,
	observe,
	observeSync,
	observeSyncWithContext,
	observeWithContext,
} from "./observe.js";
// Resource metrics (memory, heap, RSS)
export {
	type CaptureResourceMetricsOptions,
	calculateResourceDelta,
	captureResourceMetrics,
	formatResourceMetrics,
	type ResourceMetrics,
	type ResourceMetricsLogger,
} from "./resource-metrics.js";
// Typed error base class
export { PluginError } from "./typed-error.js";
