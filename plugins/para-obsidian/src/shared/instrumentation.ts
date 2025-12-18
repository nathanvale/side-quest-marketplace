import type { Logger } from "@logtape/logtape";
import { createCorrelationId, type SUBSYSTEMS } from "./logger.js";

/** Message format required for MetricsCollector compatibility */
const MCP_TOOL_RESPONSE = "MCP tool response" as const;

/** Internal fields that cannot be overridden by context */
type ReservedFields = "cid" | "tool" | "durationMs" | "success" | "timestamp";

/** Error codes for incident triage and categorization */
export type ErrorCode =
	| "NETWORK_ERROR"
	| "TIMEOUT"
	| "NOT_FOUND"
	| "VALIDATION"
	| "PERMISSION"
	| "CONFLICT"
	| "INTERNAL";

/** Error category for alerting and retry logic */
export type ErrorCategory = "transient" | "permanent" | "configuration";

/**
 * Categorize an error by its type/message for incident triage.
 * Returns a structured error code that can be used for filtering and alerting.
 */
export function categorizeError(error: unknown): ErrorCode {
	if (!(error instanceof Error)) return "INTERNAL";

	const msg = error.message.toLowerCase();

	// Network errors (transient)
	if (
		msg.includes("econnrefused") ||
		msg.includes("enotfound") ||
		msg.includes("network") ||
		msg.includes("fetch failed")
	) {
		return "NETWORK_ERROR";
	}

	// Timeout errors (transient)
	if (msg.includes("timeout") || msg.includes("timed out")) {
		return "TIMEOUT";
	}

	// Not found errors (permanent)
	if (
		msg.includes("not found") ||
		msg.includes("enoent") ||
		msg.includes("no such file")
	) {
		return "NOT_FOUND";
	}

	// Validation errors (permanent)
	if (
		msg.includes("invalid") ||
		msg.includes("validation") ||
		msg.includes("must be") ||
		msg.includes("required")
	) {
		return "VALIDATION";
	}

	// Permission errors (configuration)
	if (
		msg.includes("permission") ||
		msg.includes("eacces") ||
		msg.includes("eperm") ||
		msg.includes("unauthorized")
	) {
		return "PERMISSION";
	}

	// Conflict errors (permanent)
	if (msg.includes("conflict") || msg.includes("already exists")) {
		return "CONFLICT";
	}

	return "INTERNAL";
}

/**
 * Get the error category for retry/alerting logic.
 * - transient: Retry may succeed (network, timeout)
 * - permanent: Retry will not help (not found, validation, conflict)
 * - configuration: Requires config change (permission)
 */
export function getErrorCategory(error: unknown): ErrorCategory {
	const code = categorizeError(error);

	switch (code) {
		case "NETWORK_ERROR":
		case "TIMEOUT":
			return "transient";
		case "PERMISSION":
			return "configuration";
		default:
			return "permanent";
	}
}

/** Branded type enforcing subsystem prefix pattern */
type ToolName = `${(typeof SUBSYSTEMS)[number]}:${string}`;

/**
 * Options for observe/observeSync utilities.
 */
export interface ObserveOptions<T> {
	/** Custom success check for non-throwing failures (e.g., functions returning error objects) */
	isSuccess?: (result: T) => boolean;
	/** Additional context to log (cannot override internal fields) */
	context?: Omit<Record<string, unknown>, ReservedFields>;
	/** Parent correlation ID for trace hierarchy - links nested operations */
	parentCid?: string;
}

/**
 * Adds observability to async operations WITHOUT changing return type.
 * Uses "MCP tool response" message format for MetricsCollector compatibility.
 *
 * Required properties for session summaries:
 * - tool: Tool name with subsystem prefix
 * - durationMs: Execution time in milliseconds
 * - success: Operation success flag
 *
 * @template T - The return type of the operation
 * @param logger - Subsystem logger to use (e.g., templatesLogger)
 * @param tool - Tool name with subsystem prefix: "subsystem:operationName"
 * @param operation - Async function to instrument
 * @param options - Optional success criteria and additional context
 * @returns Original return value (transparent to callers)
 * @throws Re-throws any error from the operation after logging
 *
 * @example
 * ```typescript
 * const templates = await observe(
 *   templatesLogger,
 *   "templates:loadTemplates",
 *   async () => loadFromDisk(vaultPath),
 *   { context: { vaultPath } }
 * );
 * ```
 */
export async function observe<T>(
	logger: Logger,
	tool: ToolName,
	operation: () => Promise<T>,
	options?: ObserveOptions<T>,
): Promise<T> {
	const cid = createCorrelationId();
	const parentCid = options?.parentCid;
	const startTime = Date.now();

	try {
		const result = await operation();
		const durationMs = Math.max(0, Date.now() - startTime);
		const success = options?.isSuccess ? options.isSuccess(result) : true;

		logger.info(MCP_TOOL_RESPONSE, {
			cid,
			...(parentCid && { parentCid }),
			tool,
			durationMs,
			success,
			timestamp: new Date().toISOString(),
			...options?.context,
		});

		return result;
	} catch (error: unknown) {
		const durationMs = Math.max(0, Date.now() - startTime);
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		const errorCode = categorizeError(error);
		const errorCategory = getErrorCategory(error);

		logger.error(MCP_TOOL_RESPONSE, {
			cid,
			...(parentCid && { parentCid }),
			tool,
			durationMs,
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage,
			errorCode,
			errorCategory,
			stack: errorStack,
			...options?.context,
		});

		throw error;
	}
}

/**
 * Sync version for non-async operations.
 * Same behavior as observe() but for synchronous functions.
 *
 * @throws Re-throws any error from the operation after logging
 */
export function observeSync<T>(
	logger: Logger,
	tool: ToolName,
	operation: () => T,
	options?: ObserveOptions<T>,
): T {
	const cid = createCorrelationId();
	const parentCid = options?.parentCid;
	const startTime = Date.now();

	try {
		const result = operation();
		const durationMs = Math.max(0, Date.now() - startTime);
		const success = options?.isSuccess ? options.isSuccess(result) : true;

		logger.info(MCP_TOOL_RESPONSE, {
			cid,
			...(parentCid && { parentCid }),
			tool,
			durationMs,
			success,
			timestamp: new Date().toISOString(),
			...options?.context,
		});

		return result;
	} catch (error: unknown) {
		const durationMs = Math.max(0, Date.now() - startTime);
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		const errorCode = categorizeError(error);
		const errorCategory = getErrorCategory(error);

		logger.error(MCP_TOOL_RESPONSE, {
			cid,
			...(parentCid && { parentCid }),
			tool,
			durationMs,
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage,
			errorCode,
			errorCategory,
			stack: errorStack,
			...options?.context,
		});

		throw error;
	}
}
