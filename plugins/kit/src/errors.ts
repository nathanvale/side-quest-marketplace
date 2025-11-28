/**
 * Kit Plugin Error Taxonomy
 *
 * Comprehensive error handling with clear recovery instructions.
 */

// ============================================================================
// Error Types
// ============================================================================

/**
 * Kit error types with associated recovery strategies.
 */
export enum KitErrorType {
	/** Kit CLI not found in PATH */
	KitNotInstalled = "KitNotInstalled",
	/** Invalid repository path */
	InvalidPath = "InvalidPath",
	/** Invalid input (regex, glob, etc.) */
	InvalidInput = "InvalidInput",
	/** Semantic search not available (missing ML deps) */
	SemanticNotAvailable = "SemanticNotAvailable",
	/** Too many results returned */
	TooManyResults = "TooManyResults",
	/** Kit command failed */
	KitCommandFailed = "KitCommandFailed",
	/** Failed to parse Kit output */
	OutputParseError = "OutputParseError",
	/** Operation timed out */
	Timeout = "Timeout",
}

// ============================================================================
// Error Messages & Recovery Hints
// ============================================================================

/**
 * User-facing error messages with recovery hints.
 */
export const ERROR_MESSAGES: Record<
	KitErrorType,
	{ message: string; hint: string }
> = {
	[KitErrorType.KitNotInstalled]: {
		message: "Kit CLI is not installed or not found in PATH.",
		hint: "Install Kit with: uv tool install cased-kit",
	},
	[KitErrorType.InvalidPath]: {
		message: "The specified path does not exist or is not accessible.",
		hint: "Check the path exists and you have read permissions.",
	},
	[KitErrorType.InvalidInput]: {
		message: "Invalid input provided.",
		hint: "Check your search pattern or options for syntax errors.",
	},
	[KitErrorType.SemanticNotAvailable]: {
		message: "Semantic search is not available.",
		hint: `Install ML dependencies: pip install 'cased-kit[ml]' or uv tool install 'cased-kit[ml]'`,
	},
	[KitErrorType.TooManyResults]: {
		message: "Query returned too many results.",
		hint: "Try a more specific query or use --max-results to limit output.",
	},
	[KitErrorType.KitCommandFailed]: {
		message: "Kit command failed to execute.",
		hint: "Check the error details below for more information.",
	},
	[KitErrorType.OutputParseError]: {
		message: "Failed to parse Kit output.",
		hint: "This may be a bug. Check logs for details.",
	},
	[KitErrorType.Timeout]: {
		message: "Operation timed out.",
		hint: "Try searching a smaller directory or use more specific filters.",
	},
};

// ============================================================================
// Error Class
// ============================================================================

/**
 * Custom error class for Kit operations.
 */
export class KitError extends Error {
	constructor(
		public readonly type: KitErrorType,
		public readonly details?: string,
		public readonly stderr?: string,
	) {
		const errorInfo = ERROR_MESSAGES[type];
		const detailsStr = details ? `: ${details}` : "";
		super(`${errorInfo.message}${detailsStr}`);
		this.name = "KitError";
	}

	/**
	 * Get user-facing recovery hint.
	 */
	get hint(): string {
		return ERROR_MESSAGES[this.type].hint;
	}

	/**
	 * Format error for user display.
	 */
	toUserMessage(): string {
		const lines = [`Error: ${this.message}`, "", `Hint: ${this.hint}`];

		if (this.stderr) {
			lines.push("", "Details:", this.stderr);
		}

		return lines.join("\n");
	}

	/**
	 * Format error for JSON output.
	 */
	toJSON(): {
		error: string;
		type: KitErrorType;
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

// ============================================================================
// Semantic Search Fallback
// ============================================================================

/**
 * Install hint shown when semantic search is unavailable.
 */
export const SEMANTIC_INSTALL_HINT = `
Semantic search is not available. Using text search instead.

To enable semantic search, install the ML dependencies:
  pip install 'cased-kit[ml]'

Or if using uv:
  uv tool install 'cased-kit[ml]'
`.trim();

/**
 * Check if an error indicates semantic search is unavailable.
 * @param stderr - Standard error output from Kit
 */
export function isSemanticUnavailableError(stderr: string): boolean {
	const patterns = [
		"sentence-transformers",
		"chromadb",
		"semantic search",
		"vector index",
		"embedding",
	];
	const lowerStderr = stderr.toLowerCase();
	return patterns.some((p) => lowerStderr.includes(p));
}

// ============================================================================
// Error Detection Helpers
// ============================================================================

/**
 * Detect error type from Kit stderr output.
 * @param stderr - Standard error output from Kit
 * @param _exitCode - Exit code from Kit process (currently unused)
 */
export function detectErrorType(
	stderr: string,
	_exitCode: number,
): KitErrorType {
	const lowerStderr = stderr.toLowerCase();

	// Check for semantic search unavailable
	if (isSemanticUnavailableError(stderr)) {
		return KitErrorType.SemanticNotAvailable;
	}

	// Check for path errors
	if (
		lowerStderr.includes("no such file") ||
		lowerStderr.includes("not found") ||
		lowerStderr.includes("does not exist")
	) {
		return KitErrorType.InvalidPath;
	}

	// Check for timeout
	if (lowerStderr.includes("timeout") || lowerStderr.includes("timed out")) {
		return KitErrorType.Timeout;
	}

	// Check for too many results
	if (lowerStderr.includes("too many") || lowerStderr.includes("limit")) {
		return KitErrorType.TooManyResults;
	}

	// Default to generic command failure
	return KitErrorType.KitCommandFailed;
}

/**
 * Create a KitError from process output.
 * @param stderr - Standard error output
 * @param exitCode - Process exit code
 */
export function createErrorFromOutput(
	stderr: string,
	exitCode: number,
): KitError {
	const errorType = detectErrorType(stderr, exitCode);
	return new KitError(errorType, undefined, stderr.trim());
}
