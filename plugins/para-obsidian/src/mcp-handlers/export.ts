/**
 * Export tools for Para-Obsidian MCP server.
 *
 * Tools:
 * - para_export_bookmarks: Export bookmarks to Netscape HTML format
 *
 * @module mcp/tools/export
 */

import { tool, z } from "@sidequest/core/mcp";
import { OutputFormat } from "@sidequest/core/terminal";
import {
	createCorrelationId,
	log,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "../../mcp/utils";
import {
	handleExportBookmarks,
	resolveOutputPath,
} from "../cli/export-bookmarks";
import type { CommandContext } from "../cli/types";
import { loadConfig } from "../config/index";

// ============================================================================
// Export Bookmarks Tool
// ============================================================================

tool(
	"para_export_bookmarks",
	{
		description: `Export bookmarks to Netscape Bookmark File Format 1 HTML.

Queries all notes with type:bookmark frontmatter, groups them by PARA category
(Projects/Areas/Resources/Archives), and generates browser-importable HTML.

The export includes:
- Bookmarks grouped by PARA category
- Sorted alphabetically within each category
- Standard Netscape format compatible with all browsers
- ADD_DATE timestamps from note creation dates

Returns the output file path and bookmark count.`,
		inputSchema: {
			filter: z
				.string()
				.optional()
				.describe('Frontmatter filter (default: "type:bookmark")'),
			output_path: z
				.string()
				.optional()
				.describe(
					'Output file path (default: "bookmarks.html"). Supports ~ expansion.',
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: true,
		},
	},
	async (args: Record<string, unknown>) => {
		const { filter, output_path, response_format } = args as {
			filter?: string;
			output_path?: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_export_bookmarks",
			event: "request",
			filter,
			output_path,
		});

		try {
			const config = loadConfig();
			const format = parseResponseFormat(response_format);

			// Resolve output path before calling handler
			const unresolvedPath = output_path ?? "bookmarks.html";
			const resolvedPath = resolveOutputPath(unresolvedPath);

			// Build context for CLI handler
			const ctx: CommandContext = {
				config,
				positional: [],
				flags: {
					filter: filter ?? "type:bookmark",
					out: unresolvedPath,
				},
				format:
					format === ResponseFormat.JSON
						? OutputFormat.JSON
						: OutputFormat.MARKDOWN,
				isJson: format === ResponseFormat.JSON,
			};

			// Use CLI handler for business logic
			const result = await handleExportBookmarks(ctx);

			log({
				cid,
				tool: "para_export_bookmarks",
				event: "response",
				success: result.success,
				durationMs: Date.now() - startTime,
			});

			if (!result.success) {
				return respondError(format, new Error(result.error ?? "Export failed"));
			}

			// Return the resolved path in response
			if (format === ResponseFormat.JSON) {
				return respondText(
					format,
					JSON.stringify({ success: true, output_path: resolvedPath }, null, 2),
				);
			}

			return respondText(
				format,
				`Successfully exported bookmarks to ${resolvedPath}`,
			);
		} catch (error) {
			log({
				cid,
				tool: "para_export_bookmarks",
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
);
