/**
 * MCP response formatting utilities.
 *
 * Provides standardized types and helper functions for formatting MCP tool responses
 * in either JSON or Markdown format.
 *
 * @module mcp-response
 */

/**
 * Response format enum for tool outputs.
 *
 * MCP tools should accept a `response_format` parameter to allow clients
 * to choose between human-readable markdown or machine-parseable JSON.
 *
 * @example
 * ```typescript
 * tool("my_tool", {
 *   inputSchema: {
 *     query: z.string(),
 *     response_format: z.enum(["markdown", "json"]).default("markdown")
 *   }
 * }, async ({ query, response_format }) => {
 *   const format = parseResponseFormat(response_format);
 *   return respondText(format, "Result");
 * });
 * ```
 */
export enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

/**
 * Parse response_format parameter to enum.
 *
 * Converts a string parameter to the ResponseFormat enum, defaulting to
 * MARKDOWN if the value is not "json".
 *
 * @param value - The response_format parameter value (typically from tool arguments)
 * @returns ResponseFormat.JSON if value === "json", otherwise ResponseFormat.MARKDOWN
 *
 * @example
 * ```typescript
 * const format = parseResponseFormat("json"); // ResponseFormat.JSON
 * const format = parseResponseFormat("markdown"); // ResponseFormat.MARKDOWN
 * const format = parseResponseFormat(undefined); // ResponseFormat.MARKDOWN
 * ```
 */
export function parseResponseFormat(value?: string): ResponseFormat {
	return value === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;
}

/**
 * Format an error for MCP response.
 *
 * Converts an error object to a formatted string suitable for MCP responses.
 * JSON format includes an isError flag for programmatic detection.
 *
 * @param error - Error object or error message string
 * @param format - Output format (JSON or Markdown)
 * @returns Formatted error string
 *
 * @example
 * ```typescript
 * const err = new Error("File not found");
 * formatError(err, ResponseFormat.JSON);
 * // Returns: '{\n  "error": "File not found",\n  "isError": true\n}'
 *
 * formatError(err, ResponseFormat.MARKDOWN);
 * // Returns: "**Error:** File not found"
 * ```
 */
export function formatError(error: unknown, format: ResponseFormat): string {
	const message = error instanceof Error ? error.message : String(error);
	if (format === ResponseFormat.JSON) {
		return JSON.stringify({ error: message, isError: true }, null, 2);
	}
	return `**Error:** ${message}`;
}

/**
 * MCP text content type.
 *
 * Represents a text content block in an MCP response.
 */
export type McpTextContent = {
	readonly type: "text";
	readonly text: string;
};

/**
 * MCP response type.
 *
 * Standard response structure for MCP tools.
 */
export type McpResponse = {
	readonly content: readonly McpTextContent[];
};

/**
 * MCP error response type.
 *
 * Response structure for MCP tools that encounter errors.
 * The isError flag allows clients to detect errors programmatically.
 */
export type McpErrorResponse = McpResponse & {
	readonly isError: true;
};

/**
 * Create a successful text response.
 *
 * Wraps text content in the standard MCP response structure.
 *
 * @param format - Output format (JSON or Markdown)
 * @param text - Response text content
 * @returns MCP response object
 *
 * @example
 * ```typescript
 * tool("greet", {
 *   inputSchema: {
 *     name: z.string(),
 *     response_format: z.enum(["markdown", "json"]).default("markdown")
 *   }
 * }, async ({ name, response_format }) => {
 *   const format = parseResponseFormat(response_format);
 *   const result = { greeting: `Hello ${name}!` };
 *   const text = format === ResponseFormat.JSON
 *     ? JSON.stringify(result)
 *     : result.greeting;
 *   return respondText(format, text);
 * });
 * ```
 */
export function respondText(
	_format: ResponseFormat,
	text: string,
): McpResponse {
	return {
		content: [{ type: "text" as const, text }],
	};
}

/**
 * Create an error response with isError flag.
 *
 * Formats an error using formatError and wraps it in an MCP error response
 * structure with the isError flag set.
 *
 * @param format - Output format (JSON or Markdown)
 * @param error - Error object or error message
 * @returns MCP error response object
 *
 * @example
 * ```typescript
 * tool("my_tool", {
 *   inputSchema: { query: z.string() }
 * }, async ({ query }) => {
 *   try {
 *     const result = await doWork(query);
 *     return respondText(ResponseFormat.JSON, JSON.stringify(result));
 *   } catch (error) {
 *     return respondError(ResponseFormat.JSON, error);
 *   }
 * });
 * ```
 */
export function respondError(
	format: ResponseFormat,
	error: unknown,
): McpErrorResponse {
	return {
		isError: true,
		content: [
			{
				type: "text" as const,
				text: formatError(error, format),
			},
		],
	};
}
