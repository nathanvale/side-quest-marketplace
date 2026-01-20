/**
 * MCP logging utilities for tool invocations.
 *
 * Provides structured logging with correlation IDs and log file path injection
 * for MCP tool responses. Uses error categorization from core instrumentation
 * for intelligent error handling.
 *
 * ## Key Features
 *
 * - **log()** - Log MCP tool events with correlation IDs
 * - **withLogFile()** - Inject log file path into responses
 * - **LogEntry** - Structured log entry type for tool invocations
 *
 * ## Usage Example
 *
 * ```typescript
 * import { tool, z } from "@sidequest/core/mcp";
 * import {
 *   ResponseFormat,
 *   parseResponseFormat,
 *   respondText,
 *   respondError
 * } from "@sidequest/core/mcp-response";
 * import { log, withLogFile } from "@sidequest/core/mcp-response/logging";
 * import { createCorrelationId } from "@sidequest/core/logging";
 *
 * tool("my_tool", {
 *   inputSchema: {
 *     query: z.string(),
 *     response_format: z.enum(["markdown", "json"]).default("markdown")
 *   }
 * }, async ({ query, response_format }) => {
 *   const format = parseResponseFormat(response_format);
 *   const cid = createCorrelationId();
 *   const startTime = Date.now();
 *
 *   try {
 *     const result = await doWork(query);
 *     const durationMs = Date.now() - startTime;
 *
 *     log({
 *       cid,
 *       tool: "my_tool",
 *       durationMs,
 *       success: true,
 *       query
 *     });
 *
 *     const text = format === ResponseFormat.JSON
 *       ? JSON.stringify(result)
 *       : formatMarkdown(result);
 *     return respondText(format, withLogFile(text, format));
 *   } catch (error) {
 *     const durationMs = Date.now() - startTime;
 *
 *     log({
 *       cid,
 *       tool: "my_tool",
 *       durationMs,
 *       success: false,
 *       error
 *     });
 *
 *     return respondError(format, error);
 *   }
 * });
 * ```
 *
 * @module mcp-response/logging
 */

import { categorizeError } from "@sidequest/core/instrumentation";
import type { ResponseFormat } from "./response";

/**
 * Log entry structure for MCP tool invocations.
 *
 * Required fields:
 * - cid: Correlation ID for request tracing
 * - tool: Tool name (e.g., "para_config")
 *
 * For MetricsCollector compatibility (on response/error events):
 * - durationMs: Execution time in milliseconds
 * - success: Whether the tool succeeded
 *
 * @example
 * ```typescript
 * const entry: LogEntry = {
 *   cid: createCorrelationId(),
 *   tool: "my_tool",
 *   durationMs: 123,
 *   success: true,
 *   query: "user input"
 * };
 * log(entry);
 * ```
 */
export interface LogEntry {
	cid: string;
	tool: string;
	durationMs?: number;
	success?: boolean;
	[key: string]: unknown;
}

/**
 * Logger interface for MCP tool logging.
 *
 * This interface allows dependency injection for testing and flexibility
 * in logger implementation.
 */
export interface McpLogger {
	info(message: string, properties: Record<string, unknown>): void;
	error(message: string, properties: Record<string, unknown>): void;
}

/**
 * Current MCP logger instance.
 * Set this before calling log() to enable logging.
 */
let currentLogger: McpLogger | undefined;

/**
 * Current log file path.
 * Set this if you want withLogFile() to inject log file paths.
 */
let currentLogFile: string | undefined;

/**
 * Set the MCP logger instance.
 *
 * Call this during initialization to enable logging for MCP tools.
 *
 * @param logger - Logger instance implementing McpLogger interface
 *
 * @example
 * ```typescript
 * import { mcpLogger } from "./my-plugin/logger";
 * import { setMcpLogger } from "@sidequest/core/mcp-response/logging";
 *
 * setMcpLogger(mcpLogger);
 * ```
 */
export function setMcpLogger(logger: McpLogger): void {
	currentLogger = logger;
}

/**
 * Set the current log file path.
 *
 * Call this during initialization to enable log file path injection
 * in MCP responses via withLogFile().
 *
 * @param logFile - Path to the current log file
 *
 * @example
 * ```typescript
 * import { setLogFile } from "@sidequest/core/mcp-response/logging";
 *
 * setLogFile("/home/user/.claude/logs/para-obsidian.log");
 * ```
 */
export function setLogFile(logFile: string): void {
	currentLogFile = logFile;
}

/**
 * Get the current log file path.
 *
 * @returns Current log file path, or undefined if not set
 */
export function getLogFile(): string | undefined {
	return currentLogFile;
}

/**
 * Log an MCP tool event.
 *
 * Uses standard LogTape signature: logger.info(message, properties)
 * This format enables MetricsCollector to parse tool invocation metrics.
 *
 * Required properties for metrics collection:
 * - tool: Tool name
 * - durationMs: Execution time in milliseconds
 * - success: Whether the tool succeeded
 *
 * For error cases, automatically enriches logs with:
 * - error: Error message string
 * - errorCategory: Error category (transient, permanent, configuration, unknown)
 * - errorCode: Specific error code for filtering/alerting
 * - stack: Stack trace (if Error object)
 *
 * @param entry - Log entry with tool invocation details
 *
 * @example
 * ```typescript
 * // Success case
 * log({
 *   cid: "abc123",
 *   tool: "my_tool",
 *   durationMs: 150,
 *   success: true,
 *   query: "user input"
 * });
 *
 * // Error case
 * log({
 *   cid: "abc123",
 *   tool: "my_tool",
 *   durationMs: 250,
 *   success: false,
 *   error: new Error("File not found")
 * });
 * ```
 */
export function log(entry: LogEntry): void {
	if (!currentLogger) return;

	const { error, success, ...rest } = entry;
	const timestamp = new Date().toISOString();

	// Successful operation - log as info
	if (success !== false) {
		currentLogger.info("MCP tool response", {
			...rest,
			timestamp,
		});
		return;
	}

	// Failed operation - enhance error logging
	const errorMessage =
		error instanceof Error ? error.message : String(error || "Unknown error");
	const { category, code } = categorizeError(error);

	const properties: Record<string, unknown> = {
		...rest,
		error: errorMessage,
		errorCategory: category,
		errorCode: code,
		timestamp,
	};

	// Add stack trace for Error objects
	if (error instanceof Error && error.stack) {
		properties.stack = error.stack;
	}

	currentLogger.error("MCP tool response", properties);
}

/**
 * Append log file path to response text.
 *
 * Injects the current log file path into MCP response text. This helps users
 * find logs for debugging. The injection format depends on the response format:
 *
 * - **JSON format**: Adds a `logFile` field to the JSON object
 * - **Markdown format**: Appends a "Logs: <path>" line
 *
 * If no log file is set (via setLogFile), returns the text unchanged.
 *
 * @param text - Response text content
 * @param format - Response format (JSON or Markdown)
 * @returns Text with log file path injected
 *
 * @example
 * ```typescript
 * // JSON format
 * const text = JSON.stringify({ result: "success" });
 * const enhanced = withLogFile(text, ResponseFormat.JSON);
 * // Returns: '{\n  "result": "success",\n  "logFile": "/path/to/log"\n}'
 *
 * // Markdown format
 * const text = "Operation completed successfully";
 * const enhanced = withLogFile(text, ResponseFormat.MARKDOWN);
 * // Returns: "Operation completed successfully\n\nLogs: /path/to/log"
 * ```
 */
export function withLogFile(text: string, format: ResponseFormat): string {
	if (!currentLogFile) return text;

	if (format === "json") {
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return JSON.stringify(
					{ data: parsed, logFile: currentLogFile },
					null,
					2,
				);
			}
			if (parsed && typeof parsed === "object") {
				return JSON.stringify({ ...parsed, logFile: currentLogFile }, null, 2);
			}
		} catch {
			// Fall through to wrapping below
		}
		return JSON.stringify({ data: text, logFile: currentLogFile }, null, 2);
	}

	return `${text}\n\nLogs: ${currentLogFile}`;
}
