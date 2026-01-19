/**
 * MCP response formatting utilities.
 *
 * Provides standardized types and helper functions for formatting MCP tool responses
 * in either JSON or Markdown format.
 *
 * ## Key Features
 *
 * - **ResponseFormat enum** - Standard format types (JSON, Markdown)
 * - **parseResponseFormat** - Parse response_format parameter
 * - **formatError** - Format errors consistently
 * - **respondText** - Create success responses
 * - **respondError** - Create error responses with isError flag
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
 *
 * tool("my_tool", {
 *   inputSchema: {
 *     query: z.string(),
 *     response_format: z.enum(["markdown", "json"]).default("markdown")
 *   }
 * }, async ({ query, response_format }) => {
 *   const format = parseResponseFormat(response_format);
 *
 *   try {
 *     const result = await doWork(query);
 *     const text = format === ResponseFormat.JSON
 *       ? JSON.stringify(result)
 *       : formatMarkdown(result);
 *     return respondText(format, text);
 *   } catch (error) {
 *     return respondError(format, error);
 *   }
 * });
 * ```
 *
 * @module mcp-response
 */

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
