/**
 * Logger adapters for MCP tool handlers.
 *
 * Provides adapters that bridge different logger interfaces to the Logger
 * interface expected by wrapToolHandler.
 *
 * ## LogTape Adapter
 *
 * LogTape uses object-first signature: `logger.info({ message, ...props })`
 * wrapToolHandler expects string-first: `logger.info(message, props)`
 *
 * ## Usage
 *
 * ```typescript
 * import { getLogger } from "@logtape/logtape";
 * import { createLoggerAdapter } from "@sidequest/core/mcp-response";
 * import { wrapToolHandler } from "@sidequest/core/mcp-response";
 *
 * const logtapeLogger = getLogger("my-plugin");
 * const logger = createLoggerAdapter(logtapeLogger);
 *
 * tool("my_tool", {
 *   inputSchema: { query: z.string() }
 * }, wrapToolHandler(
 *   async (args, format) => {
 *     // Tool implementation
 *     return result;
 *   },
 *   {
 *     toolName: "my_tool",
 *     logger: logger, // Adapted logger
 *     createCid: () => randomUUID()
 *   }
 * ));
 * ```
 *
 * @module mcp-response/adapters
 */

import type { Logger as LogTapeLogger } from "@logtape/logtape";
import type { Logger } from "./handler";

/**
 * Create an adapter that bridges LogTape logger to MCP handler logger interface.
 *
 * LogTape uses object-first signature: `logger.info({ message, ...props })`
 * wrapToolHandler expects string-first: `logger.info(message, props)`
 *
 * This adapter transforms the string-first signature to LogTape's object-first
 * signature by merging the message into the properties object.
 *
 * @param logtapeLogger - LogTape logger instance from getLogger()
 * @returns Logger adapter compatible with wrapToolHandler
 *
 * @example
 * ```typescript
 * import { getLogger } from "@logtape/logtape";
 * import { createLoggerAdapter } from "@sidequest/core/mcp-response";
 *
 * const logtapeLogger = getLogger("my-plugin.mcp");
 * const logger = createLoggerAdapter(logtapeLogger);
 *
 * // Now you can use it with wrapToolHandler
 * wrapToolHandler(handler, {
 *   toolName: "my_tool",
 *   logger: logger,
 *   createCid: () => randomUUID()
 * });
 * ```
 */
export function createLoggerAdapter(logtapeLogger: LogTapeLogger): Logger {
	return {
		info: (message: string, properties?: Record<string, unknown>) => {
			// LogTape's info() has overloaded signatures - we call the properties overload
			(logtapeLogger.info as (props: Record<string, unknown>) => void)({
				message,
				...properties,
			});
		},
		error: (message: string, properties?: Record<string, unknown>) => {
			// LogTape's error() has overloaded signatures - we call the properties overload
			(logtapeLogger.error as (props: Record<string, unknown>) => void)({
				message,
				...properties,
			});
		},
	};
}
