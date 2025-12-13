/**
 * Para-Obsidian MCP Tools: Links
 *
 * Link rewriting tool for vault restructuring.
 */

import { tool, z } from "@sidequest/core/mcp";
import {
	createCorrelationId,
	log,
	parseDirs,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "../../mcp/utils";
import { loadConfig } from "../config/index";
import { type RewriteMapping, rewriteLinks } from "../links/rewrite";

// ============================================================================
// Rewrite Links Tool
// ============================================================================

tool(
	"para_rewrite_links",
	{
		description: `Rewrite link targets across vault notes without renaming files.

Use cases:
- Fix broken attachment links after external rename
- Update wikilinks after restructuring
- Bulk find/replace for renamed concepts

Handles:
- Wikilinks: [[old]] → [[new]]
- With aliases: [[old|alias]] → [[new|alias]]
- With headings: [[old#section]] → [[new#section]]
- With block refs: [[old^block]] → [[new^block]]
- Markdown links: [text](old.md) → [text](new.md)
- Frontmatter strings and arrays

Supports:
- Single replacement via from/to parameters
- Batch replacement via mapping parameter
- Directory scoping
- Dry-run preview (default: true for safety)`,
		inputSchema: {
			from: z
				.string()
				.optional()
				.describe('Link target to find (without brackets, e.g., "old.pdf")'),
			to: z
				.string()
				.optional()
				.describe('Replacement target (without brackets, e.g., "new.pdf")'),
			mapping: z
				.record(z.string())
				.optional()
				.describe(
					'Batch mapping of from→to pairs (e.g., {"old.pdf": "new.pdf", "old-note": "new-note"})',
				),
			dir: z
				.string()
				.optional()
				.describe("Directories to scope (comma-separated)"),
			dry_run: z
				.boolean()
				.optional()
				.describe("Preview changes without writing (default: true for safety)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { from, to, mapping, dir, dry_run, response_format } = args as {
			from?: string;
			to?: string;
			mapping?: Record<string, string>;
			dir?: string;
			dry_run?: boolean;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_rewrite_links",
			event: "request",
			from,
			to,
			hasMapping: !!mapping,
			dry_run,
		});

		try {
			const config = loadConfig();
			// Default to dry-run for safety
			const dryRun = dry_run ?? true;
			const dirs = parseDirs(dir);

			// Build mappings array from either from/to or mapping object
			const mappings: RewriteMapping[] = [];

			if (from && to) {
				mappings.push({ from, to });
			}

			if (mapping) {
				for (const [mapFrom, mapTo] of Object.entries(mapping)) {
					mappings.push({ from: mapFrom, to: mapTo });
				}
			}

			if (mappings.length === 0) {
				throw new Error("Either from/to pair or mapping object is required");
			}

			const result = rewriteLinks(config.vault, mappings, {
				dryRun,
				dirs,
			});
			const format = parseResponseFormat(response_format);

			log({
				cid,
				tool: "para_rewrite_links",
				event: "response",
				success: true,
				linksRewritten: result.linksRewritten,
				notesUpdated: result.notesUpdated,
				dryRun,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(
					format,
					JSON.stringify(
						{
							dryRun,
							linksRewritten: result.linksRewritten,
							notesUpdated: result.notesUpdated,
							updates: result.updates,
						},
						null,
						2,
					),
				);
			}

			const verb = dryRun ? "Would rewrite" : "Rewrote";
			const lines = [
				`## ${verb} Links`,
				"",
				`**Links rewritten:** ${result.linksRewritten}`,
				`**Notes updated:** ${result.notesUpdated}`,
			];

			if (dryRun) {
				lines.push("", "_Dry-run mode: no files were modified_");
			}

			if (result.updates.length > 0) {
				lines.push("", "**Details:**");
				for (const update of result.updates) {
					lines.push(`- **${update.note}:**`);
					for (const rewrite of update.rewrites) {
						lines.push(
							`  - ${rewrite.from} → ${rewrite.to} (${rewrite.location}, ${rewrite.count}x)`,
						);
					}
				}
			}

			return respondText(format, lines.join("\n"));
		} catch (error) {
			log({
				cid,
				tool: "para_rewrite_links",
				event: "error",
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
);
