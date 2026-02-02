/**
 * Generic subprocess error pattern detection utilities.
 *
 * Provides pattern-based matching for classifying errors from subprocess stderr/stdout output.
 * Build on this module to create plugin-specific error detection by defining custom patterns
 * and using the generic matching infrastructure.
 *
 * @module core/instrumentation/error-patterns
 *
 * @example
 * ```typescript
 * // Define plugin-specific error patterns
 * enum MyErrorType {
 *   NotFound = "NotFound",
 *   Timeout = "Timeout",
 *   CommandFailed = "CommandFailed"
 * }
 *
 * const patterns: ErrorPattern<MyErrorType>[] = [
 *   {
 *     type: MyErrorType.NotFound,
 *     patterns: ["no such file", "not found", /does not exist/i]
 *   },
 *   {
 *     type: MyErrorType.Timeout,
 *     patterns: ["timeout", "timed out", /ETIMEDOUT/i]
 *   }
 * ];
 *
 * // Detect error type from subprocess output
 * const errorType = detectErrorFromOutput(
 *   stderr,
 *   patterns,
 *   MyErrorType.CommandFailed
 * );
 *
 * // Or use convenience helpers
 * if (isTimeoutOutput(stderr)) {
 *   // Handle timeout
 * }
 * if (isCommandNotFoundOutput(stderr)) {
 *   // Handle missing command
 * }
 * ```
 */

/**
 * A pattern matcher for subprocess stderr/stdout output.
 *
 * Supports both string literals (case-insensitive) and regular expressions
 * for flexible error detection.
 *
 * @template TErrorType - The error type enum or union type
 */
export interface ErrorPattern<TErrorType extends string> {
	/**
	 * The error type to return when this pattern matches.
	 */
	type: TErrorType;

	/**
	 * List of patterns to match against output.
	 *
	 * - String patterns are matched case-insensitively
	 * - RegExp patterns use their own flags
	 */
	patterns: (string | RegExp)[];
}

/**
 * Detect error type from subprocess output by matching against registered patterns.
 *
 * Patterns are tested in order. The first matching pattern's type is returned.
 * If no patterns match, the default type is returned.
 *
 * @template TErrorType - The error type enum or union type
 * @param output - Standard error/output from subprocess
 * @param patterns - Ordered list of error patterns to test
 * @param defaultType - Error type to return if no patterns match
 * @returns The detected error type
 *
 * @example
 * ```typescript
 * const errorType = detectErrorFromOutput(
 *   "Error: ENOENT: no such file or directory",
 *   [
 *     { type: "NotFound", patterns: ["no such file", /ENOENT/] },
 *     { type: "Permission", patterns: ["EACCES", /permission denied/i] }
 *   ],
 *   "UnknownError"
 * );
 * // Returns "NotFound"
 * ```
 */
export function detectErrorFromOutput<TErrorType extends string>(
	output: string,
	patterns: ErrorPattern<TErrorType>[],
	defaultType: TErrorType,
): TErrorType {
	const lowerOutput = output.toLowerCase();

	for (const errorPattern of patterns) {
		for (const pattern of errorPattern.patterns) {
			if (typeof pattern === "string") {
				// String patterns: case-insensitive substring match
				if (lowerOutput.includes(pattern.toLowerCase())) {
					return errorPattern.type;
				}
			} else {
				// RegExp patterns: use pattern's own flags
				if (pattern.test(output)) {
					return errorPattern.type;
				}
			}
		}
	}

	return defaultType;
}

/**
 * Check if output contains timeout indicators.
 *
 * Matches common timeout patterns from various tools and platforms:
 * - "timeout", "timed out"
 * - "ETIMEDOUT" (Node.js)
 * - "operation timeout" (various CLIs)
 *
 * @param output - Standard error/output from subprocess
 * @returns True if output indicates a timeout occurred
 *
 * @example
 * ```typescript
 * if (isTimeoutOutput(stderr)) {
 *   console.log("Operation timed out - try increasing timeout threshold");
 * }
 * ```
 */
export function isTimeoutOutput(output: string): boolean {
	const lowerOutput = output.toLowerCase();
	return (
		lowerOutput.includes("timeout") ||
		lowerOutput.includes("timed out") ||
		lowerOutput.includes("etimedout")
	);
}

/**
 * Check if output indicates a command was not found.
 *
 * Matches common "command not found" patterns from various shells:
 * - "command not found" (bash, zsh)
 * - "not recognized" (Windows)
 * - "no such file" (when trying to execute non-existent binary)
 * - "cannot find" (generic error messages)
 *
 * @param output - Standard error/output from subprocess
 * @returns True if output indicates command not found
 *
 * @example
 * ```typescript
 * if (isCommandNotFoundOutput(stderr)) {
 *   console.log("CLI tool not installed - run: npm install -g <tool>");
 * }
 * ```
 */
export function isCommandNotFoundOutput(output: string): boolean {
	const lowerOutput = output.toLowerCase();
	return (
		lowerOutput.includes("command not found") ||
		lowerOutput.includes("not recognized") ||
		lowerOutput.includes("no such file") ||
		lowerOutput.includes("cannot find")
	);
}
