/**
 * Generic Structured Error System
 *
 * Provides a base class for structured, categorized errors with:
 * - Machine-readable error codes and categories
 * - Recoverability hints for retry logic
 * - Arbitrary context metadata for debugging
 * - Error chaining via `cause`
 * - JSON serialization for logging/transport
 *
 * @module errors/structured-error
 */

/**
 * Standard error categories for classification and handling.
 *
 * These categories are intentionally generic to support any domain.
 */
export type ErrorCategory =
	| "NETWORK_ERROR" // Network/connectivity issues
	| "TIMEOUT" // Operation exceeded time limit
	| "NOT_FOUND" // Resource doesn't exist
	| "VALIDATION" // Data validation failure
	| "PERMISSION" // Access denied/insufficient permissions
	| "CONFIGURATION" // Invalid configuration
	| "INTERNAL" // Internal/unexpected error
	| "UNKNOWN"; // Uncategorized error

/**
 * Structured error with categorization, recoverability, and context.
 *
 * Use this as a base class for domain-specific error types.
 *
 * @example
 * ```typescript
 * class DatabaseError extends StructuredError {
 *   constructor(message: string, code: string, context?: Record<string, unknown>) {
 *     super(message, "DATABASE_ERROR", code, false, context);
 *     this.name = "DatabaseError";
 *   }
 * }
 *
 * throw new DatabaseError(
 *   "Failed to connect to database",
 *   "DB_CONNECTION_FAILED",
 *   { host: "localhost", port: 5432 }
 * );
 * ```
 */
export class StructuredError extends Error {
	/**
	 * High-level error category for classification.
	 */
	public readonly category: ErrorCategory;

	/**
	 * Machine-readable error code (e.g., "FILE_NOT_FOUND", "PARSE_FAILED").
	 */
	public readonly code: string;

	/**
	 * Whether this error is recoverable (can be retried).
	 */
	public readonly recoverable: boolean;

	/**
	 * Arbitrary context metadata for debugging.
	 */
	public readonly context: Record<string, unknown>;

	/**
	 * Original error that caused this error (for error chaining).
	 */
	public override readonly cause?: Error;

	constructor(
		message: string,
		category: ErrorCategory,
		code: string,
		recoverable: boolean,
		context: Record<string, unknown> = {},
		cause?: Error,
	) {
		super(message);
		this.name = "StructuredError";
		this.category = category;
		this.code = code;
		this.recoverable = recoverable;
		this.context = context;
		this.cause = cause;

		// Capture stack trace for V8 engines
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, StructuredError);
		}
	}

	/**
	 * Serialize error to JSON for logging or transport.
	 *
	 * @returns Plain object with all error properties
	 */
	toJSON(): {
		name: string;
		message: string;
		category: ErrorCategory;
		code: string;
		recoverable: boolean;
		context: Record<string, unknown>;
		stack?: string;
		cause?: {
			name: string;
			message: string;
			stack?: string;
		};
	} {
		return {
			name: this.name,
			message: this.message,
			category: this.category,
			code: this.code,
			recoverable: this.recoverable,
			context: this.context,
			stack: this.stack,
			cause: this.cause
				? {
						name: this.cause.name,
						message: this.cause.message,
						stack: this.cause.stack,
					}
				: undefined,
		};
	}
}

/**
 * Type guard to check if an error is a StructuredError.
 *
 * @param error - Value to check
 * @returns True if error is a StructuredError instance
 */
export function isStructuredError(error: unknown): error is StructuredError {
	return error instanceof StructuredError;
}

/**
 * Type guard to check if an error is recoverable.
 *
 * @param error - Value to check
 * @returns True if error is a StructuredError and is marked recoverable
 */
export function isRecoverableError(error: unknown): boolean {
	return isStructuredError(error) && error.recoverable;
}
