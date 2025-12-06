#!/usr/bin/env bun
/**
 * Clipboard MCP Server
 *
 * Provides cross-platform clipboard operations with structured error handling.
 *
 * Tools:
 * - mcp__clipboard_clipboard__copy: Copy text to clipboard
 * - mcp__clipboard_clipboard__paste: Paste text from clipboard
 */

import {
	createCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";
import { startServer, tool, z } from "@sidequest/core/mcp";

// Initialize logger
const { initLogger, getSubsystemLogger } = createPluginLogger({
	name: "clipboard",
	subsystems: ["mcp"],
});

// Initialize logger on server startup
initLogger().catch(console.error);

const mcpLogger = getSubsystemLogger("mcp");

/**
 * Response format options for tool output
 */
enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

interface CopyResult {
	success: boolean;
	bytes_copied: number;
	platform: string;
}

interface PasteResult {
	content: string;
	bytes_pasted: number;
	platform: string;
}

interface ErrorResult {
	error: string;
	isError: true;
	suggestion?: string;
	command?: string;
}

/**
 * Format result as markdown or JSON
 */
function formatCopyResult(result: CopyResult, format: ResponseFormat): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result);
	}
	return `Copied ${result.bytes_copied} bytes to clipboard (${result.platform})`;
}

function formatPasteResult(
	result: PasteResult,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result);
	}
	return `\`\`\`\n${result.content}\n\`\`\`\n\n(${result.bytes_pasted} bytes from ${result.platform} clipboard)`;
}

function formatError(error: ErrorResult, format: ResponseFormat): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(error);
	}
	let msg = `**Error:** ${error.error}`;
	if (error.suggestion) {
		msg += `\n\n${error.suggestion}`;
	}
	if (error.command) {
		msg += `\n\nCommand: \`${error.command}\``;
	}
	return msg;
}

/**
 * Get platform-specific clipboard commands
 */
function getClipboardCommands(operation: "copy" | "paste"): {
	command: string;
	args: string[];
} | null {
	const platform = process.platform;

	if (operation === "copy") {
		if (platform === "darwin") {
			return { command: "pbcopy", args: [] };
		}
		if (platform === "linux") {
			return { command: "xclip", args: ["-selection", "clipboard"] };
		}
		if (platform === "win32") {
			return { command: "clip", args: [] };
		}
	} else {
		if (platform === "darwin") {
			return { command: "pbpaste", args: [] };
		}
		if (platform === "linux") {
			return { command: "xclip", args: ["-selection", "clipboard", "-o"] };
		}
		if (platform === "win32") {
			return { command: "powershell", args: ["-command", "Get-Clipboard"] };
		}
	}

	return null;
}

// Tool: Copy to clipboard
tool(
	"mcp__clipboard_clipboard__copy",
	{
		description: "Copy text to the system clipboard",
		inputSchema: {
			content: z.string().describe("The text content to copy to clipboard"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { content, response_format } = args as {
			content: string;
			response_format?: string;
		};

		mcpLogger.info("Tool request", {
			cid,
			tool: "copy",
			bytes: content.length,
		});

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;
		const platform = process.platform;

		const clipboardCmd = getClipboardCommands("copy");
		if (!clipboardCmd) {
			const error: ErrorResult = {
				error: `Unsupported platform: ${platform}`,
				isError: true,
				suggestion:
					"This plugin supports macOS (pbcopy), Linux (xclip), and Windows (clip)",
			};
			mcpLogger.error("Tool failed", {
				cid,
				tool: "copy",
				error: error.error,
				platform,
				durationMs: Date.now() - startTime,
			});
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}

		try {
			const proc = Bun.spawn([clipboardCmd.command, ...clipboardCmd.args], {
				stdin: new Blob([content]),
			});

			const exitCode = await proc.exited;

			if (exitCode !== 0) {
				const error: ErrorResult = {
					error: `Clipboard command failed with exit code ${exitCode}`,
					isError: true,
					command: `${clipboardCmd.command} ${clipboardCmd.args.join(" ")}`,
				};
				mcpLogger.error("Tool failed", {
					cid,
					tool: "copy",
					error: error.error,
					exitCode,
					durationMs: Date.now() - startTime,
				});
				return {
					isError: true,
					content: [
						{ type: "text" as const, text: formatError(error, format) },
					],
				};
			}

			const result: CopyResult = {
				success: true,
				bytes_copied: content.length,
				platform,
			};

			mcpLogger.info("Tool response", {
				cid,
				tool: "copy",
				success: true,
				bytes_copied: content.length,
				durationMs: Date.now() - startTime,
			});

			return {
				content: [
					{ type: "text" as const, text: formatCopyResult(result, format) },
				],
			};
		} catch (err) {
			const error: ErrorResult = {
				error: err instanceof Error ? err.message : String(err),
				isError: true,
			};
			mcpLogger.error("Tool failed", {
				cid,
				tool: "copy",
				error: error.error,
				durationMs: Date.now() - startTime,
			});
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// Tool: Paste from clipboard
tool(
	"mcp__clipboard_clipboard__paste",
	{
		description: "Paste text from the system clipboard",
		inputSchema: {
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { response_format } = args as {
			response_format?: string;
		};

		mcpLogger.info("Tool request", { cid, tool: "paste" });

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;
		const platform = process.platform;

		const clipboardCmd = getClipboardCommands("paste");
		if (!clipboardCmd) {
			const error: ErrorResult = {
				error: `Unsupported platform: ${platform}`,
				isError: true,
				suggestion:
					"This plugin supports macOS (pbpaste), Linux (xclip), and Windows (powershell)",
			};
			mcpLogger.error("Tool failed", {
				cid,
				tool: "paste",
				error: error.error,
				platform,
				durationMs: Date.now() - startTime,
			});
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}

		try {
			const proc = Bun.spawn([clipboardCmd.command, ...clipboardCmd.args], {
				stdout: "pipe",
			});

			const text = await new Response(proc.stdout).text();
			const exitCode = await proc.exited;

			if (exitCode !== 0) {
				const error: ErrorResult = {
					error: `Clipboard command failed with exit code ${exitCode}`,
					isError: true,
					command: `${clipboardCmd.command} ${clipboardCmd.args.join(" ")}`,
				};
				mcpLogger.error("Tool failed", {
					cid,
					tool: "paste",
					error: error.error,
					exitCode,
					durationMs: Date.now() - startTime,
				});
				return {
					isError: true,
					content: [
						{ type: "text" as const, text: formatError(error, format) },
					],
				};
			}

			const result: PasteResult = {
				content: text,
				bytes_pasted: text.length,
				platform,
			};

			mcpLogger.info("Tool response", {
				cid,
				tool: "paste",
				success: true,
				bytes_pasted: text.length,
				durationMs: Date.now() - startTime,
			});

			return {
				content: [
					{ type: "text" as const, text: formatPasteResult(result, format) },
				],
			};
		} catch (err) {
			const error: ErrorResult = {
				error: err instanceof Error ? err.message : String(err),
				isError: true,
			};
			mcpLogger.error("Tool failed", {
				cid,
				tool: "paste",
				error: error.error,
				durationMs: Date.now() - startTime,
			});
			return {
				isError: true,
				content: [{ type: "text" as const, text: formatError(error, format) }],
			};
		}
	},
);

// Start the server
startServer("clipboard", { version: "1.0.0" });
