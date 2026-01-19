/**
 * Git operation tools for Para-Obsidian MCP server.
 *
 * Tools:
 * - para_commit: Commit uncommitted vault notes
 *
 * @module mcp-handlers/git
 */

import { tool, z } from "@sidequest/core/mcp";
import {
	createCorrelationId,
	log,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "../../mcp/utils";
import { loadConfig } from "../config/index";
import type { CommitAllResult, CommitNoteResult } from "../git/index";
import { commitAllNotes, commitNote } from "../git/index";

// ============================================================================
// Commit Tool
// ============================================================================

tool(
	"para_commit",
	{
		description: `Commit uncommitted vault notes without needing to know vault location.

Commits notes in PARA-managed folders (Projects, Areas, Resources, Archives).

Without file parameter: Commits all uncommitted .md files in PARA folders
With file parameter: Commits specified note with its linked attachments

Each note is committed individually with message: "docs: <note title>"

Use this tool when:
- Git guard errors tell you to commit changes
- Working from other repos and don't know vault path
- Need to ensure vault is clean before processing

Returns structured results with commit count, messages, and files.`,
		inputSchema: {
			file: z
				.string()
				.optional()
				.describe(
					'Vault-relative path to commit single note (e.g., "01 Projects/My Project.md"). Omit to commit all uncommitted notes.',
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
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { file, response_format } = args as {
			file?: string;
			response_format?: string;
		};
		const cid = createCorrelationId();
		const startTime = Date.now();
		log({
			cid,
			tool: "para_commit",
			event: "request",
			file: file ?? "all",
		});

		try {
			const config = loadConfig();
			const format = parseResponseFormat(response_format);

			// Single file commit
			if (file) {
				const result: CommitNoteResult = await commitNote(config, file);

				log({
					cid,
					tool: "para_commit",
					event: "response",
					success: true,
					committed: result.committed,
					fileCount: result.files.length,
					durationMs: Date.now() - startTime,
				});

				if (format === ResponseFormat.JSON) {
					return respondText(format, JSON.stringify(result, null, 2));
				}

				// Markdown format
				if (!result.committed) {
					return respondText(
						format,
						`## Nothing to Commit\n\n**File:** ${file}\n\nThe note is already committed or has no changes.`,
					);
				}

				const lines = [
					"## Note Committed",
					"",
					`**File:** ${file}`,
					`**Message:** ${result.message}`,
					`**Files committed:** ${result.files.length}`,
				];

				if (result.files.length > 1) {
					lines.push("", "**Includes attachments:**");
					for (const f of result.files.slice(1)) {
						lines.push(`- ${f}`);
					}
				}

				return respondText(format, lines.join("\n"));
			}

			// Commit all uncommitted notes
			const result: CommitAllResult = await commitAllNotes(config);

			log({
				cid,
				tool: "para_commit",
				event: "response",
				success: true,
				total: result.total,
				committed: result.committed,
				durationMs: Date.now() - startTime,
			});

			if (format === ResponseFormat.JSON) {
				return respondText(format, JSON.stringify(result, null, 2));
			}

			// Markdown format
			if (result.total === 0) {
				return respondText(
					format,
					"## No Uncommitted Notes\n\nAll notes in PARA folders are already committed.",
				);
			}

			const lines = [
				"## Committed All Notes",
				"",
				`**Total notes found:** ${result.total}`,
				`**Successfully committed:** ${result.committed}`,
			];

			if (result.results.length > 0) {
				lines.push("", "**Commits:**");
				for (const r of result.results) {
					if (r.committed) {
						lines.push(`- ${r.message} (${r.files.length} file(s))`);
					}
				}
			}

			return respondText(format, lines.join("\n"));
		} catch (error) {
			log({
				cid,
				tool: "para_commit",
				durationMs: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			const format = parseResponseFormat(response_format);
			return respondError(format, error);
		}
	},
);
