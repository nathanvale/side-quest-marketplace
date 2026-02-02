/**
 * Base error class for plugin-specific errors with structured metadata.
 *
 * Provides type classification, user-friendly messages, recovery hints,
 * and JSON serialization for MCP error responses.
 *
 * @module core/instrumentation/typed-error
 *
 * @example
 * ```typescript
 * // Define plugin-specific error types
 * enum MyPluginErrorType {
 *   ConfigNotFound = "ConfigNotFound",
 *   InvalidInput = "InvalidInput",
 * }
 *
 * // Define error messages
 * const ERROR_MESSAGES: Record<MyPluginErrorType, { message: string; hint: string }> = {
 *   [MyPluginErrorType.ConfigNotFound]: {
 *     message: "Configuration file not found.",
 *     hint: "Create a config.json file in the project root."
 *   },
 *   [MyPluginErrorType.InvalidInput]: {
 *     message: "Invalid input provided.",
 *     hint: "Check your input format and try again."
 *   }
 * };
 *
 * // Create plugin-specific error class
 * class MyPluginError extends PluginError<MyPluginErrorType> {
 *   constructor(
 *     type: MyPluginErrorType,
 *     details?: string,
 *     stderr?: string
 *   ) {
 *     const errorInfo = ERROR_MESSAGES[type];
 *     super("MyPluginError", type, errorInfo.message, errorInfo.hint, details, stderr);
 *   }
 * }
 *
 * // Use in code
 * throw new MyPluginError(MyPluginErrorType.ConfigNotFound, "/path/to/config.json");
 * ```
 */

/**
 * Base error class for plugin-specific errors with structured metadata.
 *
 * Provides:
 * - Type classification via generic error type parameter
 * - User-friendly error messages separate from Error.message
 * - Recovery hints with actionable guidance
 * - Optional details and stderr for debugging
 * - Formatted user message output
 * - JSON serialization for MCP responses
 *
 * @template TErrorType - Plugin-specific error type enum
 */
export class PluginError<TErrorType extends string> extends Error {
	/**
	 * Plugin-specific error type for categorization.
	 *
	 * @example "InvalidPath", "Timeout", "ConfigNotFound"
	 */
	public readonly type: TErrorType;

	/**
	 * User-friendly error message.
	 *
	 * This is the message shown to users, separate from the internal
	 * Error.message which may include additional details.
	 */
	public readonly userMessage: string;

	/**
	 * Recovery hint with actionable guidance.
	 *
	 * @example "Install Kit with: uv tool install cased-kit"
	 */
	public readonly hint: string;

	/**
	 * Optional additional details about the error.
	 *
	 * @example "/path/to/missing/file", "timeout after 30s"
	 */
	public readonly details?: string;

	/**
	 * Optional stderr output from failed command.
	 *
	 * Useful for preserving raw error output from external tools.
	 */
	public readonly stderr?: string;

	/**
	 * Create a new PluginError.
	 *
	 * @param name - Error name (e.g., "KitError", "ParaError")
	 * @param type - Plugin-specific error type
	 * @param userMessage - User-friendly error message
	 * @param hint - Recovery hint with actionable guidance
	 * @param details - Optional additional error details
	 * @param stderr - Optional stderr output from failed command
	 */
	constructor(
		name: string,
		type: TErrorType,
		userMessage: string,
		hint: string,
		details?: string,
		stderr?: string,
	) {
		// Only append details if non-empty string
		const detailsStr = details && details.length > 0 ? `: ${details}` : "";
		super(`${userMessage}${detailsStr}`);
		this.name = name;
		this.type = type;
		this.userMessage = userMessage;
		this.hint = hint;
		this.details = details;
		this.stderr = stderr;
	}

	/**
	 * Format error for user display.
	 *
	 * Returns a multi-line string with:
	 * - Error message
	 * - Recovery hint
	 * - Details section (if stderr provided)
	 *
	 * @returns Formatted error message for display
	 *
	 * @example
	 * ```
	 * Error: Configuration file not found: /path/to/config.json
	 *
	 * Hint: Create a config.json file in the project root.
	 *
	 * Details:
	 * ENOENT: no such file or directory
	 * ```
	 */
	toUserMessage(): string {
		const lines = [`Error: ${this.message}`, "", `Hint: ${this.hint}`];

		// Only add Details section if stderr is non-empty
		if (this.stderr && this.stderr.length > 0) {
			lines.push("", "Details:", this.stderr);
		}

		return lines.join("\n");
	}

	/**
	 * Format error for JSON output.
	 *
	 * Returns a structured object suitable for:
	 * - MCP tool error responses
	 * - Structured logging
	 * - API error responses
	 *
	 * @returns JSON-serializable error object
	 *
	 * @example
	 * ```json
	 * {
	 *   "error": "Configuration file not found: /path/to/config.json",
	 *   "type": "ConfigNotFound",
	 *   "hint": "Create a config.json file in the project root.",
	 *   "details": "/path/to/config.json"
	 * }
	 * ```
	 */
	toJSON(): {
		error: string;
		type: TErrorType;
		hint: string;
		details?: string;
	} {
		return {
			error: this.message,
			type: this.type,
			hint: this.hint,
			...(this.details && { details: this.details }),
		};
	}
}
