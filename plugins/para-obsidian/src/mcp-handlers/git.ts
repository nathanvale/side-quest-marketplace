/**
 * Git operation tools for Para-Obsidian MCP server.
 *
 * Tools:
 * - para_commit: Commit uncommitted vault notes
 *
 * @module mcp-handlers/git
 */

import { randomUUID } from "node:crypto";
import { getLogger } from "@logtape/logtape";
import { tool, z } from "@sidequest/core/mcp";
import {
	createLoggerAdapter,
	ResponseFormat,
	wrapToolHandler,
} from "@sidequest/core/mcp-response";
import { loadConfig } from "../config/index";
import type { CommitAllResult, CommitNoteResult } from "../git/index";
import { commitAllNotes, commitNote } from "../git/index";

const logger = createLoggerAdapter(getLogger("para-obsidian.mcp"));
const createCid = () => randomUUID();

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
	wrapToolHandler(
		async (args, format) => {
			const { file } = args as { file?: string };
			const config = loadConfig();

			// Single file commit
			if (file) {
				const result: CommitNoteResult = await commitNote(config, file);

				if (format === ResponseFormat.JSON) {
					return result;
				}

				// Markdown format
				if (!result.committed) {
					return `## Nothing to Commit\n\n**File:** ${file}\n\nThe note is already committed or has no changes.`;
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

				return lines.join("\n");
			}

			// Commit all uncommitted notes
			const result: CommitAllResult = await commitAllNotes(config);

			if (format === ResponseFormat.JSON) {
				return result;
			}

			// Markdown format
			if (result.total === 0) {
				return "## No Uncommitted Notes\n\nAll notes in PARA folders are already committed.";
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

			return lines.join("\n");
		},
		{ toolName: "para_commit", logger, createCid },
	),
);
