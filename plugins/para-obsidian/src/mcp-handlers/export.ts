/**
 * Export tools for Para-Obsidian MCP server.
 *
 * Tools:
 * - para_export_bookmarks: Export bookmarks to Netscape HTML format
 *
 * @module mcp/tools/export
 */

import { randomUUID } from "node:crypto";
import { getLogger } from "@logtape/logtape";
import { tool, z } from "@side-quest/core/mcp";
import {
	createLoggerAdapter,
	ResponseFormat,
	wrapToolHandler,
} from "@side-quest/core/mcp-response";
import { OutputFormat } from "@side-quest/core/terminal";
import {
	handleExportBookmarks,
	resolveOutputPath,
} from "../cli/export-bookmarks";
import type { CommandContext } from "../cli/types";
import { loadConfig } from "../config/index";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

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
	wrapToolHandler(
		async (args, format) => {
			const { filter, output_path } = args as {
				filter?: string;
				output_path?: string;
			};
			const config = loadConfig();

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

			if (!result.success) {
				throw new Error(result.error ?? "Export failed");
			}

			// Return the resolved path in response
			if (format === ResponseFormat.JSON) {
				return { success: true, output_path: resolvedPath };
			}

			return `Successfully exported bookmarks to ${resolvedPath}`;
		},
		{ toolName: "para_export_bookmarks", logger, createCid },
	),
);
