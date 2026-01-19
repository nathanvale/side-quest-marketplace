/**
 * Observability and instrumentation utilities.
 *
 * Provides:
 * - **observe/observeSync**: Wrap operations with timing and logging
 * - **error categorization**: Classify errors for retry logic and alerting
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
	type ObserveLogger,
	type ObserveOptions,
	observe,
	observeSync,
} from "./observe.js";
