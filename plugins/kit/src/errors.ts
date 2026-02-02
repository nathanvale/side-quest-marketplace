/**
 * Kit Plugin Error Taxonomy
 *
 * Comprehensive error handling with clear recovery instructions.
 */

import {
	detectErrorFromOutput as coreDetectErrorFromOutput,
	type ErrorPattern,
	isTimeoutOutput,
	PluginError,
} from "@side-quest/core/instrumentation";

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
	/** Semantic search index not yet built for repository */
	SemanticIndexNotBuilt = "SemanticIndexNotBuilt",
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
	[KitErrorType.SemanticIndexNotBuilt]: {
		message: "Vector index has not been built for this repository yet.",
		hint: "Build it by running the CLI command provided in the error details. After building (one-time), semantic search will be fast and cached.",
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
		message:
			"Operation timed out (this may take longer on large repositories).",
		hint: "Try again—the vector index will be cached. If it times out again, clear .kit/vector_db and rebuild with build_index: true.",
	},
};

// ============================================================================
// Error Class
// ============================================================================

/**
 * Custom error class for Kit operations.
 *
 * Extends PluginError to provide Kit-specific error handling with:
 * - Typed error classification (KitErrorType enum)
 * - User-friendly messages with recovery hints
 * - Structured JSON serialization for MCP responses
 */
export class KitError extends PluginError<KitErrorType> {
	constructor(type: KitErrorType, details?: string, stderr?: string) {
		const errorInfo = ERROR_MESSAGES[type];
		super("KitError", type, errorInfo.message, errorInfo.hint, details, stderr);
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

/**
 * Check if an error indicates a timeout occurred.
 *
 * Re-exports the core utility for backward compatibility.
 *
 * @param stderr - Standard error output
 */
export const isTimeoutError = isTimeoutOutput;

// ============================================================================
// Error Detection Helpers
// ============================================================================

/**
 * Kit-specific error patterns for subprocess output detection.
 *
 * These patterns are tested in order by detectErrorType().
 */
const KIT_ERROR_PATTERNS: ErrorPattern<KitErrorType>[] = [
	// Semantic search unavailable (must be first - most specific)
	{
		type: KitErrorType.SemanticNotAvailable,
		patterns: [
			"sentence-transformers",
			"chromadb",
			"semantic search",
			"vector index",
			"embedding",
		],
	},
	// Path errors
	{
		type: KitErrorType.InvalidPath,
		patterns: ["no such file", "not found", "does not exist"],
	},
	// Timeout errors
	{
		type: KitErrorType.Timeout,
		patterns: ["timeout", "timed out", "etimedout"],
	},
	// Too many results
	{
		type: KitErrorType.TooManyResults,
		patterns: ["too many", "limit"],
	},
];

/**
 * Detect error type from Kit stderr output.
 *
 * Uses the generic core pattern matcher with Kit-specific patterns.
 *
 * @param stderr - Standard error output from Kit
 * @param _exitCode - Exit code from Kit process (currently unused)
 */
export function detectErrorType(
	stderr: string,
	_exitCode: number,
): KitErrorType {
	return coreDetectErrorFromOutput(
		stderr,
		KIT_ERROR_PATTERNS,
		KitErrorType.KitCommandFailed, // Default
	);
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
