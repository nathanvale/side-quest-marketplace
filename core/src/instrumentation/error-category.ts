/**
 * Error categorization utilities for incident triage and retry logic.
 *
 * Provides pattern-based error classification to determine whether errors are:
 * - **transient**: Retry may succeed (network issues, timeouts)
 * - **permanent**: Retry will not help (validation errors, not found)
 * - **configuration**: Requires config change (permissions)
 * - **unknown**: Unable to categorize
 *
 * @module core/instrumentation/error-category
 */

/**
 * Error category for alerting and retry logic.
 *
 * - **transient**: Temporary failure, retry may succeed (network, timeout)
 * - **permanent**: Persistent failure, retry will not help (validation, not found)
 * - **configuration**: Requires configuration change (permissions)
 * - **unknown**: Unable to determine category
 */
export type ErrorCategory =
	| "transient"
	| "permanent"
	| "configuration"
	| "unknown";

/**
 * Standardized error codes for incident triage.
 *
 * Maps common error patterns to actionable codes for filtering and alerting.
 */
export type ErrorCode =
	| "NETWORK_ERROR" // Connection failures, DNS issues
	| "TIMEOUT" // Operation timed out
	| "NOT_FOUND" // File/resource not found
	| "VALIDATION" // Input validation failed
	| "PERMISSION" // Permission denied
	| "UNKNOWN_ERROR"; // Unable to categorize

/**
 * Categorize an error by analyzing its message for known patterns.
 *
 * Returns both a high-level category (for retry logic) and a specific error code
 * (for filtering/alerting). Pattern matching is case-insensitive.
 *
 * @param error - The error to categorize
 * @returns Object with category and error code
 *
 * @example
 * ```typescript
 * const { category, code } = categorizeError(new Error("ECONNREFUSED"));
 * // { category: "transient", code: "NETWORK_ERROR" }
 *
 * const { category, code } = categorizeError(new Error("Validation failed: required field missing"));
 * // { category: "permanent", code: "VALIDATION" }
 * ```
 */
export function categorizeError(error: unknown): {
	category: ErrorCategory;
	code: ErrorCode;
} {
	if (!(error instanceof Error)) {
		return { category: "unknown", code: "UNKNOWN_ERROR" };
	}

	const msg = error.message.toLowerCase();

	// Network errors (transient)
	if (
		msg.includes("econnrefused") ||
		msg.includes("enotfound") ||
		msg.includes("network") ||
		msg.includes("fetch failed")
	) {
		return { category: "transient", code: "NETWORK_ERROR" };
	}

	// Timeout errors (transient)
	if (msg.includes("timeout") || msg.includes("timed out")) {
		return { category: "transient", code: "TIMEOUT" };
	}

	// Not found errors (permanent)
	if (
		msg.includes("not found") ||
		msg.includes("enoent") ||
		msg.includes("no such file")
	) {
		return { category: "permanent", code: "NOT_FOUND" };
	}

	// Validation errors (permanent)
	if (
		msg.includes("invalid") ||
		msg.includes("validation") ||
		msg.includes("must be") ||
		msg.includes("required")
	) {
		return { category: "permanent", code: "VALIDATION" };
	}

	// Permission errors (configuration)
	if (
		msg.includes("permission") ||
		msg.includes("eacces") ||
		msg.includes("eperm") ||
		msg.includes("unauthorized")
	) {
		return { category: "configuration", code: "PERMISSION" };
	}

	return { category: "unknown", code: "UNKNOWN_ERROR" };
}

/**
 * Get the error category for retry/alerting logic.
 *
 * Simplified helper that returns just the category, without the specific error code.
 * Use this when you only need to decide whether to retry an operation.
 *
 * @param error - The error to categorize
 * @returns Error category for retry logic
 *
 * @example
 * ```typescript
 * const category = getErrorCategory(error);
 * if (category === "transient") {
 *   // Retry the operation
 * } else if (category === "configuration") {
 *   // Alert ops team
 * }
 * ```
 */
export function getErrorCategory(error: unknown): ErrorCategory {
	return categorizeError(error).category;
}
