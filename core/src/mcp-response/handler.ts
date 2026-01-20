/**
 * MCP tool handler wrapper to reduce boilerplate.
 *
 * Provides a high-level wrapper around tool handlers that automatically handles:
 * - Correlation ID generation
 * - Request/response logging with timing
 * - Response format parsing
 * - Error handling and categorization
 * - Response formatting (JSON or Markdown)
 *
 * @module mcp-response/handler
 */

import type { McpErrorResponse, McpResponse } from "./response";
import {
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "./response";

/**
 * Logger interface expected by the wrapper.
 *
 * Compatible with LogTape and similar structured logging libraries.
 */
export interface Logger {
	info(message: string, properties?: Record<string, unknown>): void;
	error(message: string, properties?: Record<string, unknown>): void;
}

/**
 * Correlation ID generator function.
 *
 * Should return a unique identifier for each tool invocation.
 */
export type CorrelationIdGenerator = () => string;

/**
 * Tool handler function that returns raw data.
 *
 * The wrapper will automatically format the data based on response_format.
 * Return plain objects/arrays for automatic JSON stringification.
 */
export type DataHandler<TArgs, TResult> = (
	args: TArgs,
	format: ResponseFormat,
) => Promise<TResult> | TResult;

/**
 * Tool handler function that returns formatted text.
 *
 * For cases where custom formatting is needed. The function receives
 * the parsed ResponseFormat and should return formatted text.
 */
export type FormattedHandler<TArgs> = (
	args: TArgs,
	format: ResponseFormat,
) => Promise<string> | string;

/**
 * Options for wrapToolHandler.
 */
export interface WrapToolHandlerOptions {
	/**
	 * Tool name for logging (e.g., "para_config").
	 * Used in log messages to identify which tool is executing.
	 */
	toolName: string;

	/**
	 * Logger instance for structured logging.
	 * Must implement info() and error() methods.
	 */
	logger: Logger;

	/**
	 * Correlation ID generator function.
	 * Called once per tool invocation to create a unique identifier.
	 * Example: () => randomUUID()
	 */
	createCid: CorrelationIdGenerator;

	/**
	 * Additional properties to include in log messages.
	 * Useful for adding context like sessionCid, userId, etc.
	 */
	logContext?: Record<string, unknown>;
}

/**
 * Categorize an error based on its message.
 *
 * @param error - Error to categorize
 * @returns Object with error category and code
 */
function categorizeError(error: unknown): {
	category: string;
	code: string;
} {
	const message =
		error instanceof Error ? error.message : String(error || "Unknown error");

	// Network errors (transient - can retry)
	if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(message)) {
		return { category: "transient", code: "NETWORK_ERROR" };
	}

	// Not found errors (permanent - won't be fixed by retrying)
	if (/not found|ENOENT|404/i.test(message)) {
		return { category: "permanent", code: "NOT_FOUND" };
	}

	// Validation errors (permanent - requires code/data fix)
	if (/invalid|validation|schema|required/i.test(message)) {
		return { category: "permanent", code: "VALIDATION" };
	}

	// Permission errors (configuration - requires setup/auth fix)
	if (/permission|EACCES|EPERM|unauthorized/i.test(message)) {
		return { category: "configuration", code: "PERMISSION" };
	}

	// Default
	return { category: "unknown", code: "UNKNOWN_ERROR" };
}

/**
 * Wrap a tool handler with automatic logging, error handling, and response formatting.
 *
 * Reduces MCP tool boilerplate from ~25 lines to ~5 lines per tool by automatically:
 * - Creating correlation IDs for request tracing
 * - Logging request start with timestamp
 * - Parsing response_format parameter
 * - Executing handler with error handling
 * - Formatting responses (JSON or Markdown)
 * - Logging response/error with timing and categorization
 *
 * ## Usage with Data Handler (automatic formatting)
 *
 * ```typescript
 * import { tool, z } from "@sidequest/core/mcp";
 * import { wrapToolHandler } from "@sidequest/core/mcp-response";
 *
 * tool("para_config", {
 *   inputSchema: {
 *     response_format: z.enum(["markdown", "json"]).optional()
 *   }
 * }, wrapToolHandler(
 *   async (args, format) => {
 *     const config = loadConfig();
 *     // Return raw data - wrapper handles formatting
 *     return config;
 *   },
 *   {
 *     toolName: "para_config",
 *     logger: myLogger,
 *     createCid: () => randomUUID()
 *   }
 * ));
 * ```
 *
 * ## Usage with Formatted Handler (custom formatting)
 *
 * ```typescript
 * tool("para_list", {
 *   inputSchema: {
 *     path: z.string().optional(),
 *     response_format: z.enum(["markdown", "json"]).optional()
 *   }
 * }, wrapToolHandler(
 *   async (args, format) => {
 *     const files = listFiles(args.path);
 *     // Custom formatting based on format
 *     if (format === ResponseFormat.JSON) {
 *       return JSON.stringify({ files }, null, 2);
 *     }
 *     return `## Files\n\n${files.map(f => `- ${f}`).join('\n')}`;
 *   },
 *   {
 *     toolName: "para_list",
 *     logger: myLogger,
 *     createCid: () => randomUUID()
 *   }
 * ));
 * ```
 *
 * @param handler - Tool handler function (returns data or formatted text)
 * @param options - Configuration options (toolName, logger, createCid)
 * @returns MCP tool handler function with automatic logging and formatting
 */
export function wrapToolHandler<TArgs extends Record<string, unknown>>(
	handler: DataHandler<TArgs, unknown> | FormattedHandler<TArgs>,
	options: WrapToolHandlerOptions,
): (args: TArgs) => Promise<McpResponse | McpErrorResponse> {
	const { toolName, logger, createCid, logContext = {} } = options;

	return async (args: TArgs): Promise<McpResponse | McpErrorResponse> => {
		const cid = createCid();
		const startTime = Date.now();

		// Log request start
		logger.info("MCP tool request", {
			...logContext,
			cid,
			tool: toolName,
			event: "request",
			timestamp: new Date().toISOString(),
		});

		try {
			// Parse response format
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);

			// Execute handler
			const result = await handler(args, format);

			// Calculate duration
			const durationMs = Date.now() - startTime;

			// Log success
			logger.info("MCP tool response", {
				...logContext,
				cid,
				tool: toolName,
				event: "response",
				success: true,
				durationMs,
				timestamp: new Date().toISOString(),
			});

			// Format response based on result type
			if (typeof result === "string") {
				// Handler returned formatted text
				return respondText(format, result);
			}

			// Handler returned raw data - format based on response_format
			if (format === ResponseFormat.JSON) {
				return respondText(format, JSON.stringify(result, null, 2));
			}

			// Markdown format for data - stringify as formatted JSON
			// (most tools override with custom markdown formatting)
			return respondText(format, JSON.stringify(result, null, 2));
		} catch (error) {
			// Calculate duration
			const durationMs = Date.now() - startTime;

			// Categorize error
			const { category, code } = categorizeError(error);
			const errorMessage =
				error instanceof Error
					? error.message
					: String(error || "Unknown error");

			// Build error properties
			const errorProps: Record<string, unknown> = {
				...logContext,
				cid,
				tool: toolName,
				event: "error",
				success: false,
				durationMs,
				error: errorMessage,
				errorCategory: category,
				errorCode: code,
				timestamp: new Date().toISOString(),
			};

			// Add stack trace for Error objects
			if (error instanceof Error && error.stack) {
				errorProps.stack = error.stack;
			}

			// Log error
			logger.error("MCP tool response", errorProps);

			// Parse format for error response
			const format = parseResponseFormat(
				args.response_format as string | undefined,
			);

			// Return error response
			return respondError(format, error);
		}
	};
}

/**
 * Re-export categorizeError for testing and external use.
 */
export { categorizeError };
