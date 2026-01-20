/**
 * MCP response formatting and logging utilities.
 *
 * Provides standardized types and helper functions for formatting MCP tool responses
 * in either JSON or Markdown format, plus logging utilities for tool invocations.
 *
 * ## Key Features
 *
 * ### Response Formatting
 * - **ResponseFormat enum** - Standard format types (JSON, Markdown)
 * - **parseResponseFormat** - Parse response_format parameter
 * - **formatError** - Format errors consistently
 * - **respondText** - Create success responses
 * - **respondError** - Create error responses with isError flag
 *
 * ### Logging
 * - **log()** - Log MCP tool events with correlation IDs
 * - **withLogFile()** - Inject log file path into responses
 * - **setMcpLogger()** - Configure logger instance
 * - **setLogFile()** - Configure log file path
 *
 * ### Tool Handler Wrapper (RECOMMENDED)
 * - **wrapToolHandler()** - High-level wrapper reducing boilerplate from ~25 lines to ~5 lines
 * - Automatically handles: correlation IDs, logging, error handling, response formatting
 *
 * ## Usage Example (Low-Level API)
 *
 * ```typescript
 * import { tool, z } from "@sidequest/core/mcp";
 * import {
 *   ResponseFormat,
 *   parseResponseFormat,
 *   respondText,
 *   respondError,
 *   log,
 *   withLogFile,
 *   setMcpLogger,
 *   setLogFile
 * } from "@sidequest/core/mcp-response";
 * import { createCorrelationId } from "@sidequest/core/logging";
 *
 * // Setup (once at startup)
 * setMcpLogger(myLogger);
 * setLogFile("/path/to/log");
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
 *     log({ cid, tool: "my_tool", durationMs, success: true });
 *
 *     const text = format === ResponseFormat.JSON
 *       ? JSON.stringify(result)
 *       : formatMarkdown(result);
 *     return respondText(format, withLogFile(text, format));
 *   } catch (error) {
 *     const durationMs = Date.now() - startTime;
 *
 *     log({ cid, tool: "my_tool", durationMs, success: false, error });
 *
 *     return respondError(format, error);
 *   }
 * });
 * ```
 *
 * ## Usage Example (High-Level Wrapper - Recommended)
 *
 * ```typescript
 * import { tool, z } from "@sidequest/core/mcp";
 * import { wrapToolHandler } from "@sidequest/core/mcp-response";
 *
 * tool("my_tool", {
 *   inputSchema: {
 *     query: z.string(),
 *     response_format: z.enum(["markdown", "json"]).optional()
 *   }
 * }, wrapToolHandler(
 *   async (args, format) => {
 *     const result = await doWork(args.query);
 *     // Return raw data - wrapper handles formatting
 *     return result;
 *   },
 *   {
 *     toolName: "my_tool",
 *     logger: myLogger,
 *     createCid: () => randomUUID()
 *   }
 * ));
 * ```
 *
 * @module mcp-response
 */

export {
	type CorrelationIdGenerator,
	categorizeError,
	type DataHandler,
	type FormattedHandler,
	type Logger,
	type WrapToolHandlerOptions,
	wrapToolHandler,
} from "./handler";

export {
	getLogFile,
	type LogEntry,
	log,
	type McpLogger,
	setLogFile,
	setMcpLogger,
	withLogFile,
} from "./logging";
export {
	formatError,
	type McpErrorResponse,
	type McpResponse,
	type McpTextContent,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "./response";
